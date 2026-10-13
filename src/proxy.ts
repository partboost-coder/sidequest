import { NextResponse } from "next/server";

import { devRoutesEnabled } from "@/lib/devRoutes";

/**
 * Next 16 proxy (formerly middleware). Currently only gates the dev harness: /dev/* and
 * /api/dev/* return a real 404 unless DEV_ROUTES is enabled (default: off in production).
 * Supabase session refresh is added in v0.2.0 item 212, as a no-op unless SESSION_MODE=supabase.
 */
export function proxy() {
  if (!devRoutesEnabled()) return new NextResponse("Not Found", { status: 404 });
  return NextResponse.next();
}

export const config = {
  matcher: ["/dev/:path*", "/api/dev/:path*"],
};
