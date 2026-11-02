import { test } from "node:test";
import assert from "node:assert/strict";
import { analytics, clientSchema, dealSchema, localDate, revenueSeries, type Deal } from "../lib/domain.ts";

const now = new Date("2026-11-02T12:00:00Z");
function deal(overrides: Partial<Deal> = {}): Deal {
  return { id: "fake", clientId: "fake-client", title: "Сайт", amount: 100000, status: "won", nextStep: "", dueDate: "2026-11-02", closedAt: "2026-11-01T09:00:00Z", createdAt: "2026-10-01T09:00:00Z", updatedAt: now.toISOString(), ...overrides };
}

test("revenue counts won deals by closing date, excluding lost, open and out-of-period records", () => {
  const result = analytics([deal(), deal({ status: "lost", amount: 900000 }), deal({ status: "proposal", closedAt: null }), deal({ closedAt: "2026-09-01T09:00:00Z" })], 30, now);
  assert.equal(result.revenue, 100000);
  assert.equal(result.conversion, 50);
  assert.equal(result.active, 1);
  assert.equal(result.pipeline, 100000);
  assert.equal(result.forecast, 50000);
});
test("empty CRM returns zeroes rather than NaN", () => {
  assert.deepEqual(analytics([], 30, now), { revenue: 0, won: 0, active: 0, pipeline: 0, average: 0, conversion: 0, forecast: 0 });
});
test("period boundary uses Moscow dates, including the entire last day", () => {
  const result = analytics([deal({ closedAt: "2026-11-01T20:59:59Z", amount: 10 }), deal({ closedAt: "2026-11-01T21:00:00Z", amount: 20 }), deal({ closedAt: "2026-11-02T20:59:59Z", amount: 30 }), deal({ closedAt: "2026-11-02T21:00:00Z", amount: 40 })], 1, now);
  assert.equal(result.revenue, 50);
  assert.equal(localDate(new Date("2026-11-01T22:00:00Z")), "2026-11-02");
});
test("chart buckets exactly partition the same revenue as KPI for all supported periods", () => {
  const records = Array.from({ length: 100 }, (_, i) => deal({ amount: 100 + i, closedAt: new Date(now.getTime() - i * 86400000).toISOString() }));
  for (const period of [7, 30, 90]) assert.equal(revenueSeries(records, period, now).reduce((s, p) => s + p.value, 0), analytics(records, period, now).revenue);
});
test("reopening a deal removes its amount from revenue and restores the weighted forecast", () => {
  const result = analytics([deal({ status: "negotiation", closedAt: null, amount: 200000 })], 30, now);
  assert.equal(result.revenue, 0); assert.equal(result.forecast, 150000);
});
test("validation rejects impossible dates, unknown stages, fractional or negative ruble amounts", () => {
  const valid = { clientId: "123e4567-e89b-42d3-a456-426614174000", title: "Лендинг", amount: 150000, status: "new", nextStep: "", dueDate: "2026-11-02" };
  assert.equal(dealSchema.safeParse(valid).success, true);
  for (const invalid of [{ amount: -1 }, { amount: 1.5 }, { status: "invented" }, { dueDate: "2026-02-30" }, { clientId: "not-an-id" }]) assert.equal(dealSchema.safeParse({ ...valid, ...invalid }).success, false);
});
test("contacts accept optional empty email and reject invalid email", () => {
  const valid = { name: "Анна", company: "Форма", email: "", phone: "", source: "Сайт", notes: "" };
  assert.equal(clientSchema.safeParse(valid).success, true);
  assert.equal(clientSchema.safeParse({ ...valid, email: "wrong@" }).success, false);
});
