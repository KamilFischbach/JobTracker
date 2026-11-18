import { type LlmClient, LlmUnavailableError } from './llm.js';

/**
 * Settings for {@link createOpenAiCompatibleClient}.
 */
export type OpenAiCompatibleOptions = {
  /** API root, e.g. `https://api.groq.com/openai/v1`. */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** For reasoning models (e.g. `openai/gpt-oss-20b`); fewer tokens when low. */
  reasoningEffort?: 'low' | 'medium' | 'high' | undefined;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

type ChatCompletion = {
  choices?: { message?: { content?: string | null } }[];
  error?: { code?: string; message?: string; failed_generation?: string };
};

/**
 * LLM client for OpenAI-compatible chat APIs (Groq, OpenRouter, ...). Asks for
 * strict JSON-schema output, which the provider enforces while generating.
 *
 * @param {OpenAiCompatibleOptions} options  Endpoint, key and model.
 * @returns {LlmClient}                      The client.
 */
export function createOpenAiCompatibleClient({
  baseUrl,
  apiKey,
  model,
  reasoningEffort,
  timeoutMs = 60_000,
  fetchFn = fetch,
}: OpenAiCompatibleOptions): LlmClient {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  return {
    async generateJson({ messages, schema }) {
      let response: Response;
      try {
        response = await fetchFn(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            model,
            messages,
            temperature: 0,
            max_completion_tokens: 2048,
            ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'job_offer', strict: true, schema },
            },
          }),
        });
      } catch (error) {
        const timedOut =
          error instanceof Error && error.name === 'TimeoutError';
        throw new LlmUnavailableError(
          timedOut
            ? 'The AI model took too long to answer.'
            : 'Cannot reach the AI service. Try again later.',
        );
      }

      const body = (await response.json().catch(() => ({}))) as ChatCompletion;

      if (response.ok) return body.choices?.[0]?.message?.content ?? '';

      // The model's output broke the schema: hand it back, so the caller
      // can show the model its mistake and retry.
      if (response.status === 400 && body.error?.code === 'json_validate_failed') {
        return body.error.failed_generation ?? '';
      }
      if (response.status === 429) {
        const seconds = Number(response.headers.get('retry-after'));
        throw new LlmUnavailableError(
          Number.isFinite(seconds) && seconds > 0 && seconds <= 600
            ? `The AI service is busy. Try again in ${Math.ceil(seconds)} seconds.`
            : 'The AI service is busy. Try again in a minute.',
        );
      }
      if (response.status === 401 || response.status === 403) {
        console.error(`The LLM provider rejected the API key (HTTP ${response.status}). Check LLM_API_KEY.`);
        throw new LlmUnavailableError('The AI import is not configured correctly.');
      }
      console.error(
        `The LLM provider answered HTTP ${response.status}: ${body.error?.message ?? 'no message'}`,
      );
      throw new LlmUnavailableError(
        `The AI service returned an error (HTTP ${response.status}). Try again later.`,
      );
    },
  };
}
