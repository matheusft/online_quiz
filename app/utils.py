import io
import qrcode
from munch import Munch


def generate_qr_png(url: str, box_size: int = 10, border: int = 4) -> bytes:
    """Generate a QR code PNG and return raw bytes."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=box_size,
        border=border,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def load_config(path: str) -> Munch:
    import yaml
    with open(path, "r") as f:
        raw = yaml.safe_load(f)
    return Munch.fromDict(raw)


def load_questions(path: str) -> list:
    import yaml
    with open(path, "r") as f:
        raw = yaml.safe_load(f)
    return raw.get("questions", [])
