import { cookies } from "next/headers";
import { getDb } from "@/db";
import { demoSessions, workspaces } from "@/db/schema";
import { seedStatements } from "@/lib/seed";
import { ApiError, checkOrigin, context, handle, json, readJson, tokenHash } from "@/lib/server";
import { eq, lt, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";
export async function GET() { return handle(async () => { const { workspace, user } = await context(); return json({ workspace: { name: workspace.name }, user }); }); }
export async function POST(request: Request) {
  return handle(async () => {
    checkOrigin(request);
    const body = await readJson(request);
    if (body.action !== "demo") throw new ApiError(400, "Неизвестное действие");
    try { const current = await context(); if (current.user.isDemo) return json({ ok: true }); } catch (e) { if (!(e instanceof ApiError) || e.status !== 401) throw e; }
    const db = getDb(), id = crypto.randomUUID();
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x => x.toString(16).padStart(2, "0")).join("");
    const now = new Date(), expires = new Date(now.getTime() + 7 * 86400000);
    // Bounded lazy cleanup. Real user workspaces are never selected here.
    const expired = await db.select({ workspaceId: demoSessions.workspaceId }).from(demoSessions).where(lt(demoSessions.expiresAt, now.toISOString())).limit(20);
    if (expired.length) await db.delete(workspaces).where(inArray(workspaces.id, expired.map(s => s.workspaceId)));
    await db.batch([db.insert(workspaces).values({ id, ownerId: `demo:${id}`, name: "Студия «Форма»", createdAt: now.toISOString() }), db.insert(demoSessions).values({ tokenHash: await tokenHash(token), workspaceId: id, expiresAt: expires.toISOString() }), ...seedStatements(id)]);
    (await cookies()).set("delo_demo", token, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 7 * 86400 });
    return json({ ok: true }, 201);
  });
}
export async function DELETE(request: Request) {
  return handle(async () => {
    checkOrigin(request);
    const jar = await cookies(), token = jar.get("delo_demo")?.value;
    if (token) {
      const db = getDb();
      const [session] = await db.select().from(demoSessions).where(eq(demoSessions.tokenHash, await tokenHash(token))).limit(1);
      if (session) await db.delete(workspaces).where(eq(workspaces.id, session.workspaceId));
    }
    jar.set("delo_demo", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return json({ ok: true });
  });
}
