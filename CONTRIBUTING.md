# Contributing to FalconEye

Issues and pull requests are welcome. This guide covers how to set up, what CI checks, and
how a change gets merged.

## Setting up

```bash
git clone https://github.com/privateMwb/FalconEye.git
cd FalconEye

cd backend
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
./build/falconeye_tests

cd ../frontend
npm install
npm run dev
```

FalconHTTP and MiniDatabase are committed under `backend/external/`, so there is nothing
else to fetch. Requirements: a C++23 compiler (GCC or Clang, Linux), CMake 3.20+, and
Node.js 20+ (22 for the demo scripts' tests).

## The workflow

1. Create a branch from `main`.
2. Make your change, with tests where it makes sense.
3. Run the checks below.
4. Open a pull request. CI runs on it; merge once everything passes.

## Checks to run locally

CI enforces all of these:

```bash
# Formatting (backend/include and backend/src only; external/ is upstream code)
find backend/include backend/src \( -name "*.h" -o -name "*.cpp" \) -exec clang-format --dry-run --Werror {} +

# Static analysis
clang-tidy -p backend/build $(find backend/include backend/src -name "*.h" -o -name "*.cpp")

# Tests
./backend/build/falconeye_tests
node --test scripts/tests/*.test.mjs

# Frontend
cd frontend && npm run build
```

## What to test

- **Ring buffer or thread-local breakdown changes** (`Metrics.h`, `DbTiming.h`): add or
  extend a case in `backend/tests/suite/unit/`, and say in the PR how you checked it under
  concurrent load. The TSan job in `sanitizers.yml` is the closest regression check.
- **JSON output changes** (`MetricsJson.h`): the dashboard depends on the field names and
  types, so update `metricsJson.cpp` and the Metrics API table in the README together.
- **New code that parses or serializes text:** consider a harness in `backend/fuzz/`. Any
  `fuzz_<name>.cpp` file there is built automatically; put a few seed inputs in
  `backend/fuzz/corpus/fuzz_<name>/`.

## Style

- C++ follows `.clang-format` and the naming rules in `.clang-tidy`: PascalCase types,
  camelBack functions and variables.
- Comments explain why, not what.
- Keep the README, `CHANGELOG.md` and `docs/` in step with behavior changes. Add an entry
  under `[Unreleased]` in the changelog.

## Reporting bugs and vulnerabilities

For bugs, open an issue with the steps to reproduce, the commit you tested, and what you
expected. **Do not** report suspected vulnerabilities in public; see
[SECURITY.md](SECURITY.md).
