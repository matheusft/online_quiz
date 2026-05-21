import os
from flask import Flask
from flask_socketio import SocketIO
from pathlib import Path
from dotenv import load_dotenv

# Resolve .env from the project root regardless of the working directory.
load_dotenv(Path(__file__).parent.parent / ".env")

from .utils import load_config, load_questions
from . import quiz_state as qs

socketio = SocketIO()
config = None


def create_app(config_path: str = None) -> Flask:
    global config

    app = Flask(
        __name__,
        static_folder="../static",
        template_folder="../templates",
    )

    # Load config
    if config_path is None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        config_path = os.path.join(base, "config", "config.yaml")

    config = load_config(config_path)

    # SECRET_KEY and MASTER_CODE must come from the environment (.env locally, dashboard on Render).
    secret_key = os.environ.get("SECRET_KEY")
    if not secret_key:
        raise RuntimeError("SECRET_KEY environment variable is not set")

    config.quiz.master_code = os.environ.get("MASTER_CODE", "password")

    if os.environ.get("QR_PUBLIC_URL"):
        config.qr.public_url = os.environ["QR_PUBLIC_URL"]

    app.config["SECRET_KEY"] = secret_key
    app.config["APP_CONFIG"] = config

    # Load questions
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    questions_path = os.path.join(base, config.quiz.questions_file)
    qs.load_questions(load_questions(questions_path))

    # Register blueprint
    from .routes import bp
    app.register_blueprint(bp)

    # Init SocketIO
    socketio.init_app(
        app,
        cors_allowed_origins="*",
        async_mode="gevent",
    )

    # Register socket events
    from . import socket_events  # noqa: F401

    return app
