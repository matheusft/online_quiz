# gevent monkey-patch must happen before any other imports
from gevent import monkey
monkey.patch_all()

import os
import signal
import subprocess
import time

from app import create_app, socketio


def free_port(port: int):
    """Kill any process currently listening on the given port and wait for release."""
    try:
        result = subprocess.run(
            ["lsof", "-ti", f":{port}"],
            capture_output=True, text=True
        )
        pids = [p for p in result.stdout.strip().split() if p]
        if not pids:
            return
        for pid in pids:
            os.kill(int(pid), signal.SIGKILL)
            print(f"Killed process {pid} occupying port {port}")
        for _ in range(30):
            time.sleep(0.1)
            check = subprocess.run(
                ["lsof", "-ti", f":{port}"],
                capture_output=True, text=True
            )
            if not check.stdout.strip():
                break
    except Exception:
        pass


app = create_app()

if __name__ == "__main__":
    cfg = app.config["APP_CONFIG"]
    port = cfg.app.port
    free_port(port)
    socketio.run(
        app,
        host=cfg.app.host,
        port=port,
        debug=cfg.app.debug,
    )
