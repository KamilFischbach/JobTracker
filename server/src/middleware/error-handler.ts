import type { ErrorRequestHandler } from 'express';
import { InvalidInputError } from '../routes/validation.js';
import {
  DemoAccountError,
  InvalidCredentialsError,
  InvalidLinkError,
  WrongPasswordError,
} from '../services/auth/auth-service.js';
import { CaptchaFailedError } from '../services/auth/captcha.js';
import { EmailDeliveryError } from '../services/auth/email-sender.js';
import { RateLimitedError } from './rate-limit.js';
import { UnauthenticatedError } from './require-auth.js';
import { ForbiddenOriginError } from './same-origin.js';
import { PageFetchError } from '../services/ai/fetch-page.js';
import { LlmUnavailableError } from '../services/ai/llm.js';
import {
  InvalidLlmOutputError,
  NotAJobOfferError,
} from '../services/ai/parse-offer.js';
import {
  ApplicationNotFoundError,
  InvalidSalaryRangeError,
} from '../services/applications/application-service.js';

type ErrorClass = new (...args: never[]) => Error;

// Errors that services throw on purpose, with messages written for the user,
// and how they are answered. `code` lets the client react to specific cases.
const KNOWN_ERRORS: { type: ErrorClass; status: number; code?: string }[] = [
  { type: UnauthenticatedError, status: 401, code: 'UNAUTHENTICATED' },
  { type: InvalidCredentialsError, status: 401, code: 'INVALID_CREDENTIALS' },
  { type: WrongPasswordError, status: 400, code: 'WRONG_PASSWORD' },
  { type: InvalidLinkError, status: 400, code: 'INVALID_LINK' },
  { type: CaptchaFailedError, status: 400, code: 'CAPTCHA_FAILED' },
  { type: DemoAccountError, status: 403, code: 'DEMO_ACCOUNT' },
  { type: ForbiddenOriginError, status: 403, code: 'FORBIDDEN_ORIGIN' },
  { type: RateLimitedError, status: 429, code: 'RATE_LIMITED' },
  { type: EmailDeliveryError, status: 503, code: 'EMAIL_UNAVAILABLE' },
  { type: ApplicationNotFoundError, status: 404 },
  { type: InvalidSalaryRangeError, status: 400 },
  { type: PageFetchError, status: 422, code: 'FETCH_FAILED' },
  { type: NotAJobOfferError, status: 422, code: 'NOT_A_JOB_OFFER' },
  { type: InvalidLlmOutputError, status: 502, code: 'AI_INVALID_OUTPUT' },
  { type: LlmUnavailableError, status: 503, code: 'AI_UNAVAILABLE' },
];

type HttpError = Error & { status?: number; expose?: boolean; type?: string };

function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && 'status' in error;
}

// A record that a query needed was deleted in the meantime, e.g. between
// the existence check and the update in PATCH /applications/:id.
function isRecordNotFound(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2025'
  );
}

/**
 * Last middleware of the app: turns every error into a JSON response, so
 * routes only delegate to services and never build error responses.
 *
 * - Invalid input: 400 `{ message, errors }`.
 * - Known service errors: their status, `{ code?, message }`.
 * - Invalid request bodies (bad JSON, too large) keep their 4xx status.
 * - Prisma "record not found" (P2025): 404.
 * - Anything else is logged and becomes 500 with a generic message, so the
 *   client never gets Express's HTML page with the stack trace.
 */
export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  // Too late to send JSON; let Express close the connection.
  if (response.headersSent) return next(error);

  if (error instanceof InvalidInputError) {
    return response
      .status(400)
      .json({ message: error.message, errors: error.issues });
  }

  const known = KNOWN_ERRORS.find(({ type }) => error instanceof type);
  if (known) {
    return response.status(known.status).json({
      ...(known.code ? { code: known.code } : {}),
      message: (error as Error).message,
    });
  }

  if (isHttpError(error) && error.expose && error.status && error.status < 500) {
    const message =
      error.type === 'entity.parse.failed'
        ? 'The request body is not valid JSON.'
        : error.message;
    return response.status(error.status).json({ message });
  }

  if (isRecordNotFound(error)) {
    return response.status(404).json({ message: 'The record no longer exists.' });
  }

  console.error(error);
  return response
    .status(500)
    .json({ message: 'Something went wrong on the server. Try again.' });
};
