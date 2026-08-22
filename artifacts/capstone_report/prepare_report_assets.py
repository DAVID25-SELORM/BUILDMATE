from pathlib import Path

import fitz
from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent


def font(size, bold=False):
    name = "arialbd.ttf" if bold else "arial.ttf"
    return ImageFont.truetype(name, size)


def render_logo():
    source = Path(r"C:\Users\selorm\Downloads\regentlogo1.pdf")
    pdf = fitz.open(source)
    page = pdf[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(3, 3), alpha=False)
    raw = ROOT / "regentlogo1-raw.png"
    pix.save(raw)
    image = Image.open(raw).convert("RGB")
    white = Image.new("RGB", image.size, "white")
    difference = ImageChops.difference(image, white)
    difference = difference.point(lambda value: 0 if value < 18 else value)
    box = difference.getbbox()
    if box:
        left, top, right, bottom = box
        padding = 24
        box = (max(0, left - padding), max(0, top - padding), min(image.width, right + padding), min(image.height, bottom + padding))
        image = image.crop(box)
    image.save(ROOT / "regentlogo1.png", quality=95)
    raw.unlink(missing_ok=True)


def use_case_diagram():
    image = Image.new("RGB", (1500, 680), "white")
    draw = ImageDraw.Draw(image)
    green = (20, 92, 57)
    dark = (18, 37, 31)
    light = (234, 244, 239)

    draw.rounded_rectangle((270, 35, 1230, 645), radius=26, outline=green, width=5)
    draw.text((750, 62), "BUILDMATE GHANA SYSTEM", anchor="ma", font=font(30, True), fill=green)

    actors = [(110, 155, "Customer"), (110, 520, "Supplier"), (1390, 155, "Driver"), (1390, 520, "Administrator")]
    cases = [
        (520, 165, "Browse & search"), (980, 165, "Request quotation"),
        (520, 315, "Place & track order"), (980, 315, "Manage stock & offers"),
        (520, 465, "Process fulfilment"), (980, 465, "Verify & supervise"),
    ]

    for x, y, label in actors:
        draw.ellipse((x - 24, y - 70, x + 24, y - 22), outline=dark, width=4)
        draw.line((x, y - 22, x, y + 42), fill=dark, width=4)
        draw.line((x - 34, y, x + 34, y), fill=dark, width=4)
        draw.line((x, y + 42, x - 30, y + 88), fill=dark, width=4)
        draw.line((x, y + 42, x + 30, y + 88), fill=dark, width=4)
        draw.text((x, y + 100), label, anchor="ma", font=font(25, True), fill=dark)

    for x, y, label in cases:
        box = (x - 185, y - 42, x + 185, y + 42)
        draw.ellipse(box, fill=light, outline=green, width=3)
        draw.text((x, y), label, anchor="mm", font=font(22), fill=dark)

    links = [
        ((145, 155), (335, 165)), ((145, 155), (335, 315)), ((145, 520), (335, 465)),
        ((145, 520), (795, 315)), ((1355, 155), (705, 465)), ((1355, 520), (1165, 465)),
        ((1355, 520), (1165, 315)), ((1355, 520), (1165, 165)),
    ]
    for start, end in links:
        draw.line((*start, *end), fill=(120, 135, 130), width=3)

    image.save(ROOT / "use_case_diagram.png", quality=95)


if __name__ == "__main__":
    render_logo()
    use_case_diagram()
