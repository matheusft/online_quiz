# gevent monkey-patch must happen before any other imports
from gevent import monkey
monkey.patch_all()

import os
import signal
import time

from app import create_app, socketio


def free_port(port: int):
    """Kill any process currently listening on the given port and wait for release."""
    import socket as _sock
    try:
        # os.popen avoids subprocess deadlocks under gevent monkey-patching
        raw = os.popen(f"lsof -ti :{port}").read()
        pids = [p for p in raw.strip().split() if p]
        if not pids:
            return
        for pid in pids:
            os.kill(int(pid), signal.SIGKILL)
            print(f"Killed process {pid} occupying port {port}")
        # Poll with a socket bind — more reliable than a second lsof call
        for _ in range(50):
            time.sleep(0.1)
            try:
                s = _sock.socket(_sock.AF_INET, _sock.SOCK_STREAM)
                s.setsockopt(_sock.SOL_SOCKET, _sock.SO_REUSEADDR, 1)
                s.bind(("0.0.0.0", port))
                s.close()
                break
            except OSError:
                pass
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
