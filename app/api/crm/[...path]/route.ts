import { and, desc, eq, count } from "drizzle-orm";
import { getDb } from "@/db";
import { activities, clients, deals, tasks, workspaces } from "@/db/schema";
import { clientSchema, dealSchema, settingsSchema, stages, taskSchema } from "@/lib/domain";
import { activity, ApiError, checkOrigin, context, handle, json, readJson } from "@/lib/server";
import { resetDemo } from "@/lib/seed";

export const dynamic = "force-dynamic";
type Route = { params: Promise<{ path: string[] }> };
export async function GET(_request: Request, route: Route) {
  return handle(async () => {
    const { path } = await route.params;
    if (path.join("/") !== "bootstrap") throw new ApiError(404, "Страница не найдена");
    const { workspace, user } = await context(), db = getDb();
    const [cs, ds, ts, ac] = await Promise.all([db.select().from(clients).where(eq(clients.workspaceId, workspace.id)).orderBy(desc(clients.createdAt)).limit(500), db.select().from(deals).where(eq(deals.workspaceId, workspace.id)).orderBy(desc(deals.updatedAt)).limit(1000), db.select().from(tasks).where(eq(tasks.workspaceId, workspace.id)).orderBy(tasks.dueDate).limit(500), db.select().from(activities).where(eq(activities.workspaceId, workspace.id)).orderBy(desc(activities.createdAt)).limit(30)]);
    return json({ clients: cs, deals: ds, tasks: ts, activities: ac, workspace: { name: workspace.name, salesGoal: workspace.salesGoal }, user });
  });
}
async function mutate(request: Request, route: Route, method: "POST" | "PATCH" | "DELETE") {
  return handle(async () => {
    checkOrigin(request);
    const { path } = await route.params, [resource, id] = path;
    const { workspace, user } = await context(), db = getDb(), ws = workspace.id;
    if (path.length > 2) throw new ApiError(404, "Неизвестный адрес");
    const body = method === "DELETE" ? {} : await readJson(request);
    if (resource === "reset" && method === "POST") {
      if (!user.isDemo) throw new ApiError(403, "Сброс доступен только в демоверсии");
      await resetDemo(ws); return json({ ok: true });
    }
    if (resource === "settings" && method === "PATCH") {
      const values = settingsSchema.parse(body);
      await db.update(workspaces).set(values).where(eq(workspaces.id, ws)); return json({ ok: true });
    }
    if (!["clients", "deals", "tasks"].includes(resource)) throw new ApiError(404, "Неизвестный адрес");
    if ((method === "POST" && id) || (method !== "POST" && !id)) throw new ApiError(400, "Некорректный адрес");
    const table = resource === "clients" ? clients : resource === "deals" ? deals : tasks;
    if (id) {
      const [existing] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.workspaceId, ws))).limit(1);
      if (!existing) throw new ApiError(404, "Запись не найдена");
    }
    if (method === "POST") {
      const [total] = await db.select({ n: count() }).from(table).where(eq(table.workspaceId, ws));
      const limit = resource === "deals" ? 1000 : 500;
      if (total.n >= limit) throw new ApiError(400, `Достигнут лимит: ${limit} записей`);
    }
    if (method === "DELETE") {
      await db.batch([db.delete(table).where(and(eq(table.id, id!), eq(table.workspaceId, ws))), activity(ws, "delete", "Запись удалена", resource === "clients" ? "Клиент и связанные сделки" : resource === "deals" ? "Сделка" : "Задача")]);
      return json({ ok: true });
    }
    const now = new Date().toISOString(), recordId = id ?? crypto.randomUUID();
    if (resource === "clients") {
      const values = clientSchema.parse(body);
      const query = method === "POST" ? db.insert(clients).values({ ...values, id: recordId, workspaceId: ws, createdAt: now }) : db.update(clients).set(values).where(and(eq(clients.id, recordId), eq(clients.workspaceId, ws)));
      await db.batch([query, activity(ws, "client", method === "POST" ? "Новый клиент" : "Клиент обновлён", values.company)]);
    } else if (resource === "deals") {
      const [old] = id ? await db.select().from(deals).where(and(eq(deals.id, id), eq(deals.workspaceId, ws))).limit(1) : [];
      const values = dealSchema.parse(old ? { ...old, ...body } : body);
      const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, values.clientId), eq(clients.workspaceId, ws))).limit(1);
      if (!client) throw new ApiError(400, "Выберите клиента вашей команды");
      const closedAt = ["won", "lost"].includes(values.status) ? old?.status === values.status ? old.closedAt : now : null;
      const query = method === "POST" ? db.insert(deals).values({ ...values, id: recordId, workspaceId: ws, closedAt, createdAt: now, updatedAt: now }) : db.update(deals).set({ ...values, closedAt, updatedAt: now }).where(and(eq(deals.id, recordId), eq(deals.workspaceId, ws)));
      await db.batch([query, activity(ws, values.status === "won" ? "won" : "deal", method === "POST" ? "Добавлена сделка" : old?.status !== values.status ? `Сделка → ${stages.find(s => s.id === values.status)?.label}` : "Сделка обновлена", values.title)]);
    } else {
      const [old] = id ? await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws))).limit(1) : [];
      const values = taskSchema.parse(old ? { ...old, ...body } : body);
      if (values.dealId) {
        const [deal] = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.id, values.dealId), eq(deals.workspaceId, ws))).limit(1);
        if (!deal) throw new ApiError(400, "Сделка не найдена");
      }
      const query = method === "POST" ? db.insert(tasks).values({ ...values, dealId: values.dealId ?? null, id: recordId, workspaceId: ws, createdAt: now }) : db.update(tasks).set(values).where(and(eq(tasks.id, recordId), eq(tasks.workspaceId, ws)));
      await db.batch([query, activity(ws, "task", values.done ? "Задача выполнена" : method === "POST" ? "Новая задача" : "Задача обновлена", values.title)]);
    }
    return json({ ok: true, id: recordId }, method === "POST" ? 201 : 200);
  });
}
export async function POST(request: Request, route: Route) { return mutate(request, route, "POST"); }
export async function PATCH(request: Request, route: Route) { return mutate(request, route, "PATCH"); }
export async function DELETE(request: Request, route: Route) { return mutate(request, route, "DELETE"); }
