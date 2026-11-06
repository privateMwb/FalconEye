// ============================================================
// scripts/demo-server.mjs
//
// Entry point of the hosted-demo container. It does three jobs so the
// C++ server itself stays untouched:
//
//   1. Starts falconeye_server on 127.0.0.1:8080 (its fixed port).
//   2. Sends it a steady, varied trickle of requests (fast health
//      checks, DB-backed lookups, and 404s), so the dashboard has
//      throughput, errors and timing breakdowns to show.
//   3. Listens on the public $PORT (10000 by default, what Render
//      expects) as a small read-only front door: only the allowlisted
//      routes pass, and CORS is answered for ALLOWED_ORIGINS only.
//
// Zero npm dependencies. Environment:
//
//   PORT             public port                       (default 10000)
//   ALLOWED_ORIGINS  comma-separated dashboard origins (default: none)
//   FALCONEYE_BIN    path to the server binary         (default /app/falconeye_server)
//   TRAFFIC          set to "off" to disable the generator
// ============================================================

import { spawn } from "node:child_process";
import http from "node:http";
import { fileURLToPath } from "node:url";

const UPSTREAM_HOST = "127.0.0.1";
const UPSTREAM_PORT = 8080;

/** Routes the public port forwards. Everything else is a 404. */
export const PUBLIC_ROUTES = new Set(["/api/metrics", "/api/health"]);

/** Parses "a, b ,c" into a Set of exact origins, trailing slashes removed. */
export function parseAllowedOrigins(value) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

/** CORS headers for a request's Origin: only exact allowlist matches get any. */
export function corsHeadersFor(origin, allowed) {
  if (!origin || !allowed.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** The path part of a request URL, without the query string. */
export function pathOf(url) {
  return new URL(url, "http://placeholder").pathname;
}

/** Picks the next request the traffic generator sends. `random` is injectable for tests. */
export function nextTrafficPath(random = Math.random) {
  const roll = random();
  if (roll < 0.45) return "/api/health"; // fast, no database
  if (roll < 0.8) return "/api/todos/1"; // database-backed, 200
  if (roll < 0.95) return `/api/todos/${2 + Math.floor(random() * 90)}`; // 404 from the database
  return "/api/missing"; // 404 from the router
}

/** Builds the public front-door server. `forward` proxies one request upstream. */
export function createFrontDoor({ allowed, forward }) {
  return http.createServer((req, res) => {
    const cors = corsHeadersFor(req.headers.origin, allowed);
    const path = pathOf(req.url ?? "/");

    const send = (status, body, extra = {}) => {
      res.writeHead(status, { "Content-Type": "application/json", ...cors, ...extra });
      res.end(body);
    };

    if (path === "/healthz") return send(200, '{"ok":true}');

    if (req.method === "OPTIONS") {
      res.writeHead(Object.keys(cors).length ? 204 : 403, cors);
      return res.end();
    }

    if (req.method !== "GET" || !PUBLIC_ROUTES.has(path)) {
      return send(404, '{"error":"not found"}');
    }

    forward(path, (status, body) => send(status, body, { "Cache-Control": "no-store" }));
  });
}

function forwardToUpstream(path, done) {
  const upstream = http.request(
    { host: UPSTREAM_HOST, port: UPSTREAM_PORT, path, method: "GET", timeout: 5000 },
    (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => done(response.statusCode ?? 502, Buffer.concat(chunks)));
    },
  );
  upstream.on("timeout", () => upstream.destroy());
  upstream.on("error", () => done(502, '{"error":"backend unavailable"}'));
  upstream.end();
}

function startTrafficGenerator() {
  const tick = () => {
    http
      .get({ host: UPSTREAM_HOST, port: UPSTREAM_PORT, path: nextTrafficPath(), timeout: 3000 }, (r) =>
        r.resume(),
      )
      .on("error", () => {})
      .on("timeout", function () {
        this.destroy();
      });
    setTimeout(tick, 150 + Math.random() * 650);
  };
  tick();
}

function main() {
  const port = Number(process.env.PORT ?? 10000);
  const allowed = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const binary = process.env.FALCONEYE_BIN ?? "/app/falconeye_server";

  const child = spawn(binary, [], { stdio: "inherit" });
  child.on("exit", (code) => {
    console.error(`falconeye_server exited (${code}); stopping the demo.`);
    process.exit(1);
  });

  const stop = () => {
    child.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  createFrontDoor({ allowed, forward: forwardToUpstream }).listen(port, "0.0.0.0", () => {
    console.log(`demo front door on :${port}, allowed origins: ${[...allowed].join(", ") || "(none)"}`);
  });

  if (process.env.TRAFFIC !== "off") setTimeout(startTrafficGenerator, 1500);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
