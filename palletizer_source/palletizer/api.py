"""
JSON marshaling for the web API.

Request JSON uses the same schema as the desktop app's
`ConfigSerializer.toExportJSON` / `example_input.json` (snake_case, e.g.
`deck_height`, `orientation_flags`). Response JSON uses camelCase field
names matching what the React renderers already consume (e.g. `dimX`,
`zStart`), with derived values like `boxCount`/`limitingLabel`/
`boxesPerLayer` precomputed here so the client does no arithmetic of its
own — it only reads and displays fields.
"""
from __future__ import annotations

import hashlib
import json
from typing import Dict, List

from .models import (
    AdditionalElements,
    Box,
    OrientationFlags,
    Pallet,
    StackingConfig,
    StackingResult,
)
from .packer import stack_layers
# variants feature disabled — import kept for easy revert:
# from .variants import generate_variants

_LIMITING_LABELS = {
    "height": "height-limited",
    "weight": "weight-limited",
    "pattern": "footprint-limited",
}


def _num(v, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def build_config(data: Dict) -> StackingConfig:
    b = data.get("box") or {}
    p = data.get("pallet") or {}
    o = data.get("orientation_flags") or {}
    a = data.get("additional_elements") or data.get("additional") or {}

    box = Box(
        length=_num(b.get("length")),
        width=_num(b.get("width")),
        height=_num(b.get("height")),
        weight=_num(b.get("weight")),
        name=b.get("name") or "Box",
    )
    pallet = Pallet(
        length=_num(p.get("length")),
        width=_num(p.get("width")),
        deck_height=_num(p.get("deck_height")),
        load_capacity=_num(p.get("load_capacity")),
        name=p.get("name") or "Pallet",
    )
    orientation_flags = OrientationFlags(
        allow_rotate_x=bool(o.get("allow_rotate_x", False)),
        allow_rotate_y=bool(o.get("allow_rotate_y", False)),
        allow_rotate_z=bool(o.get("allow_rotate_z", True)),
    )
    additional = AdditionalElements(
        enabled=bool(a.get("enabled", False)),
        use_spacers=bool(a.get("use_spacers", False)),
        spacer_thickness_mm=_num(a.get("spacer_thickness_mm")),
        spacer_weight_kg=_num(a.get("spacer_weight_kg")),
        use_corner_posts=bool(a.get("use_corner_posts", False)),
        corner_post_weight_kg=_num(a.get("corner_post_weight_kg")),
        use_film=bool(a.get("use_film", False)),
        film_weight_kg=_num(a.get("film_weight_kg")),
    )
    return StackingConfig(
        box=box,
        pallet=pallet,
        max_stack_height=_num(data.get("max_stack_height")),
        orientation_flags=orientation_flags,
        additional=additional,
    )


def validate_config(config: StackingConfig) -> List[Dict]:
    """Mirrors the frontend's former ConfigValidator.js rules exactly. Each
    error is a `{code, params}` pair rather than pre-rendered text so the
    client can localize it (see front/src/i18n/{ru,en}.js: `errors`)."""
    errors: List[Dict] = []

    def positive(v: float, code: str) -> None:
        if not (v > 0):
            errors.append({"code": code, "params": {}})

    positive(config.box.length, "boxLengthPositive")
    positive(config.box.width, "boxWidthPositive")
    positive(config.box.height, "boxHeightPositive")
    if not (config.box.weight >= 0):
        errors.append({"code": "boxWeightNonNeg", "params": {}})

    positive(config.pallet.length, "palletLengthPositive")
    positive(config.pallet.width, "palletWidthPositive")
    if not (config.pallet.deck_height >= 0):
        errors.append({"code": "deckHeightNonNeg", "params": {}})
    positive(config.pallet.load_capacity, "loadCapacityPositive")

    positive(config.max_stack_height, "maxStackHeightPositive")
    if config.max_stack_height <= config.pallet.deck_height:
        errors.append({"code": "maxStackHeightExceedsDeck", "params": {}})

    return errors


def _serialize_config(config: StackingConfig) -> Dict:
    return {
        "box": {
            "name": config.box.name,
            "length": config.box.length,
            "width": config.box.width,
            "height": config.box.height,
            "weight": config.box.weight,
        },
        "pallet": {
            "name": config.pallet.name,
            "length": config.pallet.length,
            "width": config.pallet.width,
            "deckHeight": config.pallet.deck_height,
            "loadCapacity": config.pallet.load_capacity,
        },
        "maxStackHeight": config.max_stack_height,
        "orientationFlags": {
            "allowRotateX": config.orientation_flags.allow_rotate_x,
            "allowRotateY": config.orientation_flags.allow_rotate_y,
            "allowRotateZ": config.orientation_flags.allow_rotate_z,
        },
        "additional": {
            "enabled": config.additional.enabled,
            "useSpacers": config.additional.use_spacers,
            "spacerThicknessMm": config.additional.spacer_thickness_mm,
            "spacerWeightKg": config.additional.spacer_weight_kg,
            "useCornerPosts": config.additional.use_corner_posts,
            "cornerPostWeightKg": config.additional.corner_post_weight_kg,
            "useFilm": config.additional.use_film,
            "filmWeightKg": config.additional.film_weight_kg,
        } if config.additional else None,
    }


def _serialize_result(result: StackingResult) -> Dict:
    layers = [
        {
            "index": l.index,
            "zStart": l.z_start,
            "dimX": l.dim_x,
            "dimY": l.dim_y,
            "dimZ": l.dim_z,
            "orientation": l.orientation,
            "rects": [{"x": x, "y": y, "w": w, "h": h} for (x, y, w, h) in l.rects],
            "weight": l.weight,
            "boxCount": l.count,
        }
        for l in result.layers
    ]
    placed = [
        {
            "boxId": pb.box_id,
            "layer": pb.layer,
            "x": pb.x,
            "y": pb.y,
            "z": pb.z,
            "dimX": pb.dim_x,
            "dimY": pb.dim_y,
            "dimZ": pb.dim_z,
            "orientation": pb.orientation,
        }
        for pb in result.placed_boxes
    ]

    # Spacer mass is already folded into total_weight by the packer; only
    # film and corner posts are added here to avoid double-counting (the
    # film/corner-post-only definition mirrors the report's "accessories"
    # line, distinct from models.StackingResult.additional_weight, which
    # also folds in spacers for the desktop report's own transparency line).
    accessories_weight = 0.0
    additional = result.config.additional
    if additional and additional.enabled:
        if additional.use_film:
            accessories_weight += additional.film_weight_kg
        if additional.use_corner_posts:
            accessories_weight += additional.corner_post_weight_kg

    return {
        "config": _serialize_config(result.config),
        "layers": layers,
        "placed": placed,
        "totalBoxes": result.total_boxes,
        "totalWeight": result.total_weight,
        "totalHeight": result.total_height,
        "footprintFill": result.footprint_fill_pct,
        "volumeFill": result.volume_fill_pct,
        "heightUtil": result.height_utilization_pct,
        "weightUtil": result.weight_utilization_pct,
        "recommendations": result.recommendations,
        "accessoriesWeight": accessories_weight,
        "grossWeight": result.total_weight + accessories_weight,
        "limiting": result.limiting,
        "limitingLabel": _LIMITING_LABELS.get(result.limiting, "—"),
        "boxesPerLayer": [l.count for l in result.layers],
    }


def cache_key(data: Dict) -> str:
    """Return a stable hash identifying a compute request. Built from the
    *normalized* config (via `build_config`/`_serialize_config`) so that
    requests differing only in number formatting ("100" vs 100) or JSON key
    order map to the same key, while any parameter that actually changes the
    layout yields a different key.

    Box/pallet *names* are deliberately excluded: they don't affect the
    layout, so requests with the same dimensions but different names share a
    cached computation. On a cache hit the caller should apply the current
    request's names via `apply_names`."""
    config = _serialize_config(build_config(data))
    config["box"].pop("name", None)
    config["pallet"].pop("name", None)
    canonical = json.dumps(config, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def apply_names(result: Dict, data: Dict) -> Dict:
    """Overwrite box/pallet names in a (possibly cached) result with the names
    from the current request. Needed because names are excluded from the cache
    key, so a cached result may carry the name from an earlier request."""
    config = build_config(data)
    for variant in result.get("variants", []):
        cfg = variant.get("result", {}).get("config", {})
        if isinstance(cfg.get("box"), dict):
            cfg["box"]["name"] = config.box.name
        if isinstance(cfg.get("pallet"), dict):
            cfg["pallet"]["name"] = config.pallet.name
    return result


def compute_variants(data: Dict) -> Dict:
    """Validates `data` (the request body) and, if valid, returns
    `{"variants": [...]}`. On validation failure returns `{"errors": [...]}`
    instead — callers should map that to an HTTP 400.

    Variants feature is disabled: only the single auto layout is returned.
    To re-enable, swap stack_layers call back to generate_variants.
    """
    config = build_config(data)
    errors = validate_config(config)
    if errors:
        return {"errors": errors}

    result = stack_layers(config)
    return {
        "variants": [
            {
                "name": "Maximum boxes (auto)",
                "description": "Engine picks the best orientation per layer.",
                "result": _serialize_result(result),
            }
        ]
    }
