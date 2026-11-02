import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  salesGoal: integer("sales_goal").notNull().default(1500000),
  createdAt: text("created_at").notNull(),
}, t => [uniqueIndex("workspace_owner_idx").on(t.ownerId)]);

export const demoSessions = sqliteTable("demo_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
}, t => [index("demo_expiry_idx").on(t.expiresAt)]);

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  company: text("company").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  source: text("source").notNull().default("Сайт"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, t => [index("clients_workspace_idx").on(t.workspaceId)]);

export const deals = sqliteTable("deals", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  amount: integer("amount").notNull(),
  status: text("status", { enum: ["new", "contact", "proposal", "negotiation", "won", "lost"] }).notNull().default("new"),
  nextStep: text("next_step").notNull().default(""),
  dueDate: text("due_date").notNull(),
  closedAt: text("closed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, t => [index("deals_workspace_status_idx").on(t.workspaceId, t.status)]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  dealId: text("deal_id").references(() => deals.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  dueDate: text("due_date").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
}, t => [index("tasks_workspace_idx").on(t.workspaceId)]);

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, t => [index("activities_workspace_idx").on(t.workspaceId)]);
