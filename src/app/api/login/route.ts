import { cookies } from "next/headers";
import { isConfigured, SESSION_COOKIE, sessionToken, userForCode } from "@/lib/server/auth";

export async function POST(request: Request) {
  if (!isConfigured()) {
    return Response.json({ error: "not-configured" }, { status: 500 });
  }
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  const user = code ? userForCode(code) : null;
  if (!user) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return Response.json({ error: "wrong-code" }, { status: 401 });
  }
  (await cookies()).set(SESSION_COOKIE, sessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return Response.json({ ok: true, user });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
