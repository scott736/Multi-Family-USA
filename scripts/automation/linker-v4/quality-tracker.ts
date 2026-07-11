// ============================================
// Smart Linker v4 — Applied Link Quality Tracker
// ============================================
// Records outcomes of applied links and provides keep-rate / removal stats.
// Best-effort: callers should not fail if tracker writes error out.

import fs from "fs/promises";
import path from "path";

export const QUALITY_TRACKER_PATH = "src/data/linker-v4/applied-links-quality.json";
const SCHEMA_VERSION = 1;

export type PositionBucket = "intro" | "body" | "conclusion";
export type RejectionReason =
  | "editor-removed"
  | "linker-replaced"
  | "manual"
  | (string & {});

export interface AppliedLinkRecord {
  id: string;
  sourceSlug: string;
  sourceUrl: string;
  targetUrl: string;
  anchorText: string;
  appliedAt: string;
  modelUsed: string;
  confidence: number;
  paragraphIndex: number;
  positionBucket: PositionBucket;
  rejectedAt: string | null;
  rejectionReason: RejectionReason | null;
  firstSeen: string;
  lastSeen: string;
}

export interface QualityTrackerFile {
  schemaVersion: number;
  links: AppliedLinkRecord[];
}

export interface QualityStats {
  total: number;
  kept: number;
  removed: number;
  keepRate: number;
  byModel: Record<string, { total: number; kept: number; removed: number }>;
  byPositionBucket: Record<string, { total: number; kept: number; removed: number }>;
  avgConfidenceOfKept: number;
  avgConfidenceOfRemoved: number;
}

export function buildLinkId(sourceSlug: string, targetUrl: string): string {
  return `${sourceSlug}::${targetUrl}`;
}

async function loadFile(): Promise<QualityTrackerFile> {
  const filePath = path.resolve(QUALITY_TRACKER_PATH);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as QualityTrackerFile;
    if (!parsed.schemaVersion || !Array.isArray(parsed.links)) {
      return { schemaVersion: SCHEMA_VERSION, links: [] };
    }
    return parsed;
  } catch {
    return { schemaVersion: SCHEMA_VERSION, links: [] };
  }
}

