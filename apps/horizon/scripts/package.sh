#!/usr/bin/env bash
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_dir"
version=0.2.0
release_dir="$repo_dir/release/radio-horizon-planner-${version}-linux-x86_64"
mkdir -p "$release_dir"
uv export --frozen --no-dev --no-emit-project --output-file requirements.lock
git diff --quiet && git diff --cached --quiet || { echo 'Commit source changes before packaging.' >&2; exit 1; }
git rev-parse HEAD > "$release_dir/SOURCE_COMMIT"
docker build --platform linux/amd64 --build-arg HORIZON_REVISION="$(git rev-parse HEAD)" -t "radio-horizon-planner:${version}" -f Dockerfile "$(git rev-parse --show-toplevel)"
docker save "radio-horizon-planner:${version}" | gzip > "$release_dir/image.tar.gz"
cp scripts/start.sh scripts/stop.sh README.md "$release_dir/"
cp -r docs "$release_dir/"
git archive --format=tar.gz --output="$release_dir/source.tar.gz" HEAD
chmod +x "$release_dir/start.sh" "$release_dir/stop.sh"
(cd "$release_dir" && sha256sum image.tar.gz start.sh stop.sh README.md SOURCE_COMMIT source.tar.gz > SHA256SUMS)
tar -C release -czf "release/radio-horizon-planner-${version}-linux-x86_64.tar.gz" "radio-horizon-planner-${version}-linux-x86_64"
sha256sum "release/radio-horizon-planner-${version}-linux-x86_64.tar.gz"
