/**
 * The logged-in user, as returned by `GET /auth/me`.
 */
export type AuthUser = {
  id: string;
  /** Null for temporary demo accounts. */
  email: string | null;
  isDemo: boolean;
};
