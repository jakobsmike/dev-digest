import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResult,
  StructuredRequest,
  StructuredResult,
  ChatMessage,
} from '@devdigest/shared';
import { withRetry, withTimeout } from '../../platform/resilience.js';
import { toJsonSchema, parseWithRepair } from '../../platform/structured.js';
import { estimateCost } from './pricing.js';
import { ExternalServiceError } from '../../platform/errors.js';

const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_MAX_TOKENS = 4096;

/** Anthropic has no embeddings API; embeddings come from the OpenAI Embedder. */
function splitSystem(messages: ChatMessage[]): {
  system: string;
  rest: Anthropic.MessageParam[];
} {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  return { system, rest };
}

/**
 * Newer Anthropic models carry a tier-first id (`claude-opus-5-5`) and reject
 * `temperature` outright — 400 "`temperature` is deprecated for this model".
 * The previous generation (`claude-3-5-sonnet-latest`, `claude-3-opus-latest`)
 * still accepts it, and a deterministic 0 is what keeps a re-review of the same
 * diff stable, so keep sending it there. Same shape as `tuningParams` in the
 * OpenAI adapter, which has this problem with GPT-5 and the o-series.
 */
function rejectsTemperature(model: string): boolean {
  return /^claude-(opus|sonnet|haiku)-\d/.test(model);
}

/** Temperature param appropriate for the model — `{}` when it refuses one. */
function tuningParams(model: string, temperature: number | undefined): Record<string, number> {
  return rejectsTemperature(model) ? {} : { temperature: temperature ?? 0 };
}

/**
 * Pull the structured payload out of a response.
 *
 * The tool call is the expected shape, but `tool_choice: auto` lets the model
 * answer in prose instead, so fall back to the text blocks: models asked for
 * JSON usually produce it, sometimes fenced. `parseWithRepair` handles the
 * fencing; this only has to find the candidate string.
 */
export function structuredPayload(content: Anthropic.ContentBlock[]): string {
  const toolUse = content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (toolUse) return JSON.stringify(toolUse.input);
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/**
 * Anthropic LLMProvider.
 * - listModels: dynamic via GET /models.
 * - completeStructured: single tool whose input_schema is our JSON schema, then
 *   parse tool_use.input, Zod validate + reprompt. `tool_choice` is `auto`, NOT
 *   forced — see the comment at the call site.
 * - embed: NOT supported (throws) — use the OpenAI Embedder for vectors.
 */
export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;
  private client: Anthropic;

  /** `client` is for tests only — production always goes through the container,
   *  which passes a key and nothing else. */
  constructor(apiKey: string, client?: Anthropic) {
    this.client = client ?? new Anthropic({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    return withRetry(async () => {
      // SDK 0.33 exposes models.list()
      const res = await this.client.models.list();
      return res.data.map((m) => ({
        id: m.id,
        provider: 'anthropic' as const,
        label: m.display_name,
      }));
    });
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    return withRetry(() => withTimeout(this.doComplete(req), req.timeoutMs ?? DEFAULT_TIMEOUT));
  }

  private async doComplete(req: CompletionRequest): Promise<CompletionResult> {
    const { system, rest } = splitSystem(req.messages);
    const res = await this.client.messages.create({
      model: req.model,
      system: system || undefined,
      messages: rest,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...tuningParams(req.model, req.temperature ?? 0.2),
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const tokensIn = res.usage.input_tokens;
    const tokensOut = res.usage.output_tokens;
    return {
      text,
      model: req.model,
      tokensIn,
      tokensOut,
      costUsd: estimateCost(req.model, tokensIn, tokensOut),
    };
  }

  async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const jsonSchema = toJsonSchema(req.schema, req.schemaName);
    const toolName = req.schemaName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const maxRetries = req.maxRetries ?? 2;
    const { system, rest } = splitSystem(req.messages);
    const messages: Anthropic.MessageParam[] = [...rest];
    let tokensIn = 0;
    let tokensOut = 0;
    let lastRaw = '';

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const res = await withRetry(() =>
        withTimeout(
          this.client.messages.create({
            model: req.model,
            system: system || undefined,
            messages,
            max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
            ...tuningParams(req.model, req.temperature),
            tools: [
              {
                name: toolName,
                description: `Return the result as ${req.schemaName}.`,
                input_schema: jsonSchema.schema as Anthropic.Tool.InputSchema,
              },
            ],
            // `auto`, never `tool` or `any`. Newer models reject a forced tool
            // choice outright — claude-opus-5-5 answers
            //   400 tool_choice: type "tool" and "any" are not supported for this model
            // — and since there is exactly one tool on offer and the prompt asks
            // for it, `auto` still yields a tool_use block in practice. When it
            // does not, structuredPayload() falls back to the text blocks.
            tool_choice: { type: 'auto' },
          }),
          req.timeoutMs ?? DEFAULT_TIMEOUT,
        ),
      );
      tokensIn += res.usage.input_tokens;
      tokensOut += res.usage.output_tokens;

      lastRaw = structuredPayload(res.content);

      const parsed = parseWithRepair(req.schema, lastRaw);
      if (parsed.ok) {
        return {
          data: parsed.data,
          model: req.model,
          tokensIn,
          tokensOut,
          costUsd: estimateCost(req.model, tokensIn, tokensOut),
          raw: lastRaw,
          attempts: attempt,
        };
      }
      // Re-prompt. When the model answered with a tool_use block, the API
      // REQUIRES the next user turn to open with a tool_result carrying that
      // same id — a bare string earns
      //   400 messages.N: `tool_use` ids were found without `tool_result` blocks
      // and the retry dies instead of retrying. Plain text is correct only when
      // the model replied in prose.
      const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: res.content });
      messages.push({
        role: 'user',
        content: toolUse
          ? [
              {
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: parsed.repromptMessage,
                is_error: true,
              },
            ]
          : parsed.repromptMessage,
      });
    }

    throw new ExternalServiceError('Anthropic structured output failed schema validation', {
      raw: lastRaw,
    });
  }

  async embed(): Promise<number[][]> {
    throw new ExternalServiceError(
      'Anthropic does not provide embeddings; use the OpenAI Embedder.',
    );
  }
}
