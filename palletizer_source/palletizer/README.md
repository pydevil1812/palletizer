# Palletizer — Box-on-Pallet Stacking Program

Computes how to stack a homogeneous batch of boxes onto a pallet, given
box/pallet dimensions, weight limits, a maximum stack height, and which
90-degree box rotations are acceptable. Produces visual diagrams (2D top
view, 2D side/front elevation, 3D view), a full coordinate table, summary
metrics, simple improvement recommendations, and exportable reports
(Excel, PDF, printable HTML).

## Install

```bash
pip install pandas openpyxl reportlab matplotlib
```

## Quick start (CLI)

```bash
python -m palletizer.cli --config example_input.json --outdir output
```

This writes to `output/`:
- `top_view.png`, `side_view.png`, `view_3d.png` — diagrams
- `report.xlsx` — Summary / Recommendations / Layers / Box Coordinates sheets
- `report.pdf` — printable report with summary, diagrams, and full tables
- `report.html` — single self-contained printable HTML file (images inlined)

And prints a text summary + recommendations to the console.

## Input schema (`example_input.json`)

```jsonc
{
  "box": {
    "name": "Carton A",
    "length": 400,      // mm, box's own X dimension at rest
    "width": 300,        // mm, box's own Y dimension at rest
    "height": 250,        // mm, box's own Z dimension at rest
    "weight": 8.5         // kg, gross weight of one box
  },
  "pallet": {
    "name": "EUR pallet (1200x800)",
    "length": 1200,       // mm, pallet footprint X
    "width": 800,         // mm, pallet footprint Y
    "deck_height": 150,   // mm, pallet's own height
    "load_capacity": 700  // kg, max weight of boxes the pallet may carry
  },
  "max_stack_height": 1800,   // mm, total allowed height INCLUDING the pallet deck
  "orientation_flags": {
    "allow_rotate_x": false,  // tip box onto its side face (swaps width<->height)
    "allow_rotate_y": false,  // tip box onto its end face (swaps length<->height)
    "allow_rotate_z": true    // rotate footprint 90 deg (swaps length<->width)
  },
  "additional_elements": {    // OPTIONAL — omit entirely, or set enabled:false, to ignore
    "enabled": true,
    "use_spacers": true,
    "spacer_thickness_mm": 5,
    "spacer_weight_kg": 0.3,
    "use_corner_posts": false,
    "corner_post_weight_kg": 0,
    "use_film": true,
    "film_weight_kg": 1.2
  }
}
```

## Using it as a library

```python
from palletizer import (Box, Pallet, OrientationFlags, StackingConfig,
                         stack_layers, generate_all_visuals,
                         export_excel, export_pdf, export_html)

box = Box(name="Carton A", length=400, width=300, height=250, weight=8.5)
pallet = Pallet(name="EUR pallet", length=1200, width=800, deck_height=150, load_capacity=700)
flags = OrientationFlags(allow_rotate_z=True)
config = StackingConfig(box=box, pallet=pallet, max_stack_height=1800, orientation_flags=flags)

result = stack_layers(config)          # StackingResult: layers, placed_boxes, totals, recommendations
images = generate_all_visuals(result, "out")
export_excel(result, "out/report.xlsx")
export_pdf(result, images, "out/report.pdf")
export_html(result, images, "out/report.html")
```

`result.total_boxes`, `result.total_weight`, `result.total_height`,
`result.footprint_fill_pct`, `result.volume_fill_pct`,
`result.height_utilization_pct`, `result.weight_utilization_pct`, and
`result.recommendations` cover the requested output metrics directly.
`result.placed_boxes` is a list of `PlacedBox(box_id, layer, x, y, z,
dim_x, dim_y, dim_z, orientation)` — the tabular coordinate output.

## How the packing works

1. **Orientation generation** (`models.generate_orientations`): starting
   from the box's natural (L, W, H), applies whichever 90-degree axis
   rotations are flagged as allowed, producing the set of physically
   permitted (dx, dy, dz) placements.
2. **Per-layer 2D packing** (`packer.pack_rectangle`): for a given
   footprint, lays out a uniform grid and then tries to fill the leftover
   strip with the 90-degree-rotated footprint (classic "two block
   patterns" heuristic for the 2D pallet-loading problem). This is fast
   and close to optimal for typical box/pallet ratios, though true
   pallet loading is NP-hard and this is **not** a guaranteed global
   optimum.
3. **Layer stacking** (`packer.stack_layers`): greedily, for each
   remaining height/weight budget, evaluates every allowed orientation,
   keeps the one that fits the most boxes, and stacks until height or
   weight runs out. Different layers may use different orientations if
   that lets the program use up the last bit of height budget.
4. **Recommendations** (`packer._build_recommendations`): simple,
   explainable heuristics — e.g. "shrinking this dimension by N mm would
   fit one more column" — never silently change the result, only suggest.

## Extension points already left in the code

- `models.Box` carries `name`/`sku` so it is ready to become part of a
  `List[Box]` for **mixed-SKU pallets**; the single-box packer would be
  swapped for a multi-item layer builder (see the NOTE in `models.py`).
- `models.AdditionalElements` is a deliberately thin, optional dataclass
  for spacers / corner posts / film. It already feeds into total height
  and weight; see the TODOs in `models.py` for richer behaviors (per-layer
  spacers, full-height corner posts constraining usable height, multi-wrap
  film, top caps).
- `visualization.plot_3d` notes how to swap the static matplotlib 3D
  render for an interactive plotly view without re-deriving box geometry.

## Files

```
palletizer/
  models.py          # Box, Pallet, OrientationFlags, AdditionalElements, results
  packer.py          # 2D layer packing + 3D stacking + recommendations
  visualization.py   # top view / side view / 3D PNG generation
  report.py          # DataFrame builders + Excel/PDF/HTML exporters
  cli.py             # JSON-config-driven command line entry point
  example_input.json # sample config
  __init__.py        # public API
```
