import { z } from "zod";

export const stages = [
  { id: "new", label: "Новые", color: "#8192a8", probability: 0.1 },
  { id: "contact", label: "Первый контакт", color: "#6c8ceb", probability: 0.25 },
  { id: "proposal", label: "Предложение", color: "#a18ae0", probability: 0.5 },
  { id: "negotiation", label: "Переговоры", color: "#e7ae61", probability: 0.75 },
  { id: "won", label: "Успешно", color: "#319b81", probability: 1 },
  { id: "lost", label: "Закрыто без сделки", color: "#c37c83", probability: 0 },
] as const;
export type Stage = typeof stages[number]["id"];
export type Client = { id: string; name: string; company: string; email: string; phone: string; source: string; notes: string; createdAt: string };
export type Deal = { id: string; clientId: string; title: string; amount: number; status: Stage; nextStep: string; dueDate: string; closedAt: string | null; createdAt: string; updatedAt: string };
export type Task = { id: string; dealId: string | null; title: string; dueDate: string; done: boolean; createdAt: string };
export type Activity = { id: string; kind: string; title: string; detail: string; createdAt: string };
export type CrmData = { clients: Client[]; deals: Deal[]; tasks: Task[]; activities: Activity[]; workspace: { name: string; salesGoal: number }; user: { name: string; email: string; isDemo: boolean } };

const line = z.string().trim().max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату").refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Некорректная дата");
export const clientSchema = z.object({ name: line.min(2, "Укажите имя клиента"), company: line.min(2, "Укажите компанию"), email: z.union([z.literal(""), z.string().email("Проверьте email").max(254)]), phone: z.string().trim().max(40), source: z.enum(["Сайт", "Рекомендация", "Соцсети", "Реклама", "Другое"]), notes: z.string().trim().max(4000) });
export const dealSchema = z.object({ clientId: z.string().uuid(), title: line.min(2, "Укажите название сделки"), amount: z.number().int().min(0).max(1000000000), status: z.enum(["new", "contact", "proposal", "negotiation", "won", "lost"]), nextStep: z.string().trim().max(500), dueDate: date });
export const taskSchema = z.object({ title: line.min(2, "Укажите задачу"), dueDate: date, dealId: z.string().uuid().nullable().optional(), done: z.boolean().optional() });
export const settingsSchema = z.object({ name: line.min(2, "Укажите название команды"), salesGoal: z.number().int().min(1).max(1000000000) });

export function localDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function money(value: number, compact = false): string {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0, ...(compact ? { notation: "compact" as const } : {}) }).format(value);
}
export function analytics(deals: Deal[], days = 30, now = new Date()) {
  const end = new Date(`${localDate(now)}T23:59:59+03:00`).getTime();
  const start = end - days * 86400000 + 1;
  const closed = deals.filter(d => d.closedAt && new Date(d.closedAt).getTime() >= start && new Date(d.closedAt).getTime() <= end);
  const won = closed.filter(d => d.status === "won");
  const active = deals.filter(d => !["won", "lost"].includes(d.status));
  return { revenue: won.reduce((s, d) => s + d.amount, 0), won: won.length, active: active.length, pipeline: active.reduce((s, d) => s + d.amount, 0), average: won.length ? Math.round(won.reduce((s, d) => s + d.amount, 0) / won.length) : 0, conversion: closed.length ? Math.round(won.length / closed.length * 100) : 0, forecast: Math.round(active.reduce((s, d) => s + d.amount * (stages.find(x => x.id === d.status)?.probability ?? 0), 0)) };
}
export function revenueSeries(deals: Deal[], days = 30, now = new Date()) {
  const today = new Date(`${localDate(now)}T12:00:00+03:00`);
  const buckets = Math.min(days, 12);
  return Array.from({ length: buckets }, (_, i) => {
    const from = new Date(today); from.setDate(from.getDate() - days + 1 + Math.floor(i * days / buckets));
    const to = new Date(today); to.setDate(to.getDate() - days + 1 + Math.floor((i + 1) * days / buckets) - 1);
    const a = localDate(from), b = localDate(to);
    return { date: from.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" }), value: deals.filter(d => d.status === "won" && d.closedAt && localDate(new Date(d.closedAt)) >= a && localDate(new Date(d.closedAt)) <= b).reduce((s, d) => s + d.amount, 0) };
  });
}
