/**
 * A failed API request, with the server's `message` and optional `code`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Turns an error response into an {@link ApiError}, using the server's
 * `{ message, code }` body when there is one.
 *
 * @param {Response} response  The failed response.
 * @param {string}   fallback  Message when the body has none, e.g. "Could not load applications".
 * @returns {Promise<ApiError>} The error, ready to throw.
 */
export async function toApiError(
  response: Response,
  fallback: string,
): Promise<ApiError> {
  const text = await response.text().catch(() => '');
  try {
    const body = JSON.parse(text) as { message?: unknown; code?: unknown };
    return new ApiError(
      typeof body.message === 'string'
        ? body.message
        : `${fallback} (${response.status}).`,
      response.status,
      typeof body.code === 'string' ? body.code : null,
    );
  } catch {
    return new ApiError(
      text && text.length < 200 ? text : `${fallback} (${response.status}).`,
      response.status,
    );
  }
}

/**
 * Whether the error means the session is gone (expired, logged out
 * elsewhere), so the user must log in again. A wrong password at login is
 * also a 401 but has another code.
 *
 * @param {unknown} error  Any thrown value.
 * @returns {boolean}
 */
export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'UNAUTHENTICATED';
}
