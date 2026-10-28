export class LlmUnavailableError extends Error {}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

// Small interface so the model provider can be swapped (or mocked in tests).
export type LlmClient = {
  generateJson(input: {
    messages: ChatMessage[];
    schema: object;
  }): Promise<string>;
};

type OllamaOptions = {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
};

export function createOllamaClient({
  baseUrl,
  model,
  timeoutMs = 120_000,
}: OllamaOptions): LlmClient {
  return {
    async generateJson({ messages, schema }) {
      let response: Response;
      try {
        response = await fetch(new URL('/api/chat', baseUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            model,
            messages,
            stream: false,
            // Ollama constrains the output to this JSON schema.
            format: schema,
            options: { temperature: 0 },
          }),
        });
      } catch (error) {
        const timedOut =
          error instanceof Error && error.name === 'TimeoutError';
        throw new LlmUnavailableError(
          timedOut
            ? 'The AI model took too long to answer.'
            : `Cannot reach Ollama at ${baseUrl}. Is it running?`,
        );
      }

      if (response.status === 404) {
        throw new LlmUnavailableError(
          `Model "${model}" is not installed. Run: ollama pull ${model}`,
        );
      }
      if (!response.ok) {
        throw new LlmUnavailableError(
          `Ollama returned an error (HTTP ${response.status}).`,
        );
      }

      const body = (await response.json()) as {
        message?: { content?: string };
      };
      return body.message?.content ?? '';
    },
  };
}
