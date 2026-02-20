import unittest
import base64
import json
from io import BytesIO
from PIL import Image

from app import app, generate_image, PALETTE


class TestGenerateImage(unittest.TestCase):
    """Tests for the generate_image helper function."""

    def test_returns_base64_and_grid(self):
        """Basic call: b64 is a non-empty string and grid has correct dimensions."""
        choices = [("red", 1), ("blue", 1)]
        b64, grid = generate_image(4, 3, choices)
        self.assertIsInstance(b64, str)
        self.assertTrue(len(b64) > 0)
        self.assertEqual(len(grid), 3)
        self.assertTrue(all(len(row) == 4 for row in grid))

    def test_single_color(self):
        """Single color choice: every grid cell should be that color."""
        choices = [("green", 1)]
        _, grid = generate_image(5, 5, choices)
        for row in grid:
            for cell in row:
                self.assertEqual(cell, "green")

    def test_grid_dimensions(self):
        """Grid rows == height and grid cols == width."""
        for w, h in [(1, 1), (10, 5), (3, 7), (20, 20)]:
            _, grid = generate_image(w, h, [("white", 1)])
            self.assertEqual(len(grid), h, f"Expected {h} rows, got {len(grid)}")
            for row in grid:
                self.assertEqual(len(row), w, f"Expected {w} cols, got {len(row)}")

    def test_image_dimensions(self):
        """Decoded image pixel dimensions should be width*block_px x height*block_px."""
        w, h, px = 6, 4, 16
        b64, _ = generate_image(w, h, [("pink", 1)], block_px=px)
        img_bytes = base64.b64decode(b64)
        img = Image.open(BytesIO(img_bytes))
        self.assertEqual(img.size, (w * px, h * px))

    def test_zero_weights_fallback(self):
        """All weights 0 should still succeed (falls back to uniform)."""
        choices = [("red", 0), ("blue", 0), ("yellow", 0)]
        b64, grid = generate_image(3, 3, choices)
        self.assertIsInstance(b64, str)
        self.assertTrue(len(b64) > 0)
        self.assertEqual(len(grid), 3)

    def test_min_values(self):
        """width=1, height=1, block_px=1 should produce a 1x1 image."""
        b64, grid = generate_image(1, 1, [("black", 1)], block_px=1)
        self.assertEqual(len(grid), 1)
        self.assertEqual(len(grid[0]), 1)
        img_bytes = base64.b64decode(b64)
        img = Image.open(BytesIO(img_bytes))
        self.assertEqual(img.size, (1, 1))

    def test_large_block_px(self):
        """block_px=32 with a small grid should produce correctly sized output."""
        w, h, px = 2, 3, 32
        b64, grid = generate_image(w, h, [("orange", 1)], block_px=px)
        img_bytes = base64.b64decode(b64)
        img = Image.open(BytesIO(img_bytes))
        self.assertEqual(img.size, (w * px, h * px))
        self.assertEqual(len(grid), h)
        self.assertTrue(all(len(row) == w for row in grid))


class TestIndexRoute(unittest.TestCase):
    """Tests for the GET/POST '/' route."""

    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_get_returns_200(self):
        """GET '/' should return 200."""
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)

    def test_get_contains_html(self):
        """Response should contain expected HTML elements."""
        resp = self.client.get("/")
        html = resp.data.decode("utf-8")
        self.assertIn("<html", html.lower())
        self.assertIn("</html>", html.lower())

    def test_post_with_colors(self):
        """POST '/' with form data should return 200 and contain palette info."""
        form_data = {
            "width": "8",
            "height": "8",
            "block_px": "16",
            "color_1": "red",
            "weight_1": "50",
            "color_2": "blue",
            "weight_2": "50",
        }
        resp = self.client.post("/", data=form_data)
        self.assertEqual(resp.status_code, 200)
        html = resp.data.decode("utf-8")
        # The rendered page should contain palette color names
        self.assertIn("red", html)
        self.assertIn("blue", html)


class TestGenerateEndpoint(unittest.TestCase):
    """Tests for the POST '/generate' JSON endpoint."""

    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_valid_request(self):
        """POST '/generate' with valid JSON returns 200 with img_b64 and legend."""
        payload = {
            "width": 4,
            "height": 4,
            "block_px": 16,
            "choices": [["red", 50], ["blue", 50]],
        }
        resp = self.client.post(
            "/generate",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertIn("img_b64", body)
        self.assertIn("legend", body)
        self.assertIsInstance(body["img_b64"], str)
        self.assertTrue(len(body["img_b64"]) > 0)

    def test_empty_choices(self):
        """POST with empty choices should return 400."""
        payload = {"width": 4, "height": 4, "choices": []}
        resp = self.client.post(
            "/generate",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        body = resp.get_json()
        self.assertIn("error", body)

    def test_invalid_color(self):
        """POST with a non-existent color name should return 400."""
        payload = {
            "width": 4,
            "height": 4,
            "choices": [["nonexistent_color", 10]],
        }
        resp = self.client.post(
            "/generate",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        body = resp.get_json()
        self.assertIn("error", body)

    def test_legend_aggregation(self):
        """Duplicate colors should be aggregated in the legend."""
        payload = {
            "width": 4,
            "height": 4,
            "choices": [["red", 30], ["red", 20], ["blue", 50]],
        }
        resp = self.client.post(
            "/generate",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        legend = body["legend"]
        legend_names = [entry["name"] for entry in legend]
        # "red" should appear only once even though it was provided twice
        self.assertEqual(legend_names.count("red"), 1)
        # Aggregated weight for red should be 30 + 20 = 50
        red_entry = next(e for e in legend if e["name"] == "red")
        self.assertAlmostEqual(red_entry["weight"], 50.0)

    def test_single_color_legend(self):
        """Legend should have exactly one entry for a single color."""
        payload = {
            "width": 4,
            "height": 4,
            "choices": [["purple", 100]],
        }
        resp = self.client.post(
            "/generate",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertEqual(len(body["legend"]), 1)
        self.assertEqual(body["legend"][0]["name"], "purple")

    def test_response_image_decodable(self):
        """img_b64 from the response should decode to a valid PNG."""
        payload = {
            "width": 8,
            "height": 8,
            "block_px": 16,
            "choices": [["cyan", 1], ["lime", 1]],
        }
        resp = self.client.post(
            "/generate",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        img_bytes = base64.b64decode(body["img_b64"])
        img = Image.open(BytesIO(img_bytes))
        self.assertEqual(img.format, "PNG")
        self.assertEqual(img.size, (8 * 16, 8 * 16))


if __name__ == "__main__":
    unittest.main()
