# template-edge-python-cuda

Starter template for PhyStack **EDGE** apps that need **GPU / CUDA** — Python
apps on the shared [`phygrid/cuda-base`](https://github.com/phystack/cuda-base)
image, running on PhyOS devices. Scaffolded by the PhyStack CLI
(`phy app init --type edge --lang python-cuda`) or usable directly.

Identical to [`template-edge-python`](https://github.com/phystack/template-edge-python)
except the runtime image: instead of `python:slim`, apps build on
`phygrid/cuda-base`, and the container is granted GPU access via
`DeviceRequests` in `settings.json`.

## The base image (per-arch)

`phygrid/cuda-base` is one multi-arch tag with a different NVIDIA base per arch:

| | amd64 | arm64 (Jetson) |
|---|---|---|
| CUDA | 12.9 runtime | 12.6 runtime (L4T r36 / JetPack 6) |
| OS / Python | Ubuntu 24.04 / 3.12 | Ubuntu 22.04 / 3.10 |
| TensorRT / cuDNN | baked in | **not bundled** — add from the NVIDIA Jetson apt repos if needed |

The GPU **driver** always comes from the host (nvidia container runtime); the
image only ships the CUDA userland. `src/app.py` includes a dependency-free
`gpu_available()` check.

## Getting started

```bash
# Scaffold via the PhyStack CLI
phy app init my-gpu-app --type edge --lang python-cuda

# Or work directly from this template
bun install                       # dev tooling (schema build)
pip install -r requirements.txt   # Python runtime deps
bun run build
```

## Local development (simulator)

```bash
npm i -g @phystack/device-simulator   # once — provides the phy-simulator binary
phy-simulator start                   # terminal 1: simulated device on :55000
bun run dev                           # terminal 2: `python src/app.py` inside it
```

`bun run dev` runs `phy-simulator run .`, which creates a local twin on the
running simulator and launches the app connected to it. Settings for local
runs are generated into `src/settings/index.json` from the schema defaults
(regenerated automatically; delete the file to reset).

## Flow

```bash
# 1. Edit src/schema.ts (installation settings) and src/app.py (device logic)
# 2. Local build: compile the settings schema and stage the Python sources into build/
bun run build

# 3. Register the app in your tenant (once)
phy app create my-gpu-app --type edge

# 4. Log in to your container registry (once)
phy registry login docker.io

# 5. Build + push the image, submit and publish the build
bun run pub
```

`pub` runs `phy app build create $npm_package_name --dir . --push --publish` —
the image ref is derived from your registry login, the pull credential is
attached automatically, and the build is published as soon as it processes.

## Layout

| Path | Purpose |
|------|---------|
| `src/app.py` | App entrypoint (hub-client connection, settings, twin messaging, GPU check) |
| `src/schema.ts` | Installation-settings schema (TypeScript is used only for schema authoring) |
| `requirements.txt` | Python runtime dependencies (`phystack-hub-client`) |
| `settings.json` | Docker `createOptions` attached to the build — includes the nvidia `DeviceRequests` GPU grant |
| `Dockerfile` | GPU runtime image (`FROM phygrid/cuda-base`) |
| `scripts/init-settings.js` | Generates local dev settings from schema defaults |
