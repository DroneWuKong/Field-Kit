#!/usr/bin/env bash
set -euo pipefail
container_name=${HORIZON_CONTAINER:-radio-horizon-planner}
docker stop "$container_name"
printf 'Planner stopped. Projects and terrain are retained.\n'
