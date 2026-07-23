# CLAUDE.md — template-edge-python-cuda

Starter template for PhyStack **EDGE** apps that need **GPU / CUDA**:
Python apps built on the shared `phygrid/cuda-base` image that run on PhyOS
devices and talk to the platform through `phystack-hub-client` (an Edge
twin). Scaffolded by `phy app init <name> --type edge --lang python-cuda`.

## Commands (bun for tooling, python for the app)

| Command | What it runs |
|---|---|
| `bun install` | Dev tooling (`ts-schema`, TypeScript) |
| `pip install -r requirements.txt` | Python runtime dependencies |
| `bun run dev` | `phy-simulator run . --dev-command 'python src/app.py'` — twin on the running simulator + the app connected to it |
| `bun run start` | `python src/app.py` — run the app directly |
| `bun run build` | Compile `src/schema.ts` to `build/`, copy `src/*.py` + `requirements.txt` into `build/`, `touch build/index.html` |
| `bun run pub` | `bun run build && phy app build create $npm_package_name --dir . --push --publish` |

Note: `src/schema.ts` is TypeScript **only for schema authoring** — the app
itself is pure Python. `bun run build` stages files; it does not build a
container (that happens in `pub` via the CLI).

## The CUDA base image — per-arch reality

`FROM phygrid/cuda-base:<tag>` is one multi-arch tag with a different NVIDIA
base per arch (see https://github.com/phystack/cuda-base):

- **amd64** — nvidia/cuda **12.9** runtime, Ubuntu 24.04, Python 3.12.
  TensorRT + cuDNN + NVENC FFmpeg/PyAV baked in.
- **arm64 (Jetson)** — nvcr.io/nvidia/l4t-cuda **12.6** runtime (L4T r36 /
  JetPack 6), Ubuntu 22.04, Python 3.10. **cuDNN/TensorRT are NOT bundled** —
  install from the NVIDIA Jetson apt repos
  (`repo.download.nvidia.com/jetson/{t234,common} r36.4`) in the Dockerfile
  if the app needs them.

Rules that follow from this:
- The GPU **driver** (`libcuda`) is injected from the host by the nvidia
  container runtime — never install a driver in the image.
- Keep Python code compatible with **3.10 and 3.12** (the two arches differ).
- `pip install` needs `--break-system-packages` (amd64 base is PEP-668
  externally managed; harmless on arm64).
- GPU access on-device comes from the `DeviceRequests` nvidia entry in
  `settings.json` — do not remove it. `src/app.py:gpu_available()` is a
  dependency-free runtime check (ctypes `libcuda.so.1` + `cuInit`).

## Dev loop

- Install the standalone simulator once (`npm i -g @phystack/device-simulator`,
  provides the `phy-simulator` binary) and start it in a separate terminal:
  `phy-simulator start` (simulated device on `:55000`). Then `bun run dev`
  creates a twin on it and runs the app connected to it — `run` requires
  the server to already be running.
- The `predev` hook generates `src/settings/index.json` from the schema
  defaults — a local-dev bootstrap only; delete it to regenerate. In
  production, settings arrive on the Edge twin's desired properties.
- Local dev machines usually lack the GPU/driver — `gpu_available()` returning
  `False` locally is expected; the app must degrade gracefully.

## Publish flow (new `phy` CLI grammar)

```bash
phy login
phy app create <name> --type edge   # register in your tenant (once)
phy registry login docker.io        # container registry credentials (once)
bun run pub                         # build + push image, submit + publish build
```

The legacy `@phystack/cli` (Node) does not work with this template — use the
Rust `phy` CLI only.

## Layout

| Path | Purpose |
|---|---|
| `src/app.py` | Entrypoint — hub-client connection, settings handling, twin messaging, GPU check |
| `src/schema.ts` | Installation-settings schema source (→ `build/schema.json` + `meta-schema.json`) |
| `requirements.txt` | Python runtime dependencies (`phystack-hub-client`) |
| `settings.json` | Docker `createOptions` (HostConfig) attached to the build — includes the nvidia GPU `DeviceRequests` |
| `Dockerfile` | GPU runtime image (`FROM phygrid/cuda-base`) |
| `scripts/init-settings.js` | Generates local dev settings from schema defaults |

## Gotchas

- `application-type` in package.json must stay `edge` — the CLI validates it
  on `phy app build create`.
- The package.json `name` is the app name used by `pub`
  (`$npm_package_name`); `phy app init` patches it on scaffold.
- Keep this template in step with `template-edge-python` — only the runtime
  image (cuda-base vs python:slim) and the GPU grant in `settings.json`
  differ.
- Pin the `phygrid/cuda-base` tag in the Dockerfile and bump deliberately;
  its CI auto-increments patch versions.
