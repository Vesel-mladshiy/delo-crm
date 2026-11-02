import { getDb } from "@/db";
import { activities, clients, deals, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { localDate, type Stage } from "./domain";

const companies = [
  ["Анна Смирнова", "Студия «Лес и форма»", "Сайт"], ["Михаил Волков", "Кофейня «Среда»", "Рекомендация"],
  ["Елена Кузнецова", "Bloom & Co", "Соцсети"], ["Дмитрий Соколов", "Архитектурное бюро LINE", "Сайт"],
  ["Мария Попова", "Отель «Тихий берег»", "Реклама"], ["Артём Лебедев", "Nord Furniture", "Рекомендация"],
  ["Ольга Орлова", "Пекарня «Хлебная»", "Сайт"], ["Иван Петров", "Бренд одежды SIMPLE", "Соцсети"],
  ["Анастасия Белова", "Цветочная «Ветка»", "Рекомендация"], ["Сергей Морозов", "Клиника «Баланс»", "Реклама"],
  ["Виктория Зайцева", "Книжный «Лист»", "Сайт"], ["Андрей Новиков", "Технологии «Вектор»", "Сайт"],
] as const;

export function seedStatements(workspaceId: string) {
  const db = getDb(), now = new Date();
  const relative = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() + offset); return d; };
  const clientRows = companies.map((c, i) => ({ id: crypto.randomUUID(), workspaceId, name: c[0], company: c[1], email: `contact${i + 1}@example.com`, phone: `+7 (000) 000-${String(i + 1).padStart(2, "0")}-00`, source: c[2], notes: i === 0 ? "Интересует сайт и фирменный стиль. Предпочитает общение по почте." : "Демонстрационные данные. Все контакты вымышлены.", createdAt: relative(-45 + i).toISOString() }));
  const titles = ["Сайт и фирменный стиль", "Айдентика кофейни", "Интернет-магазин цветов", "Сайт архитектурного бюро", "Редизайн сайта отеля", "Каталог мебели", "Упаковка и айдентика", "Лендинг новой коллекции", "Сайт цветочной студии", "Сайт клиники", "Лендинг книжного", "Корпоративный сайт", "Сезонная кампания", "Меню и навигация", "Поддержка магазина", "Презентация проектов", "Дизайн бронирования", "Рекламная кампания", "Фотосъёмка каталога", "Новая коллекция"];
  const statuses: Stage[] = ["negotiation", "proposal", "contact", "new", "negotiation", "proposal", "contact", "new", "won", "won", "won", "won", "new", "contact", "proposal", "new", "won", "won", "lost", "lost"];
  const amounts = [240000, 185000, 125000, 320000, 280000, 165000, 95000, 150000, 86000, 210000, 65000, 180000, 75000, 45000, 48000, 110000, 145000, 98000, 42000, 72000];
  const closedOffsets = [0, 0, 0, 0, 0, 0, 0, 0, -2, -6, -10, -15, 0, 0, 0, 0, -21, -26, -8, -19];
  const dealRows = titles.map((title, i) => ({ id: crypto.randomUUID(), workspaceId, clientId: clientRows[i % 12].id, title, amount: amounts[i], status: statuses[i], nextStep: ["Обсудить финальные правки", "Отправить предложение", "Уточнить задачу на созвоне", "Связаться с клиентом"][i % 4], dueDate: localDate(relative(i % 5 - 1)), closedAt: ["won", "lost"].includes(statuses[i]) ? relative(closedOffsets[i]).toISOString() : null, createdAt: relative(-40 + i).toISOString(), updatedAt: relative(-(i % 4)).toISOString() }));
  const taskRows = [
    { title: "Отправить договор Анне", dealId: dealRows[0].id, dueDate: localDate(now) },
    { title: "Презентовать концепцию для «Среды»", dealId: dealRows[1].id, dueDate: localDate(now) },
    { title: "Созвон с Bloom & Co", dealId: dealRows[2].id, dueDate: localDate(relative(1)) },
    { title: "Подготовить предложение для LINE", dealId: dealRows[3].id, dueDate: localDate(relative(2)) },
    { title: "Запросить материалы у отеля", dealId: dealRows[4].id, dueDate: localDate(relative(-1)) },
  ].map(t => ({ ...t, id: crypto.randomUUID(), workspaceId, done: false, createdAt: now.toISOString() }));
  // D1 accepts at most 100 bound parameters in an individual statement.
  return [db.insert(clients).values(clientRows.slice(0, 6)), db.insert(clients).values(clientRows.slice(6)), db.insert(deals).values(dealRows.slice(0, 7)), db.insert(deals).values(dealRows.slice(7, 14)), db.insert(deals).values(dealRows.slice(14)), db.insert(tasks).values(taskRows), db.insert(activities).values([{ id: crypto.randomUUID(), workspaceId, kind: "won", title: "Сделка с «Веткой» завершена", detail: "Сайт цветочной студии · 86 000 ₽", createdAt: relative(-2).toISOString() }, { id: crypto.randomUUID(), workspaceId, kind: "demo", title: "Ваша демоверсия готова", detail: "12 клиентов и 20 сделок — можно пробовать всё", createdAt: now.toISOString() }])] as const;
}

export async function resetDemo(workspaceId: string) {
  const db = getDb();
  await db.batch([db.delete(tasks).where(eq(tasks.workspaceId, workspaceId)), db.delete(deals).where(eq(deals.workspaceId, workspaceId)), db.delete(clients).where(eq(clients.workspaceId, workspaceId)), db.delete(activities).where(eq(activities.workspaceId, workspaceId)), ...seedStatements(workspaceId)]);
}
