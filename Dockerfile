# PhyStack CUDA edge app — built on the shared GPU base image.
# phystack/cuda-base is multi-arch with a per-arch NVIDIA base:
#   amd64 -> nvidia/cuda 12.9 runtime (Ubuntu 24.04, Python 3.12;
#            TensorRT + cuDNN + NVENC FFmpeg/PyAV baked in)
#   arm64 -> nvcr.io/nvidia/l4t-cuda 12.6 runtime (Jetson / L4T r36,
#            Ubuntu 22.04, Python 3.10 — cuDNN/TensorRT NOT bundled;
#            add them from the NVIDIA Jetson apt repos if needed)
# Pin the tag and bump deliberately; see https://github.com/phystack/cuda-base
FROM phystack/cuda-base:v1.1.0

WORKDIR /app/

# System dependencies for aiortc (WebRTC) source builds. On most platforms
# aiortc installs from prebuilt wheels and these go unused, but they keep
# `pip install` working when a wheel is unavailable for the target arch.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libavdevice-dev \
    libavfilter-dev \
    libopus-dev \
    libvpx-dev \
    pkg-config \
    libsrtp2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies.
# --break-system-packages: required on the amd64 base (Ubuntu 24.04 PEP-668
# externally-managed Python); accepted as a no-op by the arm64 base's pip.
COPY requirements.txt ./
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt

# Copy application code
COPY src/ ./src/

CMD ["python", "src/app.py"]
