"""
Data models for the pallet-stacking program.

All linear dimensions are in millimetres (mm), all weights in kilograms (kg),
unless stated otherwise.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from itertools import product
from typing import Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Inputs
# ---------------------------------------------------------------------------

@dataclass
class Box:
    """A single box (carton) type to be stacked.

    NOTE (extension point): the current engine packs ONE homogeneous box
    type per pallet, which covers the common case-palletizing scenario.
    To support MIXED SKUs on one pallet in the future, extend `packer.py`
    to accept a list[Box] with quantities and run a multi-item layer
    builder (e.g. greedy largest-area-first or a shelf algorithm per
    layer) instead of `generate_orientations` / `pack_rectangle` being
    called for a single box. The data model below already carries a
    `name`/`sku` field so it is ready to be used in a list.
    """
    length: float          # mm, the box's own X dimension at rest
    width: float           # mm, the box's own Y dimension at rest
    height: float          # mm, the box's own Z dimension at rest
    weight: float          # kg, gross weight of one box
    name: str = "Box"
    sku: Optional[str] = None   # just in case you need to add something later

    @property
    def volume(self) -> float:
        return self.length * self.width * self.height


@dataclass
class Pallet:
    length: float           # mm (footprint X)
    width: float            # mm (footprint Y)
    deck_height: float      # mm, height of the pallet deck itself
    load_capacity: float    # kg, maximum weight the pallet may carry (boxes only)
    name: str = "Pallet"

    @property
    def footprint_area(self) -> float:
        return self.length * self.width


@dataclass
class OrientationFlags:
    """Which 90-degree rotations of the box are physically/commercially
    acceptable (e.g. due to fragility, printing/branding orientation,
    stacking strength of the box, etc.).

    A rotation about a given axis swaps the two dimensions perpendicular
    to that axis:
      - allow_rotate_z: swap length <-> width (box stays "upright",
        footprint rotates 90 deg in the horizontal plane). Almost always
        permitted.
      - allow_rotate_x: swap width <-> height (box is tipped onto its
        side face).
      - allow_rotate_y: swap length <-> height (box is tipped onto its
        end face).
    """
    allow_rotate_x: bool = False
    allow_rotate_y: bool = False
    allow_rotate_z: bool = True


@dataclass
class AdditionalElements:
    """Optional packaging accessories.

    This is intentionally a thin, OPTIONAL placeholder so the feature can
    be expanded later without reshaping the rest of the program. Today it
    only contributes simple, conservative additions to total height and
    weight. Possible future extensions (left as TODOs so the integration
    points are obvious):

      TODO: spacers with non-uniform thickness per layer (e.g. only every
            other layer, or only under fragile SKUs).
      TODO: corner posts that span the FULL stack height and therefore
            constrain max usable height independently of layer count,
            and that may reduce usable footprint near the corners.
      TODO: stretch film modeled as a wrap count with weight-per-wrap and
            a small film-take-up height per layer.
      TODO: top cap / lid sheet with its own height + weight.
    """
    enabled: bool = False
    use_spacers: bool = False
    spacer_thickness_mm: float = 0.0   # added between layers
    spacer_weight_kg: float = 0.0      # added weight per spacer used
    use_corner_posts: bool = False
    corner_post_weight_kg: float = 0.0  # total for 4 posts, added once
    use_film: bool = False
    film_weight_kg: float = 0.0         # added once for the whole load


@dataclass
class StackingConfig:
    box: Box
    pallet: Pallet
    max_stack_height: float                  # mm, total height incl. pallet deck
    orientation_flags: OrientationFlags = field(default_factory=OrientationFlags)
    additional: Optional[AdditionalElements] = None
    packing_mode: str = "auto"  # "auto" | "standard" | "spiral" — see packer.py


# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

@dataclass
class PlacedBox:
    box_id: int
    layer: int
    x: float
    y: float
    z: float
    dim_x: float
    dim_y: float
    dim_z: float
    orientation: str


@dataclass
class LayerResult:
    index: int
    z_start: float
    dim_x: float
    dim_y: float
    dim_z: float
    orientation: str
    rects: List[Tuple[float, float, float, float]]   # (x, y, w, h)
    weight: float

    @property
    def count(self) -> int:
        return len(self.rects)


@dataclass
class StackingResult:
    config: StackingConfig
    layers: List[LayerResult]
    placed_boxes: List[PlacedBox]
    total_boxes: int
    total_weight: float
    total_height: float
    footprint_fill_pct: float
    volume_fill_pct: float
    height_utilization_pct: float
    weight_utilization_pct: float
    recommendations: List[Dict]
    additional_weight: float = 0.0
    additional_height: float = 0.0
    limiting: str = "pattern"  # "height" | "weight" | "pattern" — why stacking stopped


# ---------------------------------------------------------------------------
# Orientation generation
# ---------------------------------------------------------------------------

def generate_orientations(box: Box, flags: OrientationFlags) -> List[Dict]:
    """Return the list of physically allowed orientations of `box`.

    Each orientation is a dict {dx, dy, dz, label} where dx/dy is the
    footprint placed along the pallet's X/Y axes and dz is the resulting
    stacking height. `label` encodes which original box dimension ended
    up on which axis, e.g. "L-x,W-y,H-z".
    """
    start = ("L", "W", "H")

    def swap_x(a):  # swap Y and Z labels
        return (a[0], a[2], a[1])

    def swap_y(a):  # swap X and Z labels
        return (a[2], a[1], a[0])

    def swap_z(a):  # swap X and Y labels
        return (a[1], a[0], a[2])

    generators = []
    if flags.allow_rotate_x:
        generators.append(swap_x)
    if flags.allow_rotate_y:
        generators.append(swap_y)
    if flags.allow_rotate_z:
        generators.append(swap_z)

    seen = {start}
    frontier = [start]
    while frontier:
        nxt = []
        for state in frontier:
            for g in generators:
                cand = g(state)
                if cand not in seen:
                    seen.add(cand)
                    nxt.append(cand)
        frontier = nxt

    dims = {"L": box.length, "W": box.width, "H": box.height}
    orientations = []
    for assign in seen:
        dx, dy, dz = (dims[a] for a in assign)
        label = f"{assign[0]}-x,{assign[1]}-y,{assign[2]}-z"
        orientations.append({"dx": dx, "dy": dy, "dz": dz, "label": label})
    return orientations
