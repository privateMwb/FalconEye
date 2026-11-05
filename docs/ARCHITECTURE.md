# Architecture

FalconEye has two halves joined by one JSON contract: a C++ middleware that records request
timings inside a FalconHTTP server, and a React dashboard that polls the result.

```
┌──────────────────────────────── backend/ ─────────────────────────────────┐
│ FalconHTTP Server                                                          │
│   Recovery → Logger → Cors → Metrics → Router → route handler              │
│                                 │                    │                     │
│                                 │                    └─ timedCall(...)     │
│                                 ▼                                          │
│                       MetricsRingBuffer (mutex, N entries)                 │
│                                 ▲                                          │
│        GET /api/metrics ── metricsToJson() ─┘                              │
└────────────────────────────────┬──────────────────────────────────────────┘
                                 │  JSON, polled every 3 s
┌────────────────────────────────▼──────── frontend/ ───────────────────────┐
│ React + Vite dashboard: sparkline, summary, request log, DB breakdown      │
└────────────────────────────────────────────────────────────────────────────┘
```

## The request path

1. A request enters FalconHTTP's middleware chain. `Metrics` is registered **last**, so
   its timer wraps the router and the matched handler, and nothing downstream goes
   unmeasured.
2. `Metrics` skips `/api/metrics` itself: polling the dashboard must not change the
   numbers it displays.
3. Otherwise it records a start time, points the thread-local `currentBreakdown` at a fresh
   vector, and calls `next()`.
4. While the handler runs, `timedCall(label, fn)` runs `fn`, measures it, and appends
   `{label, ms}` to whatever `currentBreakdown` addresses, then returns `fn`'s result.
5. When `next()` returns, or throws, `Metrics` builds a `MetricEntry` and pushes it into
   the ring buffer. On a throw it records first and rethrows, so `Recovery` still sees the
   exception and the failed request is not lost.

## Why these designs

**Route patterns, not raw paths.** Recording `/api/todos/42` would give every id its own row.
`Metrics` re-runs FalconHTTP's `PathMatcher::match()` against the `Router`'s registered
routes to recover `/api/todos/:id`. That needs no change to FalconHTTP, only a read-only
reference to the router.

**A thread-local breakdown pointer.** The thread pool runs many requests at once, but one
request stays on one thread from `Metrics` to its handler. A thread-local pointer therefore
lets `timedCall()` find "the current request" without passing it through every call, and
two requests can never write into each other's breakdown (covered by the
`threads_do_not_share_a_breakdown` test).

**A mutex-guarded ring buffer.** Writes come from every worker thread, so a single mutex
protects the buffer. The critical section is a copy into a slot and two integer updates, and
the reader (`/api/metrics`) takes the same lock to copy the entries out. A fixed capacity
keeps memory bounded; overwrite-oldest keeps the most recent requests.

**Two counters.** `totalPushed` is a lifetime atomic counter (`requestCount`), while
`errorCount` and `avgResponseMs` are computed from the buffered window. They answer different
questions and the dashboard labels them accordingly.

## The JSON contract

`metricsToJson()` produces the only interface the dashboard uses:

```
requestCount   lifetime total (not capped by the buffer)
errorCount     status >= 400 within the window
avgResponseMs  mean totalMs within the window
recentRequests oldest first: route, method, status, totalMs, timestamp, breakdown[]
```

Because the dashboard only reads this shape, any backend that serves it works unmodified.
The middleware is the part tied to FalconHTTP.

## Dashboard

`frontend/src/App.jsx` polls on an interval, keeps the previous response when a poll fails,
and derives requests per second from the difference in `requestCount` between polls. The
target is `VITE_DEFAULT_TARGET` at build time or `?target=` at run time.

## Quality tooling

| Tool | Where | What it guards |
|---|---|---|
| Unit tests | `backend/tests/` | Ring buffer, JSON, `timedCall()` |
| ASan / UBSan / TSan | `sanitizers.yml` | Memory errors, undefined behavior and data races under real requests |
| ClusterFuzzLite | `backend/fuzz/` | Crashes and round-trip failures in serialization and timing |
| clang-format, clang-tidy, CodeQL | `.github/workflows/` | Style, static analysis, security patterns |

## Hosted demo

`Dockerfile.demo` runs the real server plus `scripts/demo-server.mjs`, which generates
traffic and exposes only `GET /api/metrics` and `GET /api/health` on the public port, with
CORS limited to `ALLOWED_ORIGINS`. The C++ server is unchanged: its port and CORS origin stay
hard-coded in `main.cpp`, which is why the front door exists.
