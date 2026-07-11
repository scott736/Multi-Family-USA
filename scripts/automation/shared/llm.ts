// ============================================
// Shared LLM client — xAI Grok 4.5
// ============================================
// Drop-in Messages API shape used across automation scripts.
// Backed by the OpenAI SDK pointed at api.x.ai (Grok 4.5).

import OpenAI from "openai";
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { MODELS } from "../config";

export {
  XAI_BASE_URL,
  deleteXaiFile,
  respondWithFiles,
  uploadXaiFile,
} from "../../../src/lib/xai";
import { XAI_BASE_URL } from "../../../src/lib/xai";

export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
export type ContentBlock = TextBlock | ToolUseBlock | { type: string; [key: string]: unknown };

export interface MessageResponse {
  content: ContentBlock[];
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

export interface MessageCreateParams {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string | ContentBlock[];
  }>;
  temperature?: number;
  tools?: Array<{
    name: string;
    description?: string;
    input_schema: Record<string, unknown>;
  }>;
  tool_choice?:
    | { type: "auto" }
    | { type: "any" }
    | { type: "tool"; name: string }
    | { type: "none" };
}

function requireApiKey(explicit?: string): string {
  const key = explicit || process.env.XAI_API_KEY;
  if (!key) {
    throw new Error("XAI_API_KEY is missing. Cannot call Grok.");
  }
  return key;
}

export function createOpenAIClient(apiKey?: string): OpenAI {
  return new OpenAI({
    apiKey: requireApiKey(apiKey),
    baseURL: XAI_BASE_URL,
    timeout: 3600_000,
  });
}

function contentToOpenAI(
  content: string | ContentBlock[]
): string | ChatCompletionContentPart[] {
  if (typeof content === "string") return content;

  const parts: ChatCompletionContentPart[] = [];
  for (const block of content) {
    if (block.type === "text" && typeof block.text === "string") {
      parts.push({ type: "text", text: block.text });
      continue;
    }

    if (block.type === "image" && block.source && typeof block.source === "object") {
      const source = block.source as {
        type?: string;
        media_type?: string;
        data?: string;
      };
      if (source.data && source.media_type) {
        parts.push({
          type: "image_url",
          image_url: {
            url: `data:${source.media_type};base64,${source.data}`,
          },
        });
        continue;
      }
    }

    if (block.type === "document" && block.source && typeof block.source === "object") {
      // PDFs should use uploadXaiFile + respondWithFiles (Responses API).
      // Fallback: note that a document was provided.
      parts.push({
        type: "text",
        text: "[Document attachment provided — use Files API / respondWithFiles for PDF analysis]",
      });
      continue;
    }

    // Fallback: stringify unknown blocks so the model still sees something.
    parts.push({ type: "text", text: JSON.stringify(block) });
  }

  return parts.length === 1 && parts[0].type === "text"
    ? parts[0].text
    : parts;
}

function toOpenAIMessages(
  messages: MessageCreateParams["messages"]
): ChatCompletionMessageParam[] {
  return messages.map((m) => ({
    role: m.role,
    content: contentToOpenAI(m.content),
  })) as ChatCompletionMessageParam[];
}

function toOpenAITools(
  tools: MessageCreateParams["tools"]
): ChatCompletionTool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

function toOpenAIToolChoice(
  toolChoice: MessageCreateParams["tool_choice"]
):
  | OpenAI.Chat.ChatCompletionToolChoiceOption
  | undefined {
  if (!toolChoice) return undefined;
  if (toolChoice.type === "auto") return "auto";
  if (toolChoice.type === "none") return "none";
  if (toolChoice.type === "any") return "required";
  if (toolChoice.type === "tool") {
    return { type: "function", function: { name: toolChoice.name } };
  }
  return undefined;
}

function fromOpenAIResponse(
  completion: OpenAI.Chat.ChatCompletion
): MessageResponse {
  const choice = completion.choices[0];
  const message = choice?.message;
  const content: ContentBlock[] = [];

  if (message?.content) {
    content.push({ type: "text", text: message.content });
  }

  for (const call of message?.tool_calls || []) {
    if (call.type !== "function") continue;
    let input: unknown = {};
    try {
      input = JSON.parse(call.function.arguments || "{}");
    } catch {
      input = { raw: call.function.arguments };
    }
    content.push({
      type: "tool_use",
      id: call.id,
      name: call.function.name,
      input,
    });
  }

  const stop =
    choice?.finish_reason === "tool_calls"
      ? "tool_use"
      : choice?.finish_reason === "length"
        ? "max_tokens"
        : choice?.finish_reason || null;

  return {
    content,
    stop_reason: stop,
    usage: {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * Messages-shaped client used by existing automation call sites.
 * `new LlmClient()` / `new LlmClient({ apiKey })` uses XAI_API_KEY.
 */
export class LlmClient {
  private openai: OpenAI;

  constructor(options?: { apiKey?: string } | string) {
    const apiKey =
      typeof options === "string" ? options : options?.apiKey;
    this.openai = createOpenAIClient(apiKey);
  }

  messages = {
    create: async (params: MessageCreateParams): Promise<MessageResponse> => {
      const completion = await this.openai.chat.completions.create({
        model: params.model || MODELS.CONTENT,
        max_tokens: params.max_tokens,
        temperature: params.temperature,
        messages: toOpenAIMessages(params.messages),
        tools: toOpenAITools(params.tools),
        tool_choice: toOpenAIToolChoice(params.tool_choice),
      });
      return fromOpenAIResponse(completion);
    },

    stream: (params: MessageCreateParams) => {
      const openai = this.openai;
      return {
        async finalMessage(): Promise<MessageResponse> {
          const stream = await openai.chat.completions.create({
            model: params.model || MODELS.CONTENT,
            max_tokens: params.max_tokens,
            temperature: params.temperature,
            messages: toOpenAIMessages(params.messages),
            tools: toOpenAITools(params.tools),
            tool_choice: toOpenAIToolChoice(params.tool_choice),
            stream: true,
            stream_options: { include_usage: true },
          });

          let text = "";
          const toolCalls = new Map<
            number,
            { id: string; name: string; arguments: string }
          >();
          let finishReason: string | null = null;
          let inputTokens = 0;
          let outputTokens = 0;

          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            if (choice?.finish_reason) finishReason = choice.finish_reason;
            const delta = choice?.delta;
            if (delta?.content) text += delta.content;
            for (const tc of delta?.tool_calls || []) {
              const existing = toolCalls.get(tc.index) || {
                id: "",
                name: "",
                arguments: "",
              };
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              toolCalls.set(tc.index, existing);
            }
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
              outputTokens = chunk.usage.completion_tokens ?? outputTokens;
            }
          }

          const content: ContentBlock[] = [];
          if (text) content.push({ type: "text", text });
          for (const call of toolCalls.values()) {
            let input: unknown = {};
            try {
              input = JSON.parse(call.arguments || "{}");
            } catch {
              input = { raw: call.arguments };
            }
            content.push({
              type: "tool_use",
              id: call.id || `tool_${call.name}`,
              name: call.name,
              input,
            });
          }

          return {
            content,
            stop_reason:
              finishReason === "tool_calls"
                ? "tool_use"
                : finishReason === "length"
                  ? "max_tokens"
                  : finishReason,
            usage: { input_tokens: inputTokens, output_tokens: outputTokens },
          };
        },
      };
    },
  };
}

/** Default export for `import LlmClient from "./llm"` usage. */
export default LlmClient;

export function hasLlmApiKey(): boolean {
  return Boolean(process.env.XAI_API_KEY);
}
