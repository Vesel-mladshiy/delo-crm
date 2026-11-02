"use client";
import { useState, type FormEvent } from "react";
import { CalendarDays, ExternalLink, Mail, Phone, Plus, Trash2 } from "lucide-react";
import { DialogShell, Field, Avatar, Badge } from "./crm-ui";
import { clientSchema, dealSchema, localDate, money, stages, taskSchema, type Client, type CrmData, type Deal, type Stage, type Task } from "@/lib/domain";

export type Editor = { type: "client"; record?: Client } | { type: "deal"; record?: Deal; clientId?: string; stage?: Stage } | { type: "task"; record?: Task; dealId?: string };
export type Mutation = (path: string, method: string, body?: unknown, message?: string) => Promise<boolean>;

export function EditorDialog({ editor, data, onClose, mutate, onOpen }: { editor: Editor; data: CrmData; onClose: () => void; mutate: Mutation; onOpen: (e: Editor) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const record = editor.record;
  const resource = editor.type === "client" ? "clients" : editor.type === "deal" ? "deals" : "tasks";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const raw = editor.type === "client" ? values : editor.type === "deal" ? { ...values, amount: Number(values.amount) } : { ...values, dealId: values.dealId || null, done: editor.record?.done ?? false };
    const result = (editor.type === "client" ? clientSchema : editor.type === "deal" ? dealSchema : taskSchema).safeParse(raw);
    if (!result.success) { setError(result.error.issues[0].message); return; }
    setBusy(true);
    const ok = await mutate(`${resource}${record ? `/${record.id}` : ""}`, record ? "PATCH" : "POST", result.data, record ? "Изменения сохранены" : editor.type === "client" ? "Клиент добавлен" : editor.type === "deal" ? "Сделка создана" : "Задача добавлена");
    setBusy(false); if (ok) onClose();
  };
  const remove = async () => { setBusy(true); const ok = await mutate(`${resource}/${record!.id}`, "DELETE", undefined, "Запись удалена"); setBusy(false); if (ok) onClose(); };
  const title = editor.type === "client" ? record ? "Карточка клиента" : "Новый клиент" : editor.type === "deal" ? record ? "Карточка сделки" : "Новая сделка" : record ? "Задача" : "Новая задача";
  return <DialogShell title={title} description={editor.type === "client" ? "Контакты, история и новые возможности" : editor.type === "deal" ? "Всё важное для следующего шага" : "Освободите голову — запишите следующий шаг"} onClose={() => { if (!busy) onClose(); }}>
    {confirmDelete ? <div className="confirm-body"><div className="danger-icon"><Trash2 size={25} /></div><h3>Удалить {editor.type === "client" ? "клиента" : editor.type === "deal" ? "сделку" : "задачу"}?</h3><p>{editor.type === "client" ? "Все сделки этого клиента тоже будут удалены. Связанные задачи останутся без сделки." : "Восстановить запись после удаления не получится."}</p><div className="button-row"><button className="button secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>Отмена</button><button className="button danger" disabled={busy} onClick={remove}>{busy ? "Удаляем…" : "Удалить"}</button></div></div> : <form onSubmit={submit} className="editor-form">
      {editor.type === "client" && <>
        {editor.record && <div className="client-identity"><Avatar name={editor.record.name} size="large" /><div><h3>{editor.record.company}</h3><p>Клиент с {new Date(editor.record.createdAt).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</p></div></div>}
        <Field label="Контактное лицо"><input name="name" defaultValue={editor.record?.name} placeholder="Анна Смирнова" required minLength={2} maxLength={200} autoFocus /></Field>
        <Field label="Компания"><input name="company" defaultValue={editor.record?.company} placeholder="Название компании" required minLength={2} maxLength={200} /></Field>
        <div className="form-grid"><Field label="Email" optional><input name="email" type="email" defaultValue={editor.record?.email ?? ""} placeholder="anna@company.ru" maxLength={254} /></Field><Field label="Телефон" optional><input name="phone" type="tel" defaultValue={editor.record?.phone ?? ""} placeholder="+7 (___) ___-__-__" maxLength={40} /></Field></div>
        <Field label="Источник"><select name="source" defaultValue={editor.record?.source ?? "Сайт"}>{["Сайт", "Рекомендация", "Соцсети", "Реклама", "Другое"].map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Заметки" optional><textarea name="notes" defaultValue={editor.record?.notes ?? ""} placeholder="Что важно знать о клиенте?" rows={3} maxLength={4000} /></Field>
        {editor.record && <div className="related-deals"><div className="section-label">Сделки клиента<button type="button" className="text-button" onClick={() => onOpen({ type: "deal", clientId: editor.record!.id })}><Plus size={14} />Добавить</button></div>{data.deals.filter(d => d.clientId === editor.record!.id).map(d => <button type="button" className="related-deal" key={d.id} onClick={() => onOpen({ type: "deal", record: d })}><span>{d.title}<Badge status={d.status} /></span><strong>{money(d.amount)}</strong><ExternalLink size={14} /></button>)}{!data.deals.some(d => d.clientId === editor.record!.id) && <p className="muted small">Пока нет сделок. Самое время создать первую.</p>}</div>}
      </>}
      {editor.type === "deal" && <>
        <Field label="Название сделки"><input name="title" defaultValue={editor.record?.title} placeholder="Например, разработка сайта" required minLength={2} maxLength={200} autoFocus /></Field>
        <Field label="Клиент"><select name="clientId" defaultValue={editor.record?.clientId ?? editor.clientId ?? ""} required><option value="" disabled>Выберите клиента</option>{data.clients.map(c => <option key={c.id} value={c.id}>{c.company} · {c.name}</option>)}</select></Field>
        {!data.clients.length && <button type="button" className="text-button" onClick={() => onOpen({ type: "client" })}><Plus size={14} />Сначала добавьте клиента</button>}
        <div className="form-grid"><Field label="Сумма, ₽"><input name="amount" type="number" min={0} max={1000000000} step={1} defaultValue={editor.record?.amount} placeholder="150000" required /></Field><Field label="Ожидаемая дата"><input name="dueDate" type="date" defaultValue={editor.record?.dueDate ?? localDate()} required /></Field></div>
        <Field label="Этап сделки"><select name="status" defaultValue={editor.record?.status ?? editor.stage ?? "new"}>{stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        <Field label="Следующий шаг" optional><textarea name="nextStep" defaultValue={editor.record?.nextStep ?? ""} placeholder="Что нужно сделать, чтобы продвинуть сделку?" rows={3} maxLength={500} /></Field>
        {editor.record && (() => { const client = data.clients.find(c => c.id === editor.record!.clientId); return client ? <div className="deal-contact"><Avatar name={client.name} /><div><strong>{client.name}</strong><span>{client.company}</span></div><div>{client.email && <a href={`mailto:${client.email}`} className="icon-button" title="Написать письмо"><Mail size={17} /></a>}{client.phone && <a href={`tel:${client.phone.replace(/[^+\d]/g, "")}`} className="icon-button" title="Позвонить"><Phone size={17} /></a>}</div></div> : null; })()}
        {editor.record && <div className="record-meta"><CalendarDays size={14} />Создана {new Date(editor.record.createdAt).toLocaleDateString("ru-RU")}{editor.record.closedAt && ` · Закрыта ${new Date(editor.record.closedAt).toLocaleDateString("ru-RU")}`}</div>}
      </>}
      {editor.type === "task" && <>
        <Field label="Что нужно сделать"><input name="title" defaultValue={editor.record?.title} placeholder="Например, отправить предложение" required minLength={2} maxLength={200} autoFocus /></Field>
        <Field label="Срок"><input name="dueDate" type="date" defaultValue={editor.record?.dueDate ?? localDate()} required /></Field>
        <Field label="Связанная сделка" optional><select name="dealId" defaultValue={editor.record?.dealId ?? editor.dealId ?? ""}><option value="">Без сделки</option>{data.deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-footer">{record && <button type="button" className="icon-button delete-button" aria-label="Удалить запись" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={18} /></button>}<div><button className="button secondary" type="button" onClick={onClose} disabled={busy}>Отмена</button><button className="button primary" type="submit" disabled={busy}>{busy ? "Сохраняем…" : record ? "Сохранить изменения" : editor.type === "client" ? "Добавить клиента" : editor.type === "deal" ? "Создать сделку" : "Добавить задачу"}</button></div></div>
    </form>}
  </DialogShell>;
}
