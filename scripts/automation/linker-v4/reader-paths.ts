// ============================================
// Smart Linker v4 — Reader Paths (Scaffold)
// ============================================
// Consumes a Vercel Analytics session CSV and extracts implicit edges
// for use as a signal in the link graph / page ranking.
//
// CSV shape: session_id,timestamp,url
// File: src/data/linker-v4/reader-paths-input.csv

import fs from "fs/promises";
import path from "path";
import type { LinkGraphData, LinkGraphNode } from "./types";

export const READER_PATHS_INPUT = "src/data/linker-v4/reader-paths-input.csv";
export const READER_PATHS_OUTPUT = "src/data/linker-v4/reader-path-edges.json";

export interface SessionRow {
  sessionId: string;
  timestamp: number;
  url: string;
}

export interface Session {
  sessionId: string;
  rows: SessionRow[];
}

export interface ReaderEdge {
  from: string;
  to: string;
  weight: number;
  isImplicit: boolean;
}

export interface EnrichedNode extends LinkGraphNode {
  readerPathBoost: number;
}

export interface EnrichedLinkGraph extends Omit<LinkGraphData, "nodes"> {
  nodes: Record<string, EnrichedNode>;
}

// ----------------
// CSV Parsing (minimal, controlled format)
// ----------------

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export async function parseSessions(csvPath: string): Promise<Session[]> {
  const abs = path.isAbsolute(csvPath) ? csvPath : path.resolve(csvPath);
  const content = await fs.readFile(abs, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect header
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader =
    header.includes("session_id") && header.includes("timestamp") && header.includes("url");
  const sessionIdx = hasHeader ? header.indexOf("session_id") : 0;
  const tsIdx = hasHeader ? header.indexOf("timestamp") : 1;
  const urlIdx = hasHeader ? header.indexOf("url") : 2;

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const grouped = new Map<string, SessionRow[]>();

  for (const line of dataLines) {
    const cols = splitCsvLine(line);
    if (cols.length < 3) continue;
    const sessionId = cols[sessionIdx];
    const tsRaw = cols[tsIdx];
    const url = cols[urlIdx];
    if (!sessionId || !url) continue;

    const tsNum = Number(tsRaw);
    const timestamp = Number.isFinite(tsNum) ? tsNum : Date.parse(tsRaw);
    if (!Number.isFinite(timestamp)) continue;

    const rows = grouped.get(sessionId) || [];
    rows.push({ sessionId, timestamp, url });
    grouped.set(sessionId, rows);
  }

  const sessions: Session[] = [];
  for (const [sessionId, rows] of grouped.entries()) {
    rows.sort((a, b) => a.timestamp - b.timestamp);
    sessions.push({ sessionId, rows });
  }
  return sessions;
}

// ----------------
// Edge Extraction
// ----------------

export function extractEdges(sessions: Session[]): Map<string, Map<string, number>> {
  const edges = new Map<string, Map<string, number>>();

  const bump = (from: string, to: string, weight: number) => {
    if (!from || !to || from === to) return;
    const inner = edges.get(from) || new Map<string, number>();
    inner.set(to, (inner.get(to) || 0) + weight);
    edges.set(from, inner);
  };

  for (const session of sessions) {
    const urls = session.rows.map((r) => r.url);
    // Consecutive edges (weight 1)
    for (let i = 0; i < urls.length - 1; i++) {
      bump(urls[i], urls[i + 1], 1);
    }
    // 2-hop implicit edges (half weight)
    for (let i = 0; i < urls.length - 2; i++) {
      bump(urls[i], urls[i + 2], 0.5);
    }
  }

  return edges;
}

export function getImplicitEdges(
  edges: Map<string, Map<string, number>>,
  minWeight = 3
): ReaderEdge[] {
  const result: ReaderEdge[] = [];
  for (const [from, inner] of edges.entries()) {
    for (const [to, weight] of inner.entries()) {
      if (weight < minWeight) continue;
      // Fractional weight means at least one 2-hop contribution → implicit
      const isImplicit = weight % 1 !== 0;
      result.push({ from, to, weight, isImplicit });
    }
  }
  result.sort((a, b) => b.weight - a.weight);
  return result;
}

// ----------------
// Graph Enrichment
// ----------------

function normalizeUrl(url: string): string {
  if (!url) return url;
  return url.endsWith("/") ? url : url + "/";
}

export function enrichLinkGraph(
  graph: LinkGraphData,
  edges: Map<string, Map<string, number>>
): EnrichedLinkGraph {
  const outboundWeight = new Map<string, number>();
  for (const [from, inner] of edges.entries()) {
    let sum = 0;
    for (const weight of inner.values()) sum += weight;
    outboundWeight.set(normalizeUrl(from), sum);
  }

  const newNodes: Record<string, EnrichedNode> = {};
  for (const [key, node] of Object.entries(graph.nodes)) {
    const weight = outboundWeight.get(normalizeUrl(node.url)) || 0;
    newNodes[key] = {
      ...node,
      readerPathBoost: Math.log(1 + weight),
    };
  }

  return {
    ...graph,
    nodes: newNodes,
  };
}

// ----------------
// Mode Entry Point
// ----------------

export async function runReaderPathsMode(): Promise<void> {
  const inputPath = path.resolve(READER_PATHS_INPUT);
  const outputPath = path.resolve(READER_PATHS_OUTPUT);

  let csvExists = true;
  try {
    await fs.access(inputPath);
  } catch {
    csvExists = false;
  }

  if (!csvExists) {
    console.log(
      `No analytics data available at ${READER_PATHS_INPUT}. ` +
        `Generate via Vercel Analytics export. See reader-paths.ts for expected schema.`
    );
    return;
  }

  console.log(`Parsing sessions from ${READER_PATHS_INPUT}...`);
  const sessions = await parseSessions(inputPath);
  console.log(`  Sessions parsed: ${sessions.length}`);

  const edgeMap = extractEdges(sessions);
  const topEdges = getImplicitEdges(edgeMap, 3);
  console.log(`  Edges above weight 3: ${topEdges.length}`);

  const payload = {
    generatedAt: new Date().toISOString(),
    sessionsParsed: sessions.length,
    edgeCount: topEdges.length,
    edges: topEdges,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2));
  console.log(`  Wrote ${outputPath}\n`);

  console.log("Top 20 reader-path edges:");
  for (const edge of topEdges.slice(0, 20)) {
    const flag = edge.isImplicit ? " [implicit]" : "";
    console.log(`  ${edge.from} → ${edge.to} (w=${edge.weight})${flag}`);
  }
}
