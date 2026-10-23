#!/usr/bin/env bash
set -euo pipefail
workspace_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
image_name=${HORIZON_IMAGE:-radio-horizon-planner:0.2.0}
if ! docker image inspect "$image_name" >/dev/null 2>&1; then
  docker build -f "$workspace_root/apps/horizon/Dockerfile" \
    --build-arg HORIZON_REVISION="$(git -C "$workspace_root" rev-parse HEAD)" \
    -t "$image_name" "$workspace_root"
fi
exec "$workspace_root/apps/horizon/scripts/start.sh"
