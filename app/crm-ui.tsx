"use client";
import { Dialog } from "radix-ui";
import { ArrowUpRight, Check, ChevronRight, Inbox, X } from "lucide-react";
import type { ReactNode } from "react";
import { localDate, stages, type Stage } from "@/lib/domain";

export function Logo({ light = false }: { light?: boolean }) { return <span className={`logo ${light ? "logo-light" : ""}`}><span className="logo-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 25V12a6 6 0 0 1 12 0v13M13 19h12M25 7v18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg></span><span>дело<span className="logo-dot">.</span></span><small>CRM</small></span>; }
export function Avatar({ name, size = "", square = false }: { name: string; size?: string; square?: boolean }) {
  const colors = ["sage", "lavender", "peach", "blue", "rose"];
  const color = colors[Array.from(name).reduce((a, x) => a + x.charCodeAt(0), 0) % colors.length];
  return <span className={`avatar ${color} ${size} ${square ? "square" : ""}`}>{name.split(/\s+/).slice(0, 2).map(x => x[0]).join("")}</span>;
}
export function Badge({ status }: { status: Stage }) { const s = stages.find(x => x.id === status)!; return <span className={`badge badge-${status}`}><i style={{ background: s.color }} />{s.label}</span>; }
export function Empty({ title = "Пока ничего нет", description, action }: { title?: string; description: string; action?: ReactNode }) { return <div className="empty"><span className="empty-icon"><Inbox size={25} /></span><h3>{title}</h3><p>{description}</p>{action}</div>; }
export function DialogShell({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className={`dialog-content ${wide ? "dialog-wide" : ""}`} aria-describedby={description ? undefined : undefined}><div className="dialog-header"><div><Dialog.Title>{title}</Dialog.Title>{description ? <Dialog.Description>{description}</Dialog.Description> : <Dialog.Description className="sr-only">Просмотр и редактирование записи CRM</Dialog.Description>}</div><Dialog.Close className="icon-button" aria-label="Закрыть"><X size={20} /></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Field({ label, children, optional = false }: { label: string; children: ReactNode; optional?: boolean }) { return <label className="field"><span>{label}{optional && <small>необязательно</small>}</span>{children}</label>; }
export function DueDate({ date, done = false }: { date: string; done?: boolean }) {
  const today = localDate(), overdue = date < today && !done;
  const tomorrow = new Date(`${today}T12:00:00+03:00`); tomorrow.setDate(tomorrow.getDate() + 1);
  const label = date === today ? "Сегодня" : date === localDate(tomorrow) ? "Завтра" : new Date(`${date}T12:00:00+03:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });
  return <span className={`due-date ${overdue ? "overdue" : ""}`}>{overdue && <i />}{label}</span>;
}
export function PanelTitle({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) { return <div className="panel-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action && <button className="text-button" onClick={onAction}>{action}<ChevronRight size={15} /></button>}</div>; }
export function Stat({ label, value, note, icon, accent = false }: { label: string; value: string; note: string; icon: ReactNode; accent?: boolean }) { return <div className={`stat-card ${accent ? "accent" : ""}`}><div className="stat-label">{label}<span>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-note">{accent ? <ArrowUpRight size={14} /> : <span className="stat-note-dot" />}{note}</div></div>; }
export function CheckBox({ checked, onClick, label, disabled = false }: { checked: boolean; onClick: () => void; label: string; disabled?: boolean }) { return <button className={`check-box ${checked ? "checked" : ""}`} role="checkbox" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onClick}>{checked && <Check size={13} strokeWidth={3} />}</button>; }
