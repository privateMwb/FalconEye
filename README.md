<p align="center">
  <img src=".github/assets/banner.svg" alt="FalconEye" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-5EEAD4?style=for-the-badge&labelColor=0B0E11" alt="License - MIT">
  <img src="https://img.shields.io/badge/C%2B%2B-23-F5A623?style=for-the-badge&logo=cplusplus&logoColor=white&labelColor=0B0E11" alt="C++ - 23">
  <img src="https://img.shields.io/badge/React-18-149ECA?style=for-the-badge&logo=react&logoColor=white&labelColor=0B0E11" alt="React - 18">
  <img src="https://img.shields.io/badge/Metrics-%2Fapi%2Fmetrics-5EEAD4?style=for-the-badge&labelColor=0B0E11" alt="Metrics - /api/metrics">
</p>

<p align="center">
  <img src=".github/assets/divider.svg" alt="" width="100%">
</p>

<p align="center"><sub><b>CI / CD</b></sub></p>
<p align="center">
  <a href="https://github.com/privateMwb/FalconEye/actions/workflows/build.yml">
    <img src="https://github.com/privateMwb/FalconEye/actions/workflows/build.yml/badge.svg" alt="Build">
  </a>
  <a href="https://github.com/privateMwb/FalconEye/actions/workflows/frontend.yml">
    <img src="https://github.com/privateMwb/FalconEye/actions/workflows/frontend.yml/badge.svg" alt="Frontend">
  </a>
  <a href="https://github.com/privateMwb/FalconEye/actions/workflows/demo-image.yml">
    <img src="https://github.com/privateMwb/FalconEye/actions/workflows/demo-image.yml/badge.svg" alt="Demo image">
  </a>
  <a href="https://github.com/privateMwb/FalconEye/actions/workflows/release.yml">
    <img src="https://github.com/privateMwb/FalconEye/actions/workflows/release.yml/badge.svg" alt="Release">
  </a>
</p>

<p align="center"><sub><b>Code Quality &amp; Safety</b></sub></p>
<p align="center">
  <a href="https://github.com/privateMwb/FalconEye/actions/workflows/sanitizers.yml">
    <img src="https://github.com/privateMwb/FalconEye/actions/workflows/sanitizers.yml/badge.svg" alt="Sanitizers">
  </a>
  <a href="https://github.com/privateMwb/FalconEye/actions/workflows/clang-tidy.yml">
    <img src="https://github.com/privateMwb/FalconEye/actions/workflows/clang-tidy.yml/badge.svg" alt="Clang Tidy">
  </a>
  <a href="https://github.com/privateMwb/FalconEye/actions/workflows/clang-format.yml">
    <img src="https://github.com/privateMwb/FalconEye/actions/workflows/clang-format.yml/badge.svg" alt="Clang Format">
  </a>
  <a href="https://github.com/privateMwb/FalconEye/actions/workflows/codeql.yml">
    <img src="https://github.com/privateMwb/FalconEye/actions/workflows/codeql.yml/badge.svg" alt="CodeQL">
  </a>
  <a href="https://github.com/privateMwb/FalconEye/actions/workflows/cflite_pr.yml">
    <img src="https://github.com/privateMwb/FalconEye/actions/workflows/cflite_pr.yml/badge.svg" alt="PR Fuzzing">
  </a>
</p>

<p align="center"><sub><b>Documentation</b></sub></p>
<p align="center">
  <a href="https://github.com/privateMwb/FalconEye/actions/workflows/docs.yml">
    <img src="https://github.com/privateMwb/FalconEye/actions/workflows/docs.yml/badge.svg" alt="Documentation">
  </a>
</p>

<p align="center">
  <img src=".github/assets/divider.svg" alt="" width="100%">
</p>

<p align="center">FalconEye is a live observability dashboard, currently built for <a href="https://github.com/privateMwb/FalconHTTP">FalconHTTP</a> servers: a <code>Metrics</code> middleware records per-request and per-database-call timing into a JSON endpoint, and a React dashboard polls it to show throughput, error rate, and request-level timing breakdowns in real time. The dashboard only depends on the <code>/api/metrics</code> JSON shape, not on FalconHTTP directly (see <a href="#known-limitations">Known Limitations</a>).</p>

