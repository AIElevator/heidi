import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from '@/lib/system-prompt';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const apiMessages: Anthropic.MessageParam[] =
    messages.length === 0
      ? [{ role: 'user', content: '[Begin]' }]
      : messages;

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1536,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: apiMessages,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const clean = event.delta.text
              .replace(/ — /g, ', ')   // em dash with spaces → comma
              .replace(/—/g, ', ')      // em dash without spaces → comma
              .replace(/ – /g, ', ')    // en dash with spaces → comma
              .replace(/–/g, ', ');     // en dash without spaces → comma
            controller.enqueue(encoder.encode(clean));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
