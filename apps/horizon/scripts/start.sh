#!/usr/bin/env bash
set -euo pipefail
bundle_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
image_name=${HORIZON_IMAGE:-radio-horizon-planner:0.2.0}
container_name=${HORIZON_CONTAINER:-radio-horizon-planner}
data_dir=${HORIZON_DATA:-${HOME}/.local/share/radio-horizon-planner}
port=${HORIZON_PORT:-8765}
mkdir -p -- "$data_dir"
if ! docker image inspect "$image_name" >/dev/null 2>&1; then
  if [[ ! -f "$bundle_dir/image.tar.gz" ]]; then
    echo "Image not installed. Run scripts/package.sh or extract the Linux release archive." >&2
    exit 1
  fi
  (cd "$bundle_dir" && sha256sum --check SHA256SUMS)
  docker load -i "$bundle_dir/image.tar.gz"
fi
if docker container inspect "$container_name" >/dev/null 2>&1; then
  existing_image=$(docker inspect --format '{{.Config.Image}}' "$container_name")
  if [[ "$existing_image" != "$image_name" ]]; then
    printf 'Existing container uses %s. Stop and rename it before starting %s; keep the same HORIZON_DATA directory.\n' "$existing_image" "$image_name" >&2
    exit 1
  fi
  docker start "$container_name" >/dev/null
else
  docker run -d --name "$container_name" --label app=radio-horizon-planner \
    --user "$(id -u):$(id -g)" --init \
    -p "127.0.0.1:${port}:8765" \
    -v "${data_dir}:/data" "$image_name" >/dev/null
fi
printf 'Horizon is available at http://127.0.0.1:%s\nData: %s\n' "$port" "$data_dir"
