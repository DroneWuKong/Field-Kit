FROM node:22-bookworm-slim AS ui
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PROJ_NETWORK=OFF \
    HORIZON_DATA=/data HORIZON_BUNDLED_GRIDS=/app/grids \
    OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 && rm -rf /var/lib/apt/lists/*
COPY requirements.lock ./
RUN pip install --no-cache-dir --require-hashes -r requirements.lock
COPY pyproject.toml ./
COPY horizon ./horizon
RUN pip install --no-cache-dir --no-deps .
RUN python -c "import rasterio, pyproj; import horizon.engine"
COPY scripts/fetch_grids.py scripts/grids.json ./scripts/
RUN python scripts/fetch_grids.py /app/grids
COPY --from=ui /src/frontend/dist ./frontend/dist
COPY README.md docs ./docs/
ARG HORIZON_REVISION=unrecorded
LABEL org.opencontainers.image.revision=$HORIZON_REVISION
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/api/v1/health')"
ENTRYPOINT ["horizon", "--data", "/data"]
CMD ["serve", "--host", "0.0.0.0", "--frontend", "/app/frontend/dist"]
