import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '@/lib/system-prompt';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Lazy — only instantiated if Anthropic is unavailable
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' });
  return _openai;
}

const encoder = new TextEncoder();

function stripDashes(text: string): string {
  return text
    .replace(/ — /g, ', ')
    .replace(/—/g, ', ')
    .replace(/ – /g, ', ')
    .replace(/–/g, ', ');
}

async function streamAnthropic(
  apiMessages: Anthropic.MessageParam[],
  controller: ReadableStreamDefaultController
): Promise<void> {
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1536,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: apiMessages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      controller.enqueue(encoder.encode(stripDashes(event.delta.text)));
    }
  }
}

async function streamOpenAI(
  apiMessages: Anthropic.MessageParam[],
  controller: ReadableStreamDefaultController
): Promise<void> {
  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...apiMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
    })),
  ];

  const stream = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1536,
    messages: openaiMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) controller.enqueue(encoder.encode(stripDashes(text)));
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  const apiMessages: Anthropic.MessageParam[] =
    messages.length === 0
      ? [{ role: 'user', content: '[Begin]' }]
      : messages;

  // Try Anthropic first; fall back to OpenAI if unavailable
  let usingFallback = false;
  try {
    await anthropic.models.retrieve('claude-sonnet-4-6');
  } catch {
    usingFallback = true;
  }

  const readable = new ReadableStream({
    async start(controller) {
      try {
        if (usingFallback) {
          await streamOpenAI(apiMessages, controller);
        } else {
          try {
            await streamAnthropic(apiMessages, controller);
          } catch {
            await streamOpenAI(apiMessages, controller);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
