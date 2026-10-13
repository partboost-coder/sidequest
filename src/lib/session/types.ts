/** The current user as the rest of the app sees it. Guests are real users with isAnonymous=true. */
export interface SessionUser {
  id: string;
  isAnonymous: boolean;
  /** Which backend produced this session (for diagnostics). */
  source: "dev" | "supabase";
}

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}
