"""Integration tests against the running local Worker and its real D1 database.

Run: npm run dev (separate terminal), then npm run test:api.
Never run against a production URL: this script creates and deletes test sandboxes.
"""
import http.cookiejar
import json
import os
import urllib.error
import urllib.request
from urllib.parse import urlparse

BASE = os.environ.get("CRM_TEST_URL", "http://127.0.0.1:5173").rstrip("/")
assert urlparse(BASE).hostname in ("127.0.0.1", "localhost"), "Use a loopback test server"
checks = 0


class Session:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def request(self, path, method="GET", body=None, expected=200, origin=None):
        global checks
        headers = {"Content-Type": "application/json"}
        if method != "GET":
            headers["Origin"] = origin or BASE
        request = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=headers)
        try:
            response = self.opener.open(request, timeout=60)
        except urllib.error.HTTPError as error:
            response = error
        raw = response.read().decode("utf-8")
        try:
            value = json.loads(raw)
        except json.JSONDecodeError:
            value = {"error": raw[:300]}
        assert response.code == expected, f"{method} {path}: expected {expected}, got {response.code}: {value}"
        checks += 1
        return value

    def data(self):
        return self.request("/api/crm/bootstrap")


a, b = Session(), Session()
a.request("/api/crm/bootstrap", expected=401)
a.request("/api/session", "POST", {"action": "demo"}, expected=403, origin="https://foreign.example")
a.request("/api/session", "POST", {"action": "demo"}, expected=201)
initial = a.data()
assert (len(initial["clients"]), len(initial["deals"]), len(initial["tasks"])) == (12, 20, 5)
assert all(c["email"].endswith("@example.com") for c in initial["clients"])
# Starting the same demo again reuses the current sandbox.
a.request("/api/session", "POST", {"action": "demo"})
assert a.data()["clients"][0]["id"] == initial["clients"][0]["id"]
b.request("/api/session", "POST", {"action": "demo"}, expected=201)
other = b.data()
assert set(c["id"] for c in initial["clients"]).isdisjoint(c["id"] for c in other["clients"])

client = {"name": "Тестовый клиент", "company": "Тест изоляции", "email": "test@example.com", "phone": "", "source": "Сайт", "notes": "<script>must remain plain text</script>"}
client_id = a.request("/api/crm/clients", "POST", client, expected=201)["id"]
assert len(a.data()["clients"]) == 13
assert len(b.data()["clients"]) == 12
b.request(f"/api/crm/clients/{client_id}", "PATCH", client, expected=404)
b.request(f"/api/crm/clients/{client_id}", "DELETE", expected=404)

deal = {"clientId": client_id, "title": "Интеграционная сделка", "amount": 123456, "status": "new", "dueDate": "2026-11-10", "nextStep": "Позвонить"}
b.request("/api/crm/deals", "POST", deal, expected=400)
a.request("/api/crm/deals", "POST", {**deal, "amount": -1}, expected=400)
a.request("/api/crm/deals", "POST", {**deal, "dueDate": "2026-02-30"}, expected=400)
deal_id = a.request("/api/crm/deals", "POST", deal, expected=201)["id"]
b.request(f"/api/crm/deals/{deal_id}", "PATCH", {"status": "won"}, expected=404)
a.request(f"/api/crm/deals/{deal_id}", "PATCH", {"status": "won"})
closed = next(d for d in a.data()["deals"] if d["id"] == deal_id)
assert closed["closedAt"] and closed["status"] == "won"
a.request(f"/api/crm/deals/{deal_id}", "PATCH", {"status": "negotiation"})
assert next(d for d in a.data()["deals"] if d["id"] == deal_id)["closedAt"] is None

task_id = a.request("/api/crm/tasks", "POST", {"title": "Проверить каскад", "dueDate": "2026-11-10", "dealId": deal_id}, expected=201)["id"]
a.request(f"/api/crm/tasks/{task_id}", "PATCH", {"done": True})
assert next(t for t in a.data()["tasks"] if t["id"] == task_id)["done"] is True
b.request("/api/crm/tasks", "POST", {"title": "Чужая сделка", "dueDate": "2026-11-10", "dealId": deal_id}, expected=400)
a.request(f"/api/crm/clients/{client_id}", "DELETE")
after_delete = a.data()
assert not any(d["id"] == deal_id for d in after_delete["deals"])
assert next(t for t in after_delete["tasks"] if t["id"] == task_id)["dealId"] is None

a.request("/api/crm/settings", "PATCH", {"name": "Тестовая команда", "salesGoal": 2500000})
assert a.data()["workspace"]["salesGoal"] == 2500000
assert b.data()["workspace"]["salesGoal"] == 1500000
a.request("/api/crm/reset", "POST", {})
reset = a.data()
assert (len(reset["clients"]), len(reset["deals"]), len(reset["tasks"])) == (12, 20, 5)
assert b.data()["clients"][0]["id"] == other["clients"][0]["id"]
a.request("/api/session", "DELETE")
a.request("/api/crm/bootstrap", expected=401)
b.request("/api/session", "DELETE")
print(f"PASS: {checks} HTTP checks; demo isolation, CRUD, validation, status transitions, task completion, cascade deletion, settings, reset, logout.")
