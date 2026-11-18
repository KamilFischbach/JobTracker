import type { ErrorRequestHandler } from 'express';

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
 * Last middleware of the app. Turns any error a route throws into a JSON
 * `{ message }` response, so the client never gets Express's HTML error page
 * (which also contains the stack trace).
 *
 * - Invalid request bodies (bad JSON, too large) keep their 4xx status.
 * - Prisma "record not found" (P2025) becomes 404.
 * - Anything else is logged and becomes 500 with a generic message.
 */
export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  // Too late to send JSON; let Express close the connection.
  if (response.headersSent) return next(error);

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
