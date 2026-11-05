#!/usr/bin/env bash
# ============================================================
# falconeye-migrate.sh
#
# Finishes the FalconEye restructure after the tarball has been
# extracted over the repo root:
#
#   server/                -> backend/        (the tarball already put the
#                                              changed files there)
#   server/third_party/    -> backend/external/
#   docs/assets/           -> docs/images/
#
# Moves are done with `git mv` so history follows the files. Run it
# once, from the repo root, on a clean branch:
#
#   git checkout -b chore/restructure
#   tar zxf falconeye-restructure.tar.gz
#   bash falconeye-migrate.sh
# ============================================================

set -euo pipefail

if [ ! -d .git ] || [ ! -d server/third_party ]; then
    echo "Run this from the FalconEye repo root, on a checkout that still has server/third_party." >&2
    exit 1
fi
if [ -d backend/external ]; then
    echo "backend/external already exists; the migration looks like it has already run." >&2
    exit 1
fi

echo "Moving the vendored libraries..."
git mv server/third_party backend/external

echo "Removing the old server/ files (their updated copies are already in backend/)..."
git rm -rq server
rm -rf server

if [ -d docs/assets ]; then
    echo "Moving docs/assets to docs/images..."
    mkdir -p docs/images
    git mv docs/assets/dashboard.png docs/images/dashboard.png
    rmdir docs/assets 2>/dev/null || true
fi

chmod +x scripts/check-demo.sh .clusterfuzzlite/build.sh

git add -A
echo
echo "Done. Review with:  git status"
echo "Then build and test:"
echo "  cd backend && cmake -B build && cmake --build build && ./build/falconeye_tests"