async function saveFile(data: QualityTrackerFile): Promise<void> {
  const filePath = path.resolve(QUALITY_TRACKER_PATH);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function recordAppliedLink(
  link: Omit<AppliedLinkRecord, "firstSeen" | "lastSeen" | "rejectedAt" | "rejectionReason"> &
    Partial<Pick<AppliedLinkRecord, "firstSeen" | "lastSeen" | "rejectedAt" | "rejectionReason">>
): Promise<void> {
  const data = await loadFile();
  const now = new Date().toISOString();
  const existingIdx = data.links.findIndex((l) => l.id === link.id);

  if (existingIdx >= 0) {
    const existing = data.links[existingIdx];
    data.links[existingIdx] = {
      ...existing,
      ...link,
      firstSeen: existing.firstSeen,
      lastSeen: now,
      rejectedAt: null,
      rejectionReason: null,
    };
  } else {
    data.links.push({
      rejectedAt: null,
      rejectionReason: null,
      firstSeen: now,
      lastSeen: now,
      ...link,
    } as AppliedLinkRecord);
  }

  await saveFile(data);
}

export async function markRemoved(id: string, reason: RejectionReason): Promise<void> {
  const data = await loadFile();
  const idx = data.links.findIndex((l) => l.id === id);
  if (idx < 0) return;
  const now = new Date().toISOString();
  data.links[idx] = {
    ...data.links[idx],
    rejectedAt: data.links[idx].rejectedAt || now,
    rejectionReason: data.links[idx].rejectionReason || reason,
  };
  await saveFile(data);
}

export async function detectRemovals(currentLinks: Set<string>): Promise<string[]> {
  const data = await loadFile();
  const removed: string[] = [];
  const now = new Date().toISOString();
  let mutated = false;

  for (const link of data.links) {
    if (link.rejectedAt) continue;
    if (!currentLinks.has(link.id)) {
      link.rejectedAt = now;
      link.rejectionReason = "editor-removed";
      removed.push(link.id);
      mutated = true;
    } else {
      link.lastSeen = now;
      mutated = true;
    }
  }

  if (mutated) await saveFile(data);
  return removed;
}

export async function getKeepRate(): Promise<number> {
  const data = await loadFile();
  if (data.links.length === 0) return 0;
  const kept = data.links.filter((l) => !l.rejectedAt).length;
  return kept / data.links.length;
}

export async function getStats(): Promise<QualityStats> {
  const data = await loadFile();
  const stats: QualityStats = {
    total: data.links.length,
    kept: 0,
    removed: 0,
    keepRate: 0,
    byModel: {},
    byPositionBucket: {},
    avgConfidenceOfKept: 0,
    avgConfidenceOfRemoved: 0,
  };

  let keptConfSum = 0;
  let removedConfSum = 0;

  for (const link of data.links) {
    const isRemoved = !!link.rejectedAt;
    if (isRemoved) {
      stats.removed++;
      removedConfSum += link.confidence;
    } else {
      stats.kept++;
      keptConfSum += link.confidence;
    }

    const modelBucket = (stats.byModel[link.modelUsed] ||= {
      total: 0,
      kept: 0,
      removed: 0,
    });
    modelBucket.total++;
    if (isRemoved) modelBucket.removed++;
    else modelBucket.kept++;

    const posBucket = (stats.byPositionBucket[link.positionBucket] ||= {
      total: 0,
      kept: 0,
      removed: 0,
    });
    posBucket.total++;
    if (isRemoved) posBucket.removed++;
    else posBucket.kept++;
  }

  stats.keepRate = stats.total > 0 ? stats.kept / stats.total : 0;
  stats.avgConfidenceOfKept = stats.kept > 0 ? keptConfSum / stats.kept : 0;
  stats.avgConfidenceOfRemoved = stats.removed > 0 ? removedConfSum / stats.removed : 0;

  return stats;
}

export async function getTopRemovedAnchors(
  limit = 10
): Promise<Array<{ anchor: string; removed: number; total: number }>> {
  const data = await loadFile();
  const counts = new Map<string, { removed: number; total: number }>();
  for (const link of data.links) {
    const key = link.anchorText.toLowerCase().trim();
    const entry = counts.get(key) || { removed: 0, total: 0 };
    entry.total++;
    if (link.rejectedAt) entry.removed++;
    counts.set(key, entry);
  }
  return Array.from(counts.entries())
    .map(([anchor, v]) => ({ anchor, removed: v.removed, total: v.total }))
    .filter((e) => e.removed > 0)
    .sort((a, b) => b.removed - a.removed)
    .slice(0, limit);
}

export async function loadAllRecords(): Promise<AppliedLinkRecord[]> {
  const data = await loadFile();
  return data.links;
}

export async function printQualityReport(): Promise<void> {
  const stats = await getStats();
  const topRemoved = await getTopRemovedAnchors(10);

  console.log("\n=== Smart Linker v4 — Applied Link Quality Report ===\n");

  if (stats.total === 0) {
    console.log("No tracked links yet. Apply some links to populate the tracker.\n");
    return;
  }

  console.log(`Total tracked:       ${stats.total}`);
  console.log(`Kept:                ${stats.kept}`);
  console.log(`Removed:             ${stats.removed}`);
  console.log(`Keep rate:           ${(stats.keepRate * 100).toFixed(1)}%`);
  console.log(`Avg confidence kept: ${stats.avgConfidenceOfKept.toFixed(3)}`);
  console.log(`Avg conf. removed:   ${stats.avgConfidenceOfRemoved.toFixed(3)}\n`);

  console.log("By model:");
  for (const [model, v] of Object.entries(stats.byModel)) {
    const keepRate = v.total > 0 ? ((v.kept / v.total) * 100).toFixed(1) : "0.0";
    console.log(`  ${model}: ${v.kept}/${v.total} kept (${keepRate}%)`);
  }

  console.log("\nBy position bucket:");
  for (const [bucket, v] of Object.entries(stats.byPositionBucket)) {
    const keepRate = v.total > 0 ? ((v.kept / v.total) * 100).toFixed(1) : "0.0";
    console.log(`  ${bucket}: ${v.kept}/${v.total} kept (${keepRate}%)`);
  }

  if (topRemoved.length > 0) {
    console.log("\nTop 10 most-removed anchor patterns:");
    for (const entry of topRemoved) {
      console.log(
        `  "${entry.anchor}" — removed ${entry.removed}/${entry.total}`
      );
    }
  } else {
    console.log("\nNo removals recorded.");
  }
  console.log("");
}
