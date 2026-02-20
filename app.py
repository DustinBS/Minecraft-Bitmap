from flask import Flask, render_template, request, jsonify
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
    
    # 1. Generate the small application-grid image (1 user-block = 1 image-pixel)
    # Using 'P' (palette) mode or just RGB. Since we are scaling up later,
    # create an RGB image of size (w, h) and resize it.
    
    small_img = Image.new("RGB", (w, h))
    pixels = small_img.load()

    # Build cumulative distribution
    labels, weights = zip(*choices)
    total = sum(weights)
    if total == 0:
        weights = [1 for _ in weights]
        total = sum(weights)
    
    # Using random.choices is much faster than manual cumulative sum loop in python
    # random.choices(population, weights=None, *, cum_weights=None, k=1)
    # available in Python 3.6+
    
    # We need w*h total choices
    total_pixels = w * h
    
    # Generate all pixel choices at once
    chosen_labels = random.choices(labels, weights=weights, k=total_pixels)
    
    grid_names = [[None] * w for _ in range(h)]
    
    # Fill the small image
    idx = 0
    for y in range(h):
        for x in range(w):
            name = chosen_labels[idx]
            grid_names[y][x] = name
            pixels[x, y] = PALETTE.get(name, (255, 0, 255))
            idx += 1

    # 2. Scale up efficiently using Nearest Neighbor
    # This replaces the nested loops that drew px*px rectangles for every block
    final_w, final_h = w * px, h * px
    img = small_img.resize((final_w, final_h), resample=Image.Resampling.NEAREST)

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

    # Capture subset selection from form (comma-separated values)
    subset_raw = request.form.get("subset", "")
    if subset_raw:
        subset_selected = [s for s in subset_raw.split(",") if s]
    else:
        subset_selected = []

    if not choices:
        # Provide a simple default distribution (2 pink, 4 magenta, 3 purple)
        choices = [
            ("pink", 1), ("pink", 1),
            ("magenta", 1), ("magenta", 1), ("magenta", 1), ("magenta", 1),
            ("purple", 1), ("purple", 1), ("purple", 1)
        ]

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
        slot_choices=choices,       # per-slot choices (preserve order for form fields)
        legend_choices=unique_choices, # aggregated unique choices for legend display
        subset_selected=subset_selected,
        grid=grid,
    )


@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(force=True)

    raw_choices = data.get("choices", [])
    width = data.get("width", 32)
    height = data.get("height", 16)
    block_px = data.get("block_px", 12)

    choices = []
    for item in raw_choices:
        if isinstance(item, (list, tuple)) and len(item) == 2:
            name, weight = item
            if name in PALETTE and float(weight) > 0:
                choices.append((name, float(weight)))

    if not choices:
        return jsonify({"error": "No valid choices provided"}), 400

    unique_choices_map = {}
    for c, w in choices:
        unique_choices_map[c] = unique_choices_map.get(c, 0) + w
    unique_choices = sorted(unique_choices_map.items(), key=lambda x: x[1], reverse=True)

    img_b64, grid = generate_image(int(width), int(height), choices, block_px=int(block_px))

    legend = [
        {"name": name, "weight": w, "rgb": list(PALETTE[name])}
        for name, w in unique_choices
    ]

    return jsonify({"img_b64": img_b64, "legend": legend})


if __name__ == "__main__":
    app.run(debug=True)
