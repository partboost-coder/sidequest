import { errorResponse } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";

/** GET /api/session → the current guest/user identity. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    return Response.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
