from flask import Blueprint, render_template, redirect, url_for, send_file, current_app
import io

from .utils import generate_qr_png

bp = Blueprint("main", __name__)


@bp.route("/")
def index():
    return redirect(url_for("main.student"))


@bp.route("/admin")
def admin():
    return render_template("admin.html")


@bp.route("/student")
def student():
    return render_template("student.html")


@bp.route("/qrcode")
def qrcode():
    cfg = current_app.config["APP_CONFIG"]
    png_bytes = generate_qr_png(
        url=cfg.qr.public_url,
        box_size=cfg.qr.box_size,
        border=cfg.qr.border,
    )
    return send_file(
        io.BytesIO(png_bytes),
        mimetype="image/png",
        download_name="quiz_qr.png",
    )
