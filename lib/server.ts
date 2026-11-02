import { cookies } from "next/headers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { activities, demoSessions, workspaces } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { ZodError } from "zod";

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function tokenHash(token: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))).map(x => x.toString(16).padStart(2, "0")).join(""); }
export async function context() {
  const db = getDb();
  // A demo cookie takes precedence so a signed-in visitor can use an isolated sandbox.
  const token = (await cookies()).get("delo_demo")?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const [session] = await db.select().from(demoSessions).where(and(eq(demoSessions.tokenHash, await tokenHash(token)), gt(demoSessions.expiresAt, new Date().toISOString()))).limit(1);
    if (session) {
      const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, session.workspaceId)).limit(1);
      if (workspace) return { workspace, user: { name: "Александр", email: "demo@example.com", isDemo: true } };
    }
  }
  const user = await getChatGPTUser();
  if (!user) throw new ApiError(401, "Войдите или откройте демоверсию");
  let [workspace] = await db.select().from(workspaces).where(eq(workspaces.ownerId, user.userId)).limit(1);
  if (!workspace) {
    await db.insert(workspaces).values({ id: crypto.randomUUID(), ownerId: user.userId, name: "Моя команда", createdAt: new Date().toISOString() }).onConflictDoNothing();
    [workspace] = await db.select().from(workspaces).where(eq(workspaces.ownerId, user.userId)).limit(1);
  }
  return { workspace, user: { name: user.displayName, email: user.email, isDemo: false } };
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new ApiError(403, "Недопустимый источник запроса");
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "Ожидается JSON");
}
export async function readJson(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 20000) throw new ApiError(413, "Слишком большой запрос");
  const body = await request.text();
  if (body.length > 20000) throw new ApiError(413, "Слишком большой запрос");
  try { return JSON.parse(body); } catch { throw new ApiError(400, "Некорректный JSON"); }
}
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
export async function handle(fn: () => Promise<Response>) {
  try { return await fn(); } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError) return json({ error: error.issues[0]?.message ?? "Проверьте поля формы" }, 400);
    console.error("CRM request failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Не удалось выполнить запрос. Попробуйте ещё раз." }, 500);
  }
}
export function activity(workspaceId: string, kind: string, title: string, detail = "") {
  return getDb().insert(activities).values({ id: crypto.randomUUID(), workspaceId, kind, title, detail, createdAt: new Date().toISOString() });
}
