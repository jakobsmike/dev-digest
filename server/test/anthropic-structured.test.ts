/**
 * AnthropicProvider.completeStructured — the tool_choice regression.
 *
 * Forcing the tool (`{type:'tool'}` / `{type:'any'}`) is rejected outright by
 * newer models:
 *   400 tool_choice: type "tool" and "any" are not supported for this model
 * so the adapter asks with `auto` and tolerates a model that answers in prose
 * instead of calling the tool. Hermetic: the Anthropic client is injected.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { AnthropicProvider, structuredPayload } from '../src/adapters/llm/anthropic.js';

const Answer = z.object({ verdict: z.string(), score: z.number() });
const ANSWER = { verdict: 'approve', score: 91 };

/** A stub Anthropic client that replays canned responses and records requests. */
function stubClient(responses: Partial<Anthropic.Message>[]) {
  const requests: Record<string, unknown>[] = [];
  let i = 0;
  const client = {
    messages: {
      create: async (body: Record<string, unknown>) => {
        requests.push(body);
        const res = responses[Math.min(i, responses.length - 1)]!;
        i += 1;
        return { usage: { input_tokens: 10, output_tokens: 5 }, ...res };
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}

const toolUse = (input: unknown) => ({
  content: [{ type: 'tool_use', id: 't1', name: 'Answer', input }],
});
const text = (s: string) => ({ content: [{ type: 'text', text: s }] });

function provider(responses: Partial<Anthropic.Message>[]) {
  const { client, requests } = stubClient(responses);
  return { llm: new AnthropicProvider('test-key', client), requests };
}

const request = { model: 'claude-opus-5-5', schema: Answer, schemaName: 'Answer', messages: [{ role: 'user' as const, content: 'review it' }] };

describe('AnthropicProvider — tool_choice', () => {
  it('never forces the tool choice', async () => {
    const { llm, requests } = provider([toolUse(ANSWER) as Partial<Anthropic.Message>]);

    await llm.completeStructured(request);

    // The exact values the API rejects. Asserting the negative is the point:
    // this is a regression guard, not a description of the happy path.
    expect(requests[0]!.tool_choice).toEqual({ type: 'auto' });
    expect(requests[0]!.tool_choice).not.toMatchObject({ type: 'tool' });
    expect(requests[0]!.tool_choice).not.toMatchObject({ type: 'any' });
  });

  it('still offers exactly one tool, so `auto` has an obvious choice', async () => {
    const { llm, requests } = provider([toolUse(ANSWER) as Partial<Anthropic.Message>]);

    await llm.completeStructured(request);

    expect(requests[0]!.tools).toHaveLength(1);
    expect((requests[0]!.tools as { name: string }[])[0]!.name).toBe('Answer');
  });
});

describe('AnthropicProvider — reading the answer back', () => {
  it('reads a tool_use block', async () => {
    const { llm } = provider([toolUse(ANSWER) as Partial<Anthropic.Message>]);
    const res = await llm.completeStructured(request);
    expect(res.data).toEqual(ANSWER);
    expect(res.attempts).toBe(1);
  });

  it('falls back to a text block when the model answered in prose', async () => {
    // What `auto` buys us, and the reason the fallback exists at all.
    const { llm } = provider([text(JSON.stringify(ANSWER)) as Partial<Anthropic.Message>]);
    const res = await llm.completeStructured(request);
    expect(res.data).toEqual(ANSWER);
  });

  it('reprompts when the first answer fails the schema, and reports the attempt count', async () => {
    const { llm, requests } = provider([
      toolUse({ verdict: 'approve' }) as Partial<Anthropic.Message>, // score missing
      toolUse(ANSWER) as Partial<Anthropic.Message>,
    ]);

    const res = await llm.completeStructured(request);

    expect(res.data).toEqual(ANSWER);
    expect(res.attempts).toBe(2);
    expect(requests).toHaveLength(2);
    // Tokens accumulate across attempts rather than reporting only the last.
    expect(res.tokensIn).toBe(20);
  });

  it('throws once the retries are spent', async () => {
    const { llm } = provider([toolUse({ verdict: 'approve' }) as Partial<Anthropic.Message>]);
    await expect(llm.completeStructured({ ...request, maxRetries: 1 })).rejects.toThrow(
      /schema validation/i,
    );
  });
});

describe('AnthropicProvider — temperature', () => {
  it('omits it for a model that rejects one', async () => {
    // 400 "`temperature` is deprecated for this model" on claude-opus-5-5.
    const { llm, requests } = provider([toolUse(ANSWER) as Partial<Anthropic.Message>]);
    await llm.completeStructured(request);
    expect(requests[0]).not.toHaveProperty('temperature');
  });

  it('still sends a deterministic 0 to the previous generation', async () => {
    // Dropping it everywhere would make a re-review of the same diff drift.
    const { llm, requests } = provider([toolUse(ANSWER) as Partial<Anthropic.Message>]);
    await llm.completeStructured({ ...request, model: 'claude-3-5-sonnet-latest' });
    expect(requests[0]!.temperature).toBe(0);
  });
});

describe('AnthropicProvider — re-prompting after a bad answer', () => {
  it('answers a tool_use with a tool_result carrying the same id', async () => {
    // A bare string here earns 400 "`tool_use` ids were found without
    // `tool_result` blocks", which kills the retry instead of retrying.
    const { llm, requests } = provider([
      toolUse({ verdict: 'approve' }) as Partial<Anthropic.Message>,
      toolUse(ANSWER) as Partial<Anthropic.Message>,
    ]);

    await llm.completeStructured(request);

    const followUp = (requests[1]!.messages as Anthropic.MessageParam[]).at(-1)!;
    expect(followUp.role).toBe('user');
    const block = (followUp.content as Anthropic.ContentBlockParam[])[0]!;
    expect(block).toMatchObject({ type: 'tool_result', tool_use_id: 't1', is_error: true });
  });

  it('uses plain text when the model answered in prose', () => {
    // No tool_use id exists to reference, so a tool_result would be invalid.
    const { llm, requests } = provider([
      text('not json at all') as Partial<Anthropic.Message>,
      toolUse(ANSWER) as Partial<Anthropic.Message>,
    ]);

    return llm.completeStructured(request).then(() => {
      const followUp = (requests[1]!.messages as Anthropic.MessageParam[]).at(-1)!;
      expect(typeof followUp.content).toBe('string');
    });
  });
});

describe('structuredPayload', () => {
  it('prefers the tool_use block when both are present', () => {
    expect(
      structuredPayload([
        { type: 'text', text: 'let me think' },
        { type: 'tool_use', id: 't1', name: 'Answer', input: ANSWER },
      ] as Anthropic.ContentBlock[]),
    ).toBe(JSON.stringify(ANSWER));
  });

  it('joins multiple text blocks so a split JSON body survives', () => {
    expect(
      structuredPayload([
        { type: 'text', text: '{"verdict":' },
        { type: 'text', text: '"approve"}' },
      ] as Anthropic.ContentBlock[]),
    ).toBe('{"verdict":"approve"}');
  });

  it('is empty when there is nothing to read', () => {
    expect(structuredPayload([] as Anthropic.ContentBlock[])).toBe('');
  });
});
