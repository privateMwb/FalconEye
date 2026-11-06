# Changelog

All notable changes to FalconEye are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Unit test suite (`backend/tests/`, run with `./build/falconeye_tests`) covering the metrics
  ring buffer (order, wraparound, concurrent pushes), the `/api/metrics` JSON (field shape and
  text round-trips) and `timedCall()` (step order and per-thread isolation). The Build
  workflow now runs it after every build.
- ClusterFuzzLite fuzzing (`.clusterfuzzlite/`, `backend/fuzz/`): harnesses for the metrics
  serialization path and `timedCall()`, with seed inputs, a short run on pull requests and a
  longer nightly run. Harnesses are picked up automatically from `backend/fuzz/fuzz_*.cpp`.
- Hosted-demo setup: `Dockerfile.demo`, `render.yaml`, `frontend/vercel.json`,
  `scripts/demo-server.mjs` (a traffic generator and a read-only front door with CORS) and
  `scripts/check-demo.sh`, plus the `Demo image` workflow that builds and checks the image.
- `Screenshots` workflow and `scripts/capture-screenshots.mjs` to regenerate the README
  screenshots from a live dashboard.
- CodeQL workflow (C/C++ and JavaScript), `CODEOWNERS`, and Dependabot for GitHub Actions,
  npm and Docker.
- `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, and guides under `docs/`
  (`ARCHITECTURE.md`, `DEMO.md`, `DEPLOYMENT.md`).
- Animated banner, divider and back-to-top artwork under `.github/assets/`.

### Changed

- Project layout now matches RaftKV: `server/` is `backend/`, `server/third_party/` is
  `backend/external/`, and `docs/assets/` is `docs/images/`. Build commands change from
  `cd server` to `cd backend`.
- The root README is restructured: badge groups, a table of contents, a "How It Works"
  section, a Metrics API reference, Testing and Deployment sections, and an updated
  Known Limitations list.

## [1.0.0]

First release: a live observability dashboard for FalconHTTP servers.

### Added

**Server**

- `Metrics` middleware that times the full request/response cycle, registered last in the
  chain so it covers the matched route handler.
- Route pattern resolution: `MetricEntry::route` reports the matched pattern
  (`/api/todos/:id`), not the raw path, by re-running FalconHTTP's `PathMatcher` against the
  `Router`'s own routes.
- `timedCall()` (`DbTiming.h`) for per-request database call timing, using a thread-local
  pointer set by `Metrics` around each request.
- Thread-safe, fixed-capacity (default 50) overwrite-oldest ring buffer.
- Exception safety: a throwing handler is still recorded before the exception reaches
  `Recovery`.
- `GET /api/metrics` with `requestCount`, `errorCount`, `avgResponseMs` and
  `recentRequests[]` (oldest first). The endpoint does not record itself.

**Frontend**

- Vite + React dashboard polling `/api/metrics` every 3 seconds: throughput sparkline, summary
  stats, a scrollable request log, and a per-request DB timing breakdown.
- Keeps the last known data and shows a "connection lost" indicator when a poll fails.

**CI**

- Build (GCC and Clang, Debug and Release), Clang Format, Clang Tidy, Sanitizers (ASan +
  UBSan, TSan), Frontend build, Docs (Doxygen to GitHub Pages) and Release workflows.

### Known limitations

- `breakdown` only contains entries added through `timedCall()`; there is no per-middleware
  timing.
- Linux only.

[Unreleased]: https://github.com/privateMwb/FalconEye/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/privateMwb/FalconEye/releases/tag/v1.0.0