<p align="center">
  <img src="docs/images/dashboard.png" alt="FalconEye dashboard showing throughput, request counts, a request log, and a DB timing breakdown" width="360">
</p>

<br>

> [!NOTE]
> **Status: v1.0.0, with tests, fuzzing and a hosted-demo setup added since.** The
> middleware, the `/api/metrics` endpoint, and the dashboard are complete and covered by
> unit tests, sanitizer runs, and ClusterFuzzLite fuzzing. A Render + Vercel hosted-demo
> setup is included (see [Deployment](#deployment)); it needs to be deployed from your own
> accounts. Linux only so far.

<br>

## 📑 Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Requirements](#requirements)
- [Dependencies](#dependencies)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Dashboard](#dashboard)
- [Metrics API](#metrics-api)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Development](#development)
- [Known Limitations](#known-limitations)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [Security](#security)
- [License](#license)

<br>

## <a id="features"></a>✨ Features

- **Onion-model request timing** — `Metrics` wraps `next()` in FalconHTTP's middleware chain, timing the full request/response cycle including the matched route handler. Registered last, so nothing downstream of it goes unmeasured.
- **Route pattern resolution, not raw paths** — `MetricEntry::route` reports `/api/todos/:id`, not `/api/todos/42`, by re-running FalconHTTP's own `PathMatcher::match()` against the live `Router`'s registered routes. No changes to FalconHTTP's source required.
- **Per-request DB call timing** — `timedCall()` wraps a MiniDB call at its route-handler call site and appends the result into that request's `breakdown` array, using a thread-local pointer scoped by `Metrics` around each request. No changes to MiniDB's source required.
- **Thread-safe, bounded memory** — a fixed-capacity ring buffer (default 50 entries, overwrite-oldest) guarded by a single mutex, since requests are dispatched across a thread pool and concurrent writes are the expected case, not an edge case.
- **Exceptions don't lose data** — a route handler that throws still gets its timing recorded before the exception reaches `Recovery` upstream.
- **Self-exclusion** — the dashboard's own polling traffic against `/api/metrics` is never recorded, so it can't crowd out real application requests or skew `requestCount`/`avgResponseMs`.
- **Live dashboard, not a static export** — the React frontend polls `/api/metrics` on an interval, with a derived requests-per-second sparkline, a scrollable request log, and a click-through DB timing breakdown per request.
- **Tested and fuzzed** — unit tests for the ring buffer, the JSON output and `timedCall()`; ASan/UBSan/TSan runs against the live server; and ClusterFuzzLite harnesses on the serialization path.

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="how-it-works"></a>🧠 How It Works

```
 client ──► FalconHTTP server ──► Recovery ──► Logger ──► Cors ──► Metrics ──► route handler
                                                                      │             │
                                          starts a timer, points the  │             │ timedCall("dbQuery", ...)
                                          thread-local breakdown at   │             │ appends a step to the
                                          this request's vector       │             │ current request's breakdown
                                                                      ▼             ▼
                                                              MetricsRingBuffer (mutex, 50 entries)
                                                                      │
                          GET /api/metrics ──► metricsToJson() ◄──────┘
                                  │
                                  ▼
                         React dashboard (polls every 3 s)
```

1. **Metrics is the last middleware**, so its timer covers the handler and everything it calls.
2. **Before the handler runs**, `Metrics` points a thread-local pointer at a fresh `breakdown` vector. `timedCall()` appends to whatever that pointer addresses, so concurrent requests on different threads never mix their steps.
3. **After the handler returns (or throws)**, `Metrics` builds a `MetricEntry` (matched route pattern, method, status, total time, UTC timestamp, breakdown) and pushes it into the ring buffer.
4. **`GET /api/metrics`** serializes the buffer, oldest first. It is excluded from recording, so polling does not feed back into the numbers.

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="requirements"></a>📋 Requirements

- A C++23-conformant compiler — verified on GCC and Clang, Linux only (see [Known Limitations](#known-limitations))
- CMake 3.20+
- Node.js 20+ and npm, for the frontend (Node.js 22 for the demo scripts' tests)
- Nothing else to fetch: FalconHTTP and MiniDatabase are committed under `backend/external/` (see [Dependencies](#dependencies))

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="dependencies"></a>🔗 Dependencies

| Dependency | Provides | Repository |
|---|---|---|
| FalconHTTP | The HTTP server, router, and middleware chain `Metrics` is written against | [privateMwb/FalconHTTP](https://github.com/privateMwb/FalconHTTP) |
| MiniDatabase | The embedded database `timedCall()` instruments | [privateMwb/MiniDatabase](https://github.com/privateMwb/MiniDatabase) |

Both are vendored under `backend/external/` and built from source via `add_subdirectory()` — there is no package manager step, since each already vendors its own dependencies.

**Frontend:** React 18, Vite, and lucide-react — managed normally via `frontend/package.json`.

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="installation"></a>📦 Installation

```bash
git clone https://github.com/privateMwb/FalconEye.git
cd FalconEye
```

**Backend:**

```bash
cd backend
cmake -B build
cmake --build build
./build/falconeye_server
```

**Frontend**, in a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` — the dashboard polls `http://localhost:8080/api/metrics` every 3 seconds. The example routes (`/api/health`, `/api/todos/:id`) only record data when something calls them, so send a few requests:

```bash
for i in 1 2 3 4 5; do curl -s localhost:8080/api/health localhost:8080/api/todos/1 > /dev/null; done
```

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="quick-start"></a>🚀 Quick Start

Wiring `Metrics` into a FalconHTTP server:

```cpp
#include <FalconHTTP/Core/Server.h>
#include <FalconHTTP/Routing/Router.h>
#include "Metrics.h"
#include "MetricsJson.h"

FalconHTTP::Routing::Router router;
// ... register your own routes on router ...

Metrics metrics(router, /*bufferCapacity=*/50);

router.get("/api/metrics", [&metrics](const auto&, auto& response) {
    response.setJson(metricsToJson(metrics));
});

FalconHTTP::Core::Server server(router, /*threadCount=*/4);
server.use(FalconHTTP::Middleware::Recovery{});
server.use(FalconHTTP::Middleware::Logger{});
server.use(metrics); // last — captures the full request, including the handler

server.start(8080);
server.run();
```

Timing a database call inside a route handler:

```cpp
#include "DbTiming.h"

router.get("/api/todos/:id", [&](const auto& request, auto& response) {
    auto id = std::stoul(request.pathParam("id"));

    auto result = timedCall("dbQuery", [&]() {
        return queryEngine.selectByID(*table, id);
    });
    // result's duration now lands in this request's `breakdown` array
});
```

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="dashboard"></a>🖥️ Dashboard

A single-column React page (it reads well on a phone as well as a desktop):

- **Header** — a live/connection-lost indicator and the current requests per second.
- **Throughput** — a sparkline of requests per second, derived from successive polls.
- **Summary** — total requests, errors in the buffered window, and average response time.
- **Recent requests** — status, method, matched route and duration, newest first. Tap one to see its DB timing breakdown.
- **Connection lost** — if a poll fails, the page keeps the last known data and shows the URL it could not reach.

**Pointing it at a server.** The dashboard reads `http://localhost:8080/api/metrics` by default. Override it per build with `VITE_DEFAULT_TARGET` (for example `https://falconeye-demo.onrender.com`), or per visit with `?target=<base url>`. The server's `Cors` middleware must allow the dashboard's origin; `backend/src/main.cpp` allows `http://localhost:5173`.

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="metrics-api"></a>🔌 Metrics API

`GET /api/metrics` returns:

```json
{
  "requestCount": 214,
  "errorCount": 3,
  "avgResponseMs": 4.82,
  "recentRequests": [
    {
      "route": "/api/todos/:id",
      "method": "GET",
      "status": 200,
      "totalMs": 12.48,
      "timestamp": "2026-08-11T09:41:02Z",
      "breakdown": [{ "name": "dbQuery", "ms": 9.11 }]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `requestCount` | Lifetime total of recorded requests (not capped by the buffer). |
| `errorCount` | Requests with status `>= 400` **within the buffered window only**. |
| `avgResponseMs` | Mean `totalMs` over the buffered window. |
| `recentRequests` | The buffered entries, oldest first. |
| `route` | The matched route *pattern*, not the raw path. |
| `breakdown` | Steps added by `timedCall()`; empty when the handler made none. |

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="testing"></a>🧪 Testing

```bash
cd backend && cmake -B build && cmake --build build
./build/falconeye_tests            # all suites
./build/falconeye_tests list       # list the suites
./build/falconeye_tests MetricsJson  # run one

node --test scripts/tests/*.test.mjs  # the hosted-demo front door
```

| Layer | What it covers | Where |
|---|---|---|
| Unit tests | Ring buffer order, wraparound and concurrency; the `/api/metrics` JSON shape and text round-trips; `timedCall()` and its per-thread isolation | `backend/tests/` |
| Sanitizers | The real server booted under ASan + UBSan, then TSan, hit with real requests | `.github/workflows/sanitizers.yml` |
| Fuzzing | ClusterFuzzLite harnesses on the metrics serialization path and `timedCall()` | `backend/fuzz/`, `.clusterfuzzlite/` |
| Static analysis | clang-tidy and CodeQL | `.github/workflows/` |
| Demo check | `scripts/check-demo.sh` against a running hosted demo | `scripts/` |

Fuzz harnesses are small functions named `fuzz_<target>.cpp` in `backend/fuzz/`; each one becomes its own binary with no build-file edit, and its seed inputs live in `backend/fuzz/corpus/<harness>/`.

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="deployment"></a>☁️ Deployment

A hosted demo needs a backend that produces data and a place to serve the dashboard:

- **Render (backend)** — `render.yaml` builds `Dockerfile.demo`: the real `falconeye_server`, a traffic generator that keeps the metrics interesting, and a small read-only front door that forwards only `/api/metrics` and `/api/health` and answers CORS for your dashboard's origin.
- **Vercel (dashboard)** — import the repo with Root Directory `frontend`, and set `VITE_DEFAULT_TARGET` to your Render URL.

```bash
# Render:  New → Blueprint, pick this repo (render.yaml), then set ALLOWED_ORIGINS
# Vercel:  import the repo, Root Directory = frontend, set VITE_DEFAULT_TARGET
scripts/check-demo.sh https://<your-service>.onrender.com https://<your-dashboard>.vercel.app
```

> [!NOTE]
> On Render's free plan the service sleeps when idle: the first visit afterwards takes about a minute, and the metrics start again from zero.

The step-by-step guide, including a local Docker run, is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The hosted-demo image has not been deployed yet, so expect to fix small things on the first run.

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="project-structure"></a>🗂️ Project Structure

```
FalconEye/
├── backend/
│   ├── include/
│   │   ├── Metrics.h
│   │   ├── DbTiming.h
│   │   └── MetricsJson.h
│   ├── src/
│   │   ├── main.cpp
│   │   └── routes/
│   │       └── ExampleRoutes.h
│   ├── tests/
│   │   ├── suite/unit/
│   │   ├── support/
│   │   └── test_main.cpp
│   ├── fuzz/
│   │   ├── corpus/
│   │   ├── fuzz_metrics_json.cpp
│   │   └── fuzz_db_timing.cpp
│   ├── external/
│   │   ├── falconhttp/
│   │   └── minidb/
│   └── CMakeLists.txt
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vercel.json
│   └── vite.config.js
│
├── scripts/
│   ├── demo-server.mjs
│   ├── check-demo.sh
│   ├── capture-screenshots.mjs
│   └── tests/
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEMO.md
│   ├── DEPLOYMENT.md
│   ├── Doxyfile
│   └── images/
│       └── dashboard.png
│
├── .clusterfuzzlite/
├── .github/
│   ├── assets/
│   ├── releases/
│   ├── workflows/
│   ├── CODEOWNERS
│   └── dependabot.yml
│
├── Dockerfile.demo
├── render.yaml
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── .clang-format
├── .clang-tidy
├── .gitignore
├── README.md
└── LICENSE
```

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="development"></a>🛠️ Development

**Build the backend** (Debug by default):

```bash
cd backend
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
./build/falconeye_tests
```

**Run the frontend dev server:**

```bash
cd frontend
npm run dev
```

**Check formatting and static analysis locally**, same checks CI runs:

```bash
find backend/include backend/src \( -name "*.h" -o -name "*.cpp" \) -exec clang-format --dry-run --Werror {} +
clang-tidy -p backend/build $(find backend/include backend/src -name "*.h" -o -name "*.cpp")
```

**Build the frontend for production:**

```bash
cd frontend
npm run build
```

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="known-limitations"></a>⚠️ Known Limitations

- **The dashboard is backend-agnostic; the middleware is not.** The React frontend only depends on `/api/metrics`'s JSON shape (`requestCount`, `errorCount`, `avgResponseMs`, `recentRequests[]`) — any backend serving that shape works unmodified. `Metrics.h`, by contrast, is written directly against FalconHTTP's `MiddlewareFn` signature and `Router`/`PathMatcher` APIs; using a different backend framework means reimplementing the middleware against that framework's equivalent hooks, producing the same JSON contract.
- **`breakdown` only reports database calls, not per-middleware timing.** `Recovery`, `Logger`, and `Cors` are compiled into the untouched FalconHTTP library and have no hook into `timedCall()`'s mechanism — only calls explicitly wrapped at a route-handler call site (like `dbQuery`) show up.
- **The buffer capacity must be at least 1.** `Metrics(router, 0)` is not rejected, and a zero-sized ring buffer divides by zero on the first push. The server uses 50.
- **The buffer is small and in memory.** Only the latest entries are kept (50 by default), `errorCount` and `avgResponseMs` describe that window, and everything resets when the process restarts.
- **No authentication on `/api/metrics`.** Route patterns and timings are readable by anyone who can reach the port. See [SECURITY.md](SECURITY.md).
- **Linux only, currently.** Everything in this project has been built and run on Linux (GCC and Clang). FalconHTTP's socket code hasn't been verified for POSIX-only assumptions, and nothing here has been tested on macOS or MSVC — CI reflects this rather than claiming untested support.
- **No code coverage reporting yet.** There is a unit test suite, but no coverage numbers are collected.

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="documentation"></a>📖 Documentation

Full API reference, generated with Doxygen from `docs/Doxyfile`:

**https://privateMwb.github.io/FalconEye/**

Guides in [`docs/`](docs/):

- [Architecture](docs/ARCHITECTURE.md) — the request path, the thread-local breakdown, and the design choices behind them
- [Demo](docs/DEMO.md) — a short tour of the dashboard
- [Deployment](docs/DEPLOYMENT.md) — the Render + Vercel setup, step by step

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="contributing"></a>🤝 Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and checks. In short: run `clang-format`, `clang-tidy` and the test suite locally (see [Development](#development)) — CI enforces all three.

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="changelog"></a>📝 Changelog

See [CHANGELOG.md](CHANGELOG.md), and the [Releases](https://github.com/privateMwb/FalconEye/releases) page for release notes.

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="security"></a>🔒 Security

FalconEye is a development and demonstration tool: `/api/metrics` has no authentication or encryption. Read [SECURITY.md](SECURITY.md) before exposing it, and report suspected vulnerabilities privately through the repository's **Security** tab.

<div align="right"><a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a></div>

## <a id="license"></a>📄 License

MIT — see [LICENSE](LICENSE) for details.

<p align="center">
  <sub>Built with C++23 and React</sub>
</p>

<p align="center">
  <a href="#-table-of-contents"><img src=".github/assets/back-to-top.svg" alt="Back to top" height="28"></a>
</p>
