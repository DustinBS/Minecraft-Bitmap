# Minecraft Carpet Pattern Visualizer

A modern web application to generate randomized Minecraft carpet patterns with precise color distribution control. Experiment with different block palettes, weights, and constraints to visualize large-scale designs instantly.

## Features

- **Weighted Randomization**: Assign specific weights to colors to control their frequency.
- **Smart Constraints**: Use "Subset Randomization" to cycle through a specific group of colors.
- **Modern Interface**: Dark-themed sidebar with a clean preview area.
- **Instant Generation**: Uses AJAX for flicker-free updates.
- **Hotkeys**:
  - `G`: Generate new pattern
  - `R`: Randomize all hotbar slots
  - `S`: Randomize using only selected subset colors
- **Export**: Generates a high-quality visualization of your pattern.

## Usage

### Prerequisites
- Python 3.x

### Quick Start (Windows)
Double-click `run.ps1` (or `run.bat`) to automatically set up the environment and start the app.

### Manual Setup

1. **Create Virtual Environment**:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the App**:
   ```bash
   python app.py
   ```

4. **Open in Browser**:
   Navigate to `http://127.0.0.1:5000`

## How it Works

1. **Pick Colors**: Click colors in the palette to add them to your "Hotbar Slots".
2. **Set Weights**:
   - Each slot has a weight (0-1000).
   - Higher weight = more frequent in the pattern.
   - Use "Auto-calculate weights" to evenly distribute based on slot count.
3. **Generate**: Click "Generate Preview" (or press `G`) to see the result.
4. **Interpret Results**:
   - The "Unique Colors Used" legend shows the total *weight* assigned to each color across all slots.
   - Example: `light_gray (16)` means 16 units of weight were assigned to Light Gray.

## Tech Stack

- **Backend**: Flask (Python), Pillow (PIL) for image generation.
- **Frontend**: HTML5, CSS3 (Variables, Flexbox/Grid), Vanilla JavaScript (ES6+).
- **Testing**: Python `unittest`.
