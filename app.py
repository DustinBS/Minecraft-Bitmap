from flask import Flask, render_template, request
from io import BytesIO
from PIL import Image
import base64
import random

app = Flask(__name__)

# Minecraft dye palette (exact color hex values from Minecraft Wiki)
PALETTE = {
    "white": (249, 255, 254),     # #F9FFFE
    "light_gray": (157, 157, 151),# #9D9D97
    "gray": (71, 79, 82),         # #474F52
    "black": (29, 29, 33),        # #1D1D21
    "brown": (131, 84, 50),       # #835432
    "red": (176, 46, 38),         # #B02E26
    "orange": (249, 128, 29),     # #F9801D
    "yellow": (254, 216, 61),     # #FED83D
    "lime": (128, 199, 31),       # #80C71F
    "green": (94, 124, 22),       # #5E7C16
    "cyan": (22, 156, 156),       # #169C9C
    "light_blue": (58, 179, 218), # #3AB3DA
    "blue": (60, 68, 170),        # #3C44AA
    "purple": (137, 50, 184),     # #8932B8
    "magenta": (199, 78, 189),    # #C74EBD
    "pink": (243, 139, 170),      # #F38BAA
}


def generate_image(width_blocks, height_blocks, choices, block_px=16):
    w = max(1, int(width_blocks))
    h = max(1, int(height_blocks))
    px = max(1, int(block_px))
    img = Image.new("RGB", (w * px, h * px))
    pixels = img.load()

    # Build cumulative distribution
    labels, weights = zip(*choices)
    total = sum(weights)
    if total == 0:
        weights = [1 for _ in weights]
        total = sum(weights)
    probs = [w / total for w in weights]
    cum = []
    s = 0.0
    for p in probs:
        s += p
        cum.append(s)

    def pick_index():
        r = random.random()
        for i, c in enumerate(cum):
            if r <= c:
                return i
        return len(cum) - 1

    grid_names = [[None] * w for _ in range(h)]
    for by in range(h):
        for bx in range(w):
            idx = pick_index()
            name = labels[idx]
            color = PALETTE.get(name, (255, 0, 255))
            grid_names[by][bx] = name
            for y in range(by * px, (by + 1) * px):
                for x in range(bx * px, (bx + 1) * px):
                    pixels[x, y] = color

    buffer = BytesIO()
    img.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode("ascii")
    return b64, grid_names


@app.route("/", methods=["GET", "POST"])
def index():
    # Default: 3 colors with some weights
    default_slots = 9
    palette_names = list(PALETTE.keys())

    # Initialize form values
    width = request.form.get("width", "32")
    height = request.form.get("height", "16")
    block_px = request.form.get("block_px", "12")

    choices = []
    for i in range(1, default_slots + 1):
        cname = request.form.get(f"color_{i}", "pink")
        try:
            w = float(request.form.get(f"weight_{i}", "0"))
        except ValueError:
            w = 0.0
        if cname and w > 0:
            choices.append((cname, w))

    if not choices:
        # Provide a simple default distribution
        choices = [("pink", 20), ("magenta", 40), ("purple", 40)]

    # Calculate unique choices for the legend display
    unique_choices_map = {}
    for c, w in choices:
        unique_choices_map[c] = unique_choices_map.get(c, 0) + w
    # Sort by weight descending
    unique_choices = sorted(unique_choices_map.items(), key=lambda x: x[1], reverse=True)

    img_b64, grid = generate_image(width, height, choices, block_px=int(block_px))

    return render_template(
        "index.html",
        palette=palette_names,
        palette_map=PALETTE,
        slots=default_slots,
        img_b64=img_b64,
        width=width,
        height=height,
        block_px=block_px,
        choices=unique_choices, # Use unique aggregated choices for display
        grid=grid,
    )


if __name__ == "__main__":
    app.run(debug=True)
