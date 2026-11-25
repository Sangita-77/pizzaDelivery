# Platform entrypoint (managed on port 8001). The user's backend of choice is
# Node.js (Express + Mongoose) in this directory; this thin proxy forwards every
# /api/* request to the Node server on 127.0.0.1:8007 so the platform's
# supervisor/uvicorn contract, /health probe and ingress keep working unchanged.
import asyncio
import logging
import os
import socket
import subprocess
from contextlib import suppress
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import Response

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("fornello-proxy")

NODE_PORT = int(os.environ.get("NODE_PORT", "8007"))
NODE_URL = f"http://127.0.0.1:{NODE_PORT}"
NODE_LOG = open("/var/log/supervisor/node-backend.log", "ab")
HOP_HEADERS = {"host", "content-length", "connection", "keep-alive", "transfer-encoding", "upgrade"}

app = FastAPI()
client = httpx.AsyncClient(base_url=NODE_URL, timeout=httpx.Timeout(60.0, connect=10.0))


def node_alive() -> bool:
    with socket.socket() as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", NODE_PORT)) == 0


def spawn_node() -> None:
    env = dict(os.environ)
    env["PORT"] = str(NODE_PORT)
    subprocess.Popen(
        ["node", "server.js"],
        cwd=ROOT_DIR,
        env=env,
        stdout=NODE_LOG,
        stderr=NODE_LOG,
        start_new_session=True,
    )
    logger.info("spawned node backend on port %s", NODE_PORT)


async def node_supervisor() -> None:
    # Boot the Node backend (installing deps if missing), then keep watch.
    if not node_alive():
        if not (ROOT_DIR / "node_modules").exists():
            logger.info("node_modules missing — running npm install")
            try:
                proc = await asyncio.create_subprocess_exec(
                    "npm", "install", cwd=str(ROOT_DIR),
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
                )
                await asyncio.wait_for(proc.wait(), timeout=420)
                logger.info("npm install finished with code %s", proc.returncode)
            except Exception as exc:
                logger.error("npm install failed: %s", exc)
        spawn_node()
        for _ in range(240):
            if node_alive():
                break
            await asyncio.sleep(0.5)
    while True:
        await asyncio.sleep(15)
        if not node_alive():
            logger.warning("node backend is down — respawning")
            spawn_node()


@app.on_event("startup")
async def start_node_backend() -> None:
    app.state.node_task = asyncio.create_task(node_supervisor())


@app.on_event("shutdown")
async def stop_supervisor_task() -> None:
    # Leave the Node process running across uvicorn --reload restarts; the
    # port check prevents duplicates. Cancel only the watchdog loop.
    with suppress(asyncio.CancelledError, Exception):
        app.state.node_task.cancel()
        await app.state.node_task


# Probe endpoint for the deployer and pod health checks: root-level (not /api), no DB call.
@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


async def proxy(request: Request, path: str) -> Response:
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP_HEADERS}
    resp = await client.request(
        request.method,
        f"/api/{path}" if path else "/api",
        content=body,
        headers=headers,
        params=request.query_params,
    )
    resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in HOP_HEADERS}
    return Response(content=resp.content, status_code=resp.status_code, headers=resp_headers)


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_api(request: Request, path: str):
    return await proxy(request, path)


@app.api_route("/api", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_api_root(request: Request):
    return await proxy(request, "")
