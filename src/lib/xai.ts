// ============================================
// xAI Grok helpers for runtime (Vercel) use
// ============================================
// Kept under src/ so Vercel can bundle them. scripts/ is .vercelignore'd.

export const XAI_BASE_URL = "https://api.x.ai/v1";
export const XAI_DEFAULT_MODEL = "grok-4.5";

function requireApiKey(explicit?: string): string {
  const key =
    explicit ||
    (typeof process !== "undefined" ? process.env.XAI_API_KEY : undefined);
  if (!key) {
    throw new Error("XAI_API_KEY is missing. Cannot call Grok.");
  }
  return key;
}

/** Upload a binary/base64 file to xAI Files API. Returns file id. */
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
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  form.append(
    "file",
    new Blob([ab], { type: options.mimeType || "application/octet-stream" }),
    options.filename
  );
  form.append("purpose", options.purpose || "assistants");

  const res = await fetch(`${XAI_BASE_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`xAI file upload failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("xAI file upload returned no id");
  return json.id;
}

export async function deleteXaiFile(fileId: string, apiKey?: string): Promise<void> {
  const key = requireApiKey(apiKey);
  await fetch(`${XAI_BASE_URL}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
  });
}

/**
 * Analyze text + uploaded file ids / image data URLs via xAI Responses API.
 * Prefer this for PDFs (Files API + input_file).
 */
export async function respondWithFiles(options: {
  apiKey?: string;
  model?: string;
  prompt: string;
  fileIds?: string[];
  imageDataUrls?: string[];
  maxTokens?: number;
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

  const res = await fetch(`${XAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model || XAI_DEFAULT_MODEL,
      input: [{ role: "user", content }],
      max_output_tokens: options.maxTokens ?? 4096,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`xAI responses failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof data.output_text === "string" && data.output_text) {
    return data.output_text;
  }

  const last = data.output?.[data.output.length - 1];
  const text = last?.content?.find((c) => c.type === "output_text")?.text;
  if (text) return text;
  throw new Error("xAI responses returned no text");
}
