#!/usr/bin/env python3
"""
PhyStack Edge App Template (CUDA)

This template demonstrates how to create a GPU-capable Python edge app
using the phystack-hub-client package on the phygrid/cuda-base image.
"""

import asyncio
import ctypes
import json
import signal
import sys
from typing import Any, Optional

from phystack.hub_client import connect_phy_client


def gpu_available() -> bool:
    """True when the NVIDIA driver is reachable (container runs with GPU access).

    On PhyOS the GPU is granted via the `DeviceRequests` entry in settings.json
    (amd64) / the nvidia container runtime (Jetson). No CUDA python packages are
    needed for this check — libcuda is injected by the runtime.
    """
    try:
        cuda = ctypes.CDLL("libcuda.so.1")
        return cuda.cuInit(0) == 0
    except OSError:
        return False


async def main() -> None:
    """Main application entry point."""
    print("Starting PhyStack Edge App (CUDA)...")
    print(f"GPU available: {gpu_available()}")

    # Connect to PhyHub
    client = await connect_phy_client()

    print("Connected to PhyHub")

    # Get edge instance
    instance = await client.get_instance()
    if not instance:
        print("Error: Could not get edge instance")
        await client.disconnect()
        return

    print(f"Edge instance ID: {instance.id}")

    # Get settings
    settings = await client.get_settings()
    print(f"Settings: {json.dumps(settings, indent=2)}")

    # Listen for incoming messages
    def on_message(data: Any, respond: Optional[Any] = None) -> None:
        print(f"Received message: {data}")
        if respond:
            respond({"status": "ok", "received": data})

    instance.on("message", on_message)

    # Example: periodic task
    counter = 0

    async def periodic_task() -> None:
        nonlocal counter
        while True:
            counter += 1
            print(f"Hello, world! Counter: {counter}")
            print(f"Current settings: {json.dumps(settings, indent=2)}")

            # Example: emit an event to subscribers
            # instance.emit("status", {"counter": counter})

            await asyncio.sleep(3)

    # Handle graceful shutdown
    shutdown_event = asyncio.Event()

    def signal_handler(sig: int, frame: Any) -> None:
        print(f"\nReceived signal {sig}, shutting down...")
        shutdown_event.set()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Run periodic task until shutdown
    periodic = asyncio.create_task(periodic_task())

    try:
        await shutdown_event.wait()
    finally:
        periodic.cancel()
        try:
            await periodic
        except asyncio.CancelledError:
            pass
        await client.disconnect()
        print("Disconnected from PhyHub")


if __name__ == "__main__":
    asyncio.run(main())
