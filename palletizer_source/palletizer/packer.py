"""
Packing engine.

Two stages:
  1. `pack_rectangle` arranges identical a x b rectangles inside an
     L x W footprint (one pallet layer) using an exact DP over all
     two-type strip decompositions. For identical rectangles any valid
     packing can be rearranged into strips without reducing the count,
     so the DP is optimal. It enumerates every split into n_b strips of
     height b (items a×b) plus n_a strips of height a (items b×a) in
     both the horizontal and vertical directions, and returns the
     arrangement with the highest count.

  2. `stack_layers` repeatedly calls stage 1 for every allowed box
     orientation, picks the orientation that yields the most boxes for
     the height/weight budget remaining, and stacks layers until the
     pallet runs out of height or weight capacity.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from .models import (
    AdditionalElements,
    Box,
    LayerResult,
    OrientationFlags,
    Pallet,
    PlacedBox,
    StackingConfig,
    StackingResult,
    generate_orientations,
)


Rect = Tuple[float, float, float, float]  # x, y, w, h


def _grid(L: float, W: float, a: float, b: float) -> Tuple[int, int]:
    if a <= 0 or b <= 0:
        return 0, 0
    return int(L // a), int(W // b)


def pack_rectangle(L: float, W: float, a: float, b: float, allow_swap: bool) -> List[Rect]:
    """Exact optimal layout for identical a×b footprints on an L×W pallet.

    Enumerates every two-type strip decomposition in both the horizontal
    and vertical directions and returns the arrangement with the most boxes.

    Horizontal: n_b strips of height b (items a wide, b tall) +
                n_a strips of height a (items b wide, a tall).
    Vertical:   n_a strips of width  a (items a wide, b tall) +
                n_b strips of width  b (items b wide, a tall).
    """
    if a <= 0 or b <= 0 or L <= 0 or W <= 0:
        return []

    best: List[Rect] = []

    def _update(rects: List[Rect]) -> None:
        nonlocal best
        if len(rects) > len(best):
            best = rects

    # items per strip for each strip type
    per_hb = int(L // a)                       # height-b strip → a×b items
    per_ha = int(L // b) if allow_swap else 0  # height-a strip → b×a items

    # ── horizontal strips (stacked along Y) ──────────────────────────────────
    for nb in range(int(W // b) + 1):
        na = int((W - nb * b) // a) if allow_swap else 0
        if nb * per_hb + na * per_ha > len(best):
            rects: List[Rect] = []
            y = 0.0
            for _ in range(nb):
                rects += [(i * a, y, a, b) for i in range(per_hb)]
                y += b
            for _ in range(na):
                rects += [(i * b, y, b, a) for i in range(per_ha)]
                y += a
            _update(rects)

    # ── vertical strips (stacked along X) ────────────────────────────────────
    if allow_swap:
        per_va = int(W // b)  # width-a strip → a×b items
        per_vb = int(W // a)  # width-b strip → b×a items

        for na in range(int(L // a) + 1):
            nb = int((L - na * a) // b)
            if na * per_va + nb * per_vb > len(best):
                rects = []
                x = 0.0
                for _ in range(na):
                    rects += [(x, j * b, a, b) for j in range(per_va)]
                    x += a
                for _ in range(nb):
                    rects += [(x, j * a, b, a) for j in range(per_vb)]
                    x += b
                _update(rects)

    return best


def _layer_height_budget(idx: int, additional: Optional[AdditionalElements]) -> float:
    """Spacer thickness consumed BEFORE placing layer `idx` (no spacer
    under the first layer, which sits directly on the deck)."""
    if additional and additional.enabled and additional.use_spacers and idx > 0:
        return additional.spacer_thickness_mm
    return 0.0


def _layer_weight_budget(idx: int, additional: Optional[AdditionalElements]) -> float:
    if additional and additional.enabled and additional.use_spacers and idx > 0:
        return additional.spacer_weight_kg
    return 0.0


def stack_layers(config: StackingConfig) -> StackingResult:
    box, pallet = config.box, config.pallet
    orientations = generate_orientations(box, config.orientation_flags)
    additional = config.additional

    z_cursor = pallet.deck_height
    weight_used = 0.0
    layers: List[LayerResult] = []
    layer_idx = 0
    max_iterations = 1000  # safety guard against pathological inputs
    limiting = "pattern"

    while layer_idx < max_iterations:
        spacer_h = _layer_height_budget(layer_idx, additional)
        spacer_w = _layer_weight_budget(layer_idx, additional)
        remaining_h = config.max_stack_height - z_cursor - spacer_h
        remaining_w = pallet.load_capacity - weight_used - spacer_w
        if remaining_h <= 0:
            limiting = "height"
            break
        if remaining_w <= 0:
            limiting = "weight"
            break

        best = None
        for orient in orientations:
            if orient["dz"] > remaining_h or orient["dz"] <= 0:
                continue
            rects = pack_rectangle(pallet.length, pallet.width,
                                    orient["dx"], orient["dy"],
                                    config.orientation_flags.allow_rotate_z)
            count = len(rects)
            if count == 0:
                continue
            layer_weight = count * box.weight
            if layer_weight > remaining_w:
                max_by_weight = int(remaining_w // box.weight) if box.weight > 0 else count
                if max_by_weight <= 0:
                    continue
                rects = rects[:max_by_weight]
                count = max_by_weight
                layer_weight = count * box.weight
            if best is None or count > best["count"]:
                best = {"orient": orient, "rects": rects, "count": count, "weight": layer_weight}

        if not best or best["count"] == 0:
            limiting = "pattern" if layer_idx == 0 else "height"
            break

        z_cursor += spacer_h
        weight_used += spacer_w
        layers.append(LayerResult(
            index=layer_idx,
            z_start=z_cursor,
            dim_x=best["orient"]["dx"],
            dim_y=best["orient"]["dy"],
            dim_z=best["orient"]["dz"],
            orientation=best["orient"]["label"],
            rects=best["rects"],
            weight=best["weight"],
        ))
        z_cursor += best["orient"]["dz"]
        weight_used += best["weight"]
        layer_idx += 1

    return _finalize(config, layers, z_cursor, weight_used, limiting)


def _finalize(config: StackingConfig, layers: List[LayerResult],
              z_cursor: float, weight_used: float, limiting: str = "pattern") -> StackingResult:
    box, pallet, additional = config.box, config.pallet, config.additional

    placed_boxes: List[PlacedBox] = []
    bid = 1
    for layer in layers:
        for (x, y, w, h) in layer.rects:
            placed_boxes.append(PlacedBox(
                box_id=bid, layer=layer.index, x=x, y=y, z=layer.z_start,
                dim_x=w, dim_y=h, dim_z=layer.dim_z, orientation=layer.orientation,
            ))
            bid += 1

    total_boxes = len(placed_boxes)
    boxes_weight = sum(l.weight for l in layers)

    additional_weight = 0.0
    additional_height = 0.0
    if additional and additional.enabled:
        if additional.use_film:
            additional_weight += additional.film_weight_kg
        if additional.use_corner_posts:
            additional_weight += additional.corner_post_weight_kg
        if additional.use_spacers:
            spacer_count = max(0, len(layers) - 1)
            additional_weight += spacer_count * additional.spacer_weight_kg
            additional_height += spacer_count * additional.spacer_thickness_mm
        # Spacer height/weight already folded into z_cursor/weight_used by
        # stack_layers; additional_* here is reported for transparency only.

    total_weight = weight_used
    total_height = z_cursor
    used_stack_height = max(total_height - pallet.deck_height, 1e-9)

    if layers:
        avg_footprint_fill = sum(
            (l.count * (l.dim_x * l.dim_y)) / pallet.footprint_area for l in layers
        ) / len(layers) * 100.0
    else:
        avg_footprint_fill = 0.0

    box_volume_total = total_boxes * box.volume
    stack_volume = pallet.footprint_area * used_stack_height
    volume_fill_pct = (box_volume_total / stack_volume * 100.0) if stack_volume > 0 else 0.0

    height_utilization_pct = (total_height / config.max_stack_height * 100.0
                               if config.max_stack_height > 0 else 0.0)
    weight_utilization_pct = (total_weight / pallet.load_capacity * 100.0
                               if pallet.load_capacity > 0 else 0.0)

    recommendations = _build_recommendations(config, layers, total_height, total_weight)

    return StackingResult(
        config=config,
        layers=layers,
        placed_boxes=placed_boxes,
        total_boxes=total_boxes,
        total_weight=total_weight,
        total_height=total_height,
        footprint_fill_pct=avg_footprint_fill,
        volume_fill_pct=volume_fill_pct,
        height_utilization_pct=height_utilization_pct,
        weight_utilization_pct=weight_utilization_pct,
        recommendations=recommendations,
        additional_weight=additional_weight,
        additional_height=additional_height,
        limiting=limiting,
    )


def _build_recommendations(config: StackingConfig, layers: List[LayerResult],
                            total_height: float, total_weight: float) -> List[str]:
    """Lightweight, explainable heuristics. These are suggestions only and
    do not modify the result; a human should sanity-check before changing
    box specs."""
    recs: List[str] = []
    box, pallet = config.box, config.pallet

    if not layers:
        recs.append(
            "No box orientation fits the pallet footprint and the allowed "
            "stack height/weight at the same time. Check box dimensions "
            "against the pallet footprint and deck height, or relax the "
            "orientation flags."
        )
        return recs

    bottom = layers[0]
    nx, ny = _grid(pallet.length, pallet.width, bottom.dim_x, bottom.dim_y)
    REC_THRESHOLD = 0.15  # only suggest "modest" size reductions, not drastic redesigns

    if nx > 0:
        rem_x = pallet.length - nx * bottom.dim_x
        target_dx = pallet.length / (nx + 1)
        reduction = bottom.dim_x - target_dx
        if 0 < reduction <= bottom.dim_x * REC_THRESHOLD:
            note = f", reclaiming the {rem_x:.0f} mm currently left over" if rem_x > 1 else ""
            recs.append(
                f"Reducing the box dimension currently placed along pallet "
                f"length (now {bottom.dim_x:.0f} mm) by about {reduction:.0f} mm "
                f"(to ~{target_dx:.0f} mm) would fit one more column per "
                f"layer ({nx + 1} instead of {nx}){note}."
            )
    if ny > 0:
        rem_y = pallet.width - ny * bottom.dim_y
        target_dy = pallet.width / (ny + 1)
        reduction = bottom.dim_y - target_dy
        if 0 < reduction <= bottom.dim_y * REC_THRESHOLD:
            note = f", reclaiming the {rem_y:.0f} mm currently left over" if rem_y > 1 else ""
            recs.append(
                f"Reducing the box dimension currently placed along pallet "
                f"width (now {bottom.dim_y:.0f} mm) by about {reduction:.0f} mm "
                f"(to ~{target_dy:.0f} mm) would fit one more row per layer "
                f"({ny + 1} instead of {ny}){note}."
            )

    n_layers = len(layers)
    avg_dz = sum(l.dim_z for l in layers) / n_layers
    available_for_layers = config.max_stack_height - pallet.deck_height
    target_dz = available_for_layers / (n_layers + 1)
    reduction_h = avg_dz - target_dz
    if 0 < reduction_h <= avg_dz * REC_THRESHOLD:
        recs.append(
            f"Reducing box height by about {reduction_h:.0f} mm "
            f"(to ~{target_dz:.0f} mm) would allow an extra layer "
            f"({n_layers + 1} instead of {n_layers}) within the {config.max_stack_height:.0f} mm "
            f"max stack height."
        )

    weight_headroom = pallet.load_capacity - total_weight
    height_headroom = config.max_stack_height - total_height
    if height_headroom < avg_dz and weight_headroom > box.weight * 5:
        recs.append(
            f"The stack is height-limited: {weight_headroom:.0f} kg of load "
            f"capacity ({weight_headroom / pallet.load_capacity * 100:.0f}% of "
            f"capacity) is unused. If a taller stack were allowed, this "
            f"pallet could carry meaningfully more boxes."
        )
    elif weight_headroom < box.weight and height_headroom > avg_dz:
        recs.append(
            f"The stack is weight-limited: {height_headroom:.0f} mm of "
            f"allowed stack height is unused because the pallet's load "
            f"capacity ({pallet.load_capacity:.0f} kg) is nearly reached. "
            f"Lighter boxes or a higher-capacity pallet would let you use "
            f"the remaining height."
        )

    avg_fill = (sum(l.count * (l.dim_x * l.dim_y) for l in layers) /
                (len(layers) * pallet.footprint_area)) if layers else 0.0
    if avg_fill < 0.75:
        flags = config.orientation_flags
        disabled = [name for name, on in (
            ("allow_rotate_x", flags.allow_rotate_x),
            ("allow_rotate_y", flags.allow_rotate_y),
            ("allow_rotate_z", flags.allow_rotate_z),
        ) if not on]
        if disabled:
            recs.append(
                f"Average footprint fill per layer is {avg_fill * 100:.0f}%, below "
                f"the 75% rule-of-thumb. The following orientation flag(s) are "
                f"currently disabled and could be reviewed if the box can safely "
                f"be reoriented: {', '.join(disabled)}."
            )
        else:
            recs.append(
                f"Average footprint fill per layer is {avg_fill * 100:.0f}% even "
                f"with all rotations already allowed. The box footprint likely "
                f"doesn't divide evenly into the pallet footprint — revisit the "
                f"box length/width, or consider a mixed-pattern/interlocking "
                f"layout (not currently modeled by this version)."
            )

    return recs
