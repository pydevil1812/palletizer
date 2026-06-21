"""
Several alternative box arrangements for the SAME StackingConfig.

The base engine (`packer.stack_layers`) returns ONE layout (the densest it
can find). For the desktop app the user wants to compare and switch between
several arrangements, so this module produces a small, de-duplicated list of
named variants built from different packing strategies:

  * "Maximum boxes (auto)"  – the engine's densest mixed layout.
  * per allowed orientation – a uniform grid and a mixed pack of each box
    orientation that the orientation flags permit (e.g. footprint rotated,
    or the box tipped onto a side/end face when those flags are enabled).
  * "Interlocked"           – alternate layers rotated 90 deg (brick bond),
    which is usually a bit more stable / less prone to column collapse.

Each variant reuses the engine's `_finalize` so the metrics, fill factors and
recommendations are computed identically to the single-layout path.
"""
from __future__ import annotations

from typing import Callable, Dict, List, Optional

from .models import LayerResult, StackingConfig, StackingResult, generate_orientations
from .packer import (
    _finalize,
    _layer_height_budget,
    _layer_weight_budget,
    pack_rectangle,
    stack_layers,
)


def _build_layers(config: StackingConfig,
                  orient_for_layer: Callable[[int], Optional[Dict]],
                  allow_swap: bool) -> StackingResult:
    """Stack layers using a caller-supplied orientation per layer.

    `orient_for_layer(idx)` returns an orientation dict {dx,dy,dz,label} (or
    None to stop). `allow_swap` toggles the 90-degree leftover-strip mixing
    inside a layer. Returns a fully finalized StackingResult.
    """
    box, pallet, additional = config.box, config.pallet, config.additional
    z = pallet.deck_height
    weight = 0.0
    layers: List[LayerResult] = []
    idx = 0
    limiting = "pattern"
    while idx < 1000:
        spacer_h = _layer_height_budget(idx, additional)
        spacer_w = _layer_weight_budget(idx, additional)
        remaining_h = config.max_stack_height - z - spacer_h
        remaining_w = pallet.load_capacity - weight - spacer_w
        if remaining_h <= 0:
            limiting = "height"
            break
        if remaining_w <= 0:
            limiting = "weight"
            break

        orient = orient_for_layer(idx)
        if orient is None or orient["dz"] <= 0 or orient["dz"] > remaining_h:
            limiting = "pattern" if idx == 0 else "height"
            break

        rects = pack_rectangle(pallet.length, pallet.width,
                               orient["dx"], orient["dy"], allow_swap)
        count = len(rects)
        if count == 0:
            limiting = "pattern" if idx == 0 else "height"
            break

        layer_weight = count * box.weight
        if layer_weight > remaining_w:
            max_by_weight = int(remaining_w // box.weight) if box.weight > 0 else count
            if max_by_weight <= 0:
                limiting = "weight"
                break
            rects = rects[:max_by_weight]
            count = max_by_weight
            layer_weight = count * box.weight

        z += spacer_h
        weight += spacer_w
        layers.append(LayerResult(
            index=idx, z_start=z,
            dim_x=orient["dx"], dim_y=orient["dy"], dim_z=orient["dz"],
            orientation=orient["label"], rects=rects, weight=layer_weight,
        ))
        z += orient["dz"]
        weight += layer_weight
        idx += 1

    return _finalize(config, layers, z, weight, limiting)


def _signature(result: StackingResult):
    """Identity used to drop duplicate arrangements (same boxes + same
    per-layer footprint/count sequence)."""
    return (result.total_boxes, len(result.layers),
            tuple((round(l.dim_x), round(l.dim_y), l.count) for l in result.layers))


def generate_variants(config: StackingConfig) -> List[Dict]:
    """Return a de-duplicated list of {name, description, result} variants,
    best (most boxes) first."""
    pallet = config.pallet
    variants: List[Dict] = []
    seen = set()

    def add(name: str, desc: str, result: Optional[StackingResult]):
        if result is None or result.total_boxes == 0:
            return
        sig = _signature(result)
        if sig in seen:
            return
        seen.add(sig)
        variants.append({"name": name, "description": desc, "result": result})

    # 1. the engine's densest layout
    add("Maximum boxes (auto)",
        "Engine picks the best orientation per layer and mixes 90-degree "
        "in-plane rotations to squeeze in leftover rows/columns.",
        stack_layers(config))

    # 2. one uniform grid + one mixed pack per allowed orientation
    swap = config.orientation_flags.allow_rotate_z
    for o in generate_orientations(config.box, config.orientation_flags):
        fp = f"{o['dx']:.0f}x{o['dy']:.0f}"
        add(f"Footprint {fp}, h {o['dz']:.0f} mm (mixed)",
            f"Box oriented {o['label']}; layers packed with 90-degree in-plane "
            f"mixing allowed.",
            _build_layers(config, lambda i, o=o: o, allow_swap=swap))
        add(f"Footprint {fp}, h {o['dz']:.0f} mm (uniform grid)",
            f"Box oriented {o['label']}; one clean uniform grid, no in-plane "
            f"mixing.",
            _build_layers(config, lambda i, o=o: o, allow_swap=False))

    # 3. interlocked (alternating 90-degree) from the densest orientation
    best = stack_layers(config)
    if best.layers:
        l0 = best.layers[0]
        base = {"dx": l0.dim_x, "dy": l0.dim_y, "dz": l0.dim_z, "label": l0.orientation}
        rot = {"dx": l0.dim_y, "dy": l0.dim_x, "dz": l0.dim_z,
               "label": l0.orientation + " +90"}
        fits = lambda o: o["dx"] <= pallet.length and o["dy"] <= pallet.width
        if abs(base["dx"] - base["dy"]) > 1e-6 and fits(base) and fits(rot):
            add("Interlocked (alternating 90 deg)",
                "Alternate layers rotated 90 degrees (brick bond) for a more "
                "stable, less column-aligned stack.",
                _build_layers(config, lambda i: base if i % 2 == 0 else rot,
                              allow_swap=False))

    # Always return at least the (possibly empty) auto layout so the UI has
    # something to show and the recommendations explain why nothing fits.
    if not variants:
        r = stack_layers(config)
        variants.append({"name": "No feasible arrangement",
                         "description": "No orientation fits the pallet within the "
                                        "height/weight limits.",
                         "result": r})
    return variants
