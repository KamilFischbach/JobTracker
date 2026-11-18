import type { z } from 'zod';

/**
 * Request input did not match its schema. The error handler answers it with
 * `400 { message, errors }`, where `message` is the first issue.
 */
export class InvalidInputError extends Error {
  readonly issues: z.ZodError['issues'];

  constructor(issues: z.ZodError['issues']) {
    super(issues[0]?.message ?? 'Invalid input.');
    this.issues = issues;
  }
}

/**
 * Validates request input against a Zod schema.
 *
 * @param {T}       schema  Schema the input must match.
 * @param {unknown} input   Usually `request.body`.
 * @returns {z.output<T>}   The parsed (trimmed, transformed) input.
 * @throws {InvalidInputError}  When the input does not match.
 */
export function parseInput<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new InvalidInputError(parsed.error.issues);
  return parsed.data;
}
