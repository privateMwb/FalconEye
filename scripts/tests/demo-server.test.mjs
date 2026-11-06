// Tests for scripts/demo-server.mjs: the pure helpers, and the front door
// against a stub upstream. Run with: node --test scripts/tests/

import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import {
  PUBLIC_ROUTES,
  corsHeadersFor,
  createFrontDoor,
  nextTrafficPath,
  parseAllowedOrigins,
  pathOf,
} from "../demo-server.mjs";

test("parseAllowedOrigins trims, drops empties and trailing slashes", () => {
  const origins = parseAllowedOrigins(" https://a.app/ , ,https://b.app ");
  assert.deepEqual([...origins], ["https://a.app", "https://b.app"]);
  assert.equal(parseAllowedOrigins(undefined).size, 0);
});

test("corsHeadersFor only answers exact allowlisted origins", () => {
  const allowed = parseAllowedOrigins("https://a.app");
  assert.equal(corsHeadersFor("https://a.app", allowed)["Access-Control-Allow-Origin"], "https://a.app");
  assert.deepEqual(corsHeadersFor("https://evil.app", allowed), {});
  assert.deepEqual(corsHeadersFor("https://a.app.evil.app", allowed), {});
  assert.deepEqual(corsHeadersFor(undefined, allowed), {});
});

test("pathOf drops the query string", () => {
  assert.equal(pathOf("/api/metrics?x=1"), "/api/metrics");
});

test("nextTrafficPath covers health, database hits, database misses and router misses", () => {
  assert.equal(nextTrafficPath(() => 0.1), "/api/health");
  assert.equal(nextTrafficPath(() => 0.6), "/api/todos/1");
  assert.match(nextTrafficPath(() => 0.9), /^\/api\/todos\/\d+$/);
  assert.equal(nextTrafficPath(() => 0.99), "/api/missing");
});

async function withFrontDoor(run) {
  const forward = (path, done) => done(200, JSON.stringify({ path }));
  const server = createFrontDoor({ allowed: parseAllowedOrigins("https://dash.app"), forward });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base);
  } finally {
    server.close();
  }
}

test("front door forwards only the allowlisted routes", async () => {
  await withFrontDoor(async (base) => {
    for (const path of PUBLIC_ROUTES) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { path });
    }
    assert.equal((await fetch(base + "/api/todos/1")).status, 404);
    assert.equal((await fetch(base + "/anything")).status, 404);
    assert.equal((await fetch(base + "/api/metrics", { method: "POST" })).status, 404);
  });
});

test("front door answers /healthz itself", async () => {
  await withFrontDoor(async (base) => {
    const response = await fetch(base + "/healthz");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test("front door sets CORS only for the allowed origin", async () => {
  await withFrontDoor(async (base) => {
    const allowed = await fetch(base + "/api/metrics", { headers: { Origin: "https://dash.app" } });
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://dash.app");

    const other = await fetch(base + "/api/metrics", { headers: { Origin: "https://evil.app" } });
    assert.equal(other.headers.get("access-control-allow-origin"), null);

    const preflight = await fetch(base + "/api/metrics", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.app" },
    });
    assert.equal(preflight.status, 403);
  });
});
