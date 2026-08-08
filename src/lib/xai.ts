// ============================================
// Meta Muse Spark helpers for runtime (Cloudflare Workers) use
// ============================================
// Kept under src/ so Vercel can bundle them. Kept under src/ for the Workers bundle.
// Filename retained (xai.ts) for import stability after Grok → Muse migration.

export const LLM_BASE_URL = "https://api.meta.ai/v1";
/** @deprecated Use LLM_BASE_URL */
export const XAI_BASE_URL = LLM_BASE_URL;

/** Muse Spark 1.2 (Standard). Override with LLM_MODEL if needed. */
export const LLM_DEFAULT_MODEL =
  (typeof process !== "undefined" ? process.env.LLM_MODEL : undefined) ||
  "muse-spark-1.2";
/** @deprecated Use LLM_DEFAULT_MODEL */
export const XAI_DEFAULT_MODEL = LLM_DEFAULT_MODEL;

export function getLlmApiKey(explicit?: string): string | undefined {
  if (explicit) return explicit;
  if (typeof process === "undefined") return undefined;
  return process.env.MODEL_API_KEY || process.env.XAI_API_KEY;
}

function requireApiKey(explicit?: string): string {
  const key = getLlmApiKey(explicit);
  if (!key) {
    throw new Error(
      "MODEL_API_KEY (or legacy XAI_API_KEY) is missing. Cannot call Muse Spark."
    );
  }
  return key;
}

/** Upload a binary/base64 file to Meta Files API. Returns file id. */
export async function uploadXaiFile(options: {
  apiKey?: string;
  data: Buffer | Uint8Array | string;
  filename: string;
  mimeType?: string;
  purpose?: string;
}): Promise<string> {
  const apiKey = requireApiKey(options.apiKey);
  const bytes =
    typeof options.data === "string"
      ? Buffer.from(options.data, "base64")
      : Buffer.from(options.data);

  const form = new FormData();
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  );
  form.append(
    "file",
    new Blob([ab], { type: options.mimeType || "application/octet-stream" }),
    options.filename
  );
  // Meta Files API: purpose=user_data for inference reference
  form.append("purpose", options.purpose || "user_data");

  const res = await fetch(`${LLM_BASE_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta file upload failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Meta file upload returned no id");
  return json.id;
}

export async function deleteXaiFile(
  fileId: string,
  apiKey?: string
): Promise<void> {
  const key = requireApiKey(apiKey);
  await fetch(`${LLM_BASE_URL}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
  });
}

/**
 * Analyze text + uploaded file ids / image data URLs via Meta Responses API.
 * Prefer this for PDFs (Files API + input_file).
 */
export async function respondWithFiles(options: {
  apiKey?: string;
  model?: string;
  prompt: string;
  fileIds?: string[];
  imageDataUrls?: string[];
  maxTokens?: number;
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
}): Promise<string> {
  const apiKey = requireApiKey(options.apiKey);
  const content: Array<Record<string, unknown>> = [
    { type: "input_text", text: options.prompt },
  ];
  for (const fileId of options.fileIds || []) {
    content.push({ type: "input_file", file_id: fileId });
  }
  for (const url of options.imageDataUrls || []) {
    content.push({ type: "input_image", image_url: url });
  }

  const res = await fetch(`${LLM_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model || LLM_DEFAULT_MODEL,
      input: [{ type: "message", role: "user", content }],
      max_output_tokens: options.maxTokens ?? 4096,
      reasoning: { effort: options.reasoningEffort || "minimal" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta responses failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof data.output_text === "string" && data.output_text) {
    return data.output_text;
  }

  const texts: string[] = [];
  for (const item of data.output || []) {
    if (item.type && item.type !== "message") continue;
    for (const block of item.content || []) {
      if (block.type === "output_text" && block.text) texts.push(block.text);
    }
  }
  if (texts.length) return texts.join("\n");

  throw new Error("Meta responses returned no text");
}
