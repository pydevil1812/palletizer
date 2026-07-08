"""
Packing engine.

Two stages:
  1. `pack_rectangle` arranges identical a x b rectangles inside an
     L x W footprint (one pallet layer). Two solvers cooperate:

       * `_strip_rects` — exact DP over all two-type strip decompositions
         (fast, always available, optimal within the "parallel strips"
         class of layouts).
       * `_five_block_pack` — the classic Pallet Loading Problem
         decomposition (Morabito & Morales): recursively split the
         rectangle into up to five sub-blocks — four around the edges
         arranged pinwheel-fashion plus one in the centre — and solve each
         block independently, memoised on raster-normalized sizes.
         Straight guillotine cuts are the degenerate cases (x1 = x2 or
         y1 = y2), so this strictly generalizes both the strip DP and
         recursive guillotine cutting, and additionally finds
         NON-guillotine layouts such as the pinwheel-with-central-hole
         patterns that dense pallet loads often need (e.g. 17 boxes of
         330x190 on a 1300x900 footprint, where the best guillotine
         layout stops at 16).

     The five-block search is budgeted: when the raster grid is too fine
     (tiny box on a huge pallet) it falls back to the strip DP, so worst-
     case behaviour never regresses below the historical algorithm.

     Stage 1 has two modes (`StackingConfig.packing_mode`):

       * "standard" — the two solvers above, maximizing box count. Gaps
         end up collected near the container walls.
       * "spiral"  — `_spiral_pack`: a pinwheel ("brick-laying") perimeter
         ring with all four corners solidly locked, plus a dense fill of
         the interior. Boxes are packed as tightly as possible; only when
         an arm has leftover slack is a single intentional gap left
         mid-arm (both corner ends stay tight), so the ring closes into a
         solid unit when compressed with stretch wrap or straps. A central
         hole may remain, as in classic spiral pallet patterns. Layers
         alternate chirality (mirrored every other layer) so the vertical
         seams interlock like brickwork.

  2. `stack_layers` repeatedly calls stage 1 for every allowed box
     orientation, picks the orientation that yields the most boxes for
     the height/weight budget remaining, and stacks layers until the
     pallet runs out of height or weight capacity.
"""
from __future__ import annotations

import bisect
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


def _strip_rects(L: float, W: float, a: float, b: float, allow_swap: bool) -> List[Rect]:
    """Exact DP over two-type strip decompositions (single split, no
    recursion) — see the module docstring, stage 1. This is the floor/base
    case that `pack_rectangle`'s recursive search always falls back to, so
    it alone determines behaviour when `allow_swap` is False.

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


def _raster_points(dim: float, a: float, b: float) -> List[float]:
    """All conic combinations r*a + s*b (r, s >= 0) that fit within `dim`.
    These are the only x/y positions where a block boundary can usefully
    sit, which is what keeps the five-block search space small."""
    vals = {0.0}
    frontier = [0.0]
    while frontier:
        nxt = []
        for v in frontier:
            for step in (a, b):
                nv = round(v + step, 6)
                if nv <= dim and nv not in vals:
                    vals.add(nv)
                    nxt.append(nv)
        frontier = nxt
    return sorted(vals)


def _normalize(dim: float, rast: List[float]) -> float:
    """Largest raster value <= dim. Packing an l x w area is equivalent to
    packing normalize(l) x normalize(w): the trimmed margin can't hold any
    box edge anyway. This collapses the recursion onto few distinct states."""
    i = bisect.bisect_right(rast, dim) - 1
    return rast[i] if i >= 0 else 0.0


# Budgets for the five-block search. `_FIVE_BLOCK_OPS` caps the total number
# of (x1,x2,y1,y2) combinations examined across the whole recursion; when a
# single state's combination count alone exceeds the cap (tiny box on a huge
# pallet -> very fine raster) the search is skipped entirely and the strip DP
# result is used, so worst-case behaviour never regresses.
_FIVE_BLOCK_OPS = 3_000_000


def _five_block_pack(L: float, W: float, a: float, b: float) -> List[Rect]:
    """Recursive five-block (pinwheel) packing of a x b boxes on L x W.

    Every state is canonicalized to raster-normalized (long, short) sizes;
    the exact strip DP is the base solution for each state, and the search
    tries every five-block split with corners on raster points. Solutions
    are rebuilt from the memoised choices after the search.
    """
    amax, amin = max(a, b), min(a, b)
    rast = _raster_points(max(L, W), a, b)
    counts: Dict[Tuple[float, float], int] = {}
    choices: Dict[Tuple[float, float], Tuple] = {}
    ops = [_FIVE_BLOCK_OPS]
    box_area = a * b

    def solve(l: float, w: float) -> int:
        """`l >= w`, both raster-normalized. Returns the best box count."""
        if l < amax or w < amin:
            return 0
        key = (l, w)
        cached = counts.get(key)
        if cached is not None:
            return cached
        # Pre-seed with the strip DP so recursive references to this state
        # (via blocks of the same normalized size) see a valid floor value.
        best = len(_strip_rects(l, w, a, b, True))
        best_choice: Tuple = ("strip",)
        counts[key] = best
        choices[key] = best_choice

        area_ub = int((l * w) // box_area)
        if best < area_ub and ops[0] > 0:
            cx = [v for v in rast if v <= l]
            cy = [v for v in rast if v <= w]
            n_combos = (len(cx) * (len(cx) + 1) // 2) * (len(cy) * (len(cy) + 1) // 2)
            if n_combos <= ops[0]:
                ops[0] -= n_combos
                done = False
                for i1, x1 in enumerate(cx):
                    if done:
                        break
                    for x2 in cx[i1:]:
                        if done:
                            break
                        for j1, y1 in enumerate(cy):
                            if done:
                                break
                            for y2 in cy[j1:]:
                                # Five blocks: left, top, right, bottom, centre.
                                blocks = ((x1, w - y1), (l - x1, w - y2),
                                          (l - x2, y2), (x2, y1),
                                          (x2 - x1, y2 - y1))
                                v = 0
                                degenerate = False
                                for (bl, bw) in blocks:
                                    if bl <= 0 or bw <= 0:
                                        continue
                                    if bl >= l and bw >= w:
                                        degenerate = True  # block == whole rect
                                        break
                                    nl = _normalize(bl, rast)
                                    nw = _normalize(bw, rast)
                                    v += solve(nl, nw) if nl >= nw else solve(nw, nl)
                                if degenerate:
                                    continue
                                if v > best:
                                    best, best_choice = v, ("five", x1, x2, y1, y2)
                                    counts[key] = best
                                    choices[key] = best_choice
                                    if best >= area_ub:
                                        done = True
                                        break
        return best

    def build(l: float, w: float) -> List[Rect]:
        """Rebuild the rect list for a solved canonical state."""
        if l < amax or w < amin:
            return []
        solve(l, w)
        c = choices[(l, w)]
        if c[0] == "strip":
            return _strip_rects(l, w, a, b, True)
        _, x1, x2, y1, y2 = c
        placed_blocks = ((0.0, y1, x1, w - y1), (x1, y2, l - x1, w - y2),
                         (x2, 0.0, l - x2, y2), (0.0, 0.0, x2, y1),
                         (x1, y1, x2 - x1, y2 - y1))
        out: List[Rect] = []
        for (bx, by, bl, bw) in placed_blocks:
            if bl <= 0 or bw <= 0:
                continue
            nl = _normalize(bl, rast)
            nw = _normalize(bw, rast)
            if nl >= nw:
                out += [(bx + rx, by + ry, rw, rh) for (rx, ry, rw, rh) in build(nl, nw)]
            else:  # canonical solution is transposed relative to this block
                out += [(bx + ry, by + rx, rh, rw) for (rx, ry, rw, rh) in build(nw, nl)]
        return out

    nL, nW = _normalize(L, rast), _normalize(W, rast)
    if nL >= nW:
        return build(nL, nW)
    return [(ry, rx, rh, rw) for (rx, ry, rw, rh) in build(nW, nL)]


def _arm_offsets(n: int, p: float, span: float) -> List[float]:
    """Offsets of `n` boxes of length `p` along an arm of length `span`,
    packed as tightly as possible. If the arm has slack, both corner ends
    stay tight and the single leftover gap is left mid-arm (never at a
    corner), so it can close up under compression; an exact fit has no gap
    at all. With n == 1 the box hugs its anchor corner and the slack sits
    at the tail."""
    slack = span - n * p
    if slack <= 1e-9 or n == 1:
        return [i * p for i in range(n)]
    k = (n + 1) // 2  # boxes tight against the anchor corner; rest tight at the far end
    return [i * p for i in range(k)] + [span - (n - i) * p for i in range(k, n)]


def _spiral_ring(L: float, W: float, p: float, q: float) -> Optional[List[Rect]]:
    """Pinwheel perimeter ring of p×q boxes (p = long side) around the
    L × W footprint, ring thickness q. Each of the four arms is anchored at
    "its" corner and runs toward the next corner, so all four corners are
    solidly occupied. Returns None when a full ring (>= 1 box per arm) does
    not fit.
    """
    # An arm spans (side length - q); it must hold at least one p-long box.
    n_x = int((L - q) // p)  # boxes per horizontal arm (bottom / top)
    n_y = int((W - q) // p)  # boxes per vertical arm (left / right)
    if n_x < 1 or n_y < 1:
        return None

    rects: List[Rect] = []
    # Arm regions (disjoint, pinwheel-fashion):
    #   bottom x∈[0, L−q) y∈[0, q)   |  right x∈[L−q, L) y∈[0, W−q)
    #   top    x∈[q, L)   y∈[W−q, W) |  left  x∈[0, q)   y∈[q, W)
    for d in _arm_offsets(n_x, p, L - q):
        rects.append((d, 0.0, p, q))              # bottom arm, anchored left
        rects.append((L - p - d, W - q, p, q))    # top arm, anchored right
    for d in _arm_offsets(n_y, p, W - q):
        rects.append((L - q, d, q, p))            # right arm, anchored bottom
        rects.append((0.0, W - p - d, q, p))      # left arm, anchored top
    return rects


def _spiral_pack(L: float, W: float, a: float, b: float) -> List[Rect]:
    """Pinwheel perimeter ring + dense interior ("spiral"/brick-laying
    pallet pattern).

    The outer boxes form a complete perimeter with locked corners; the
    central space is then filled as tightly as possible with the standard
    solvers (whatever hole remains is the classic central gap of spiral
    patterns). When no full ring fits, the whole footprint is packed
    densely instead.
    """
    if a <= 0 or b <= 0 or L <= 0 or W <= 0:
        return []
    p, q = max(a, b), min(a, b)
    ring = _spiral_ring(L, W, p, q)
    if ring is None:
        return _five_block_pack(L, W, a, b)
    inner_l, inner_w = L - 2 * q, W - 2 * q
    if inner_l >= q and inner_w >= q:
        core = _five_block_pack(inner_l, inner_w, a, b)
        ring += [(q + rx, q + ry, rw, rh) for (rx, ry, rw, rh) in core]
    return ring


# Layer layouts are recomputed for every layer/orientation/variant with the
# same arguments, so memoise across calls. Cleared wholesale when it grows —
# a handful of configs is the normal working set.
_pack_cache: Dict[Tuple[float, float, float, float, str], List[Rect]] = {}


def pack_rectangle(L: float, W: float, a: float, b: float, allow_swap: bool,
                   mode: str = "standard") -> List[Rect]:
    """Layout of identical a×b footprints on an L×W pallet — see the module
    docstring for the two packing modes and the two-solver (strip DP +
    five-block) approach behind the standard one.
    """
    if a <= 0 or b <= 0 or L <= 0 or W <= 0:
        return []
    if not allow_swap:
        # Pinwheel arms need both footprint orientations, so the spiral
        # pattern is only possible when 90° rotation is allowed.
        return _strip_rects(L, W, a, b, False)
    key = (L, W, a, b, mode)
    cached = _pack_cache.get(key)
    if cached is None:
        if mode == "spiral":
            cached = _spiral_pack(L, W, a, b)
        else:
            cached = _five_block_pack(L, W, a, b)
        if len(_pack_cache) > 256:
            _pack_cache.clear()
        _pack_cache[key] = cached
    return list(cached)


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


def _fixed_additional_weight(additional: Optional[AdditionalElements]) -> float:
    """One-off accessory weight not tied to a specific layer (film, corner
    posts). Unlike spacers, these are added to the load once regardless of
    layer count, so they're reserved up front against load_capacity instead
    of being folded in per-layer."""
    if not (additional and additional.enabled):
        return 0.0
    w = 0.0
    if additional.use_film:
        w += additional.film_weight_kg
    if additional.use_corner_posts:
        w += additional.corner_post_weight_kg
    return w


def stack_layers(config: StackingConfig) -> StackingResult:
    box, pallet = config.box, config.pallet
    orientations = generate_orientations(box, config.orientation_flags)
    additional = config.additional

    z_cursor = pallet.deck_height
    weight_used = 0.0
    fixed_w = _fixed_additional_weight(additional)
    layers: List[LayerResult] = []
    layer_idx = 0
    max_iterations = 1000  # safety guard against pathological inputs
    limiting = "pattern"

    while layer_idx < max_iterations:
        spacer_h = _layer_height_budget(layer_idx, additional)
        spacer_w = _layer_weight_budget(layer_idx, additional)
        remaining_h = config.max_stack_height - z_cursor - spacer_h
        remaining_w = pallet.load_capacity - weight_used - spacer_w - fixed_w
        if remaining_h <= 0:
            limiting = "height"
            break
        if remaining_w <= 0:
            limiting = "weight"
            break

        best = None
        weight_rejected = False
        for orient in orientations:
            if orient["dz"] > remaining_h or orient["dz"] <= 0:
                continue
            rects = pack_rectangle(pallet.length, pallet.width,
                                    orient["dx"], orient["dy"],
                                    config.orientation_flags.allow_rotate_z,
                                    config.packing_mode)
            count = len(rects)
            if count == 0:
                continue
            layer_weight = count * box.weight
            if layer_weight > remaining_w:
                max_by_weight = int(remaining_w // box.weight) if box.weight > 0 else count
                if max_by_weight <= 0:
                    weight_rejected = True
                    continue
                rects = rects[:max_by_weight]
                count = max_by_weight
                layer_weight = count * box.weight
            if best is None or count > best["count"]:
                best = {"orient": orient, "rects": rects, "count": count, "weight": layer_weight}

        if not best or best["count"] == 0:
            if layer_idx == 0:
                limiting = "pattern"
            elif weight_rejected:
                limiting = "weight"
            else:
                limiting = "height"
            break

        if config.packing_mode == "spiral" and layer_idx % 2 == 1:
            # Mirror every other layer (flip chirality of the pinwheel) so
            # vertical seams interlock like brickwork between layers.
            best["rects"] = [(pallet.length - x - w, y, w, h)
                             for (x, y, w, h) in best["rects"]]

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
    gross_weight = total_weight + _fixed_additional_weight(additional)
    weight_utilization_pct = (gross_weight / pallet.load_capacity * 100.0
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
                            total_height: float, total_weight: float) -> List[Dict]:
    """Lightweight, explainable heuristics. These are suggestions only and
    do not modify the result; a human should sanity-check before changing
    box specs. Each entry is `{code, params}` rather than pre-rendered text
    so the client can localize it (see front/src/i18n/{ru,en}.js:
    `recommendations.codes`)."""
    recs: List[Dict] = []
    box, pallet = config.box, config.pallet

    if not layers:
        recs.append({"code": "noFit", "params": {}})
        return recs

    bottom = layers[0]
    nx, ny = _grid(pallet.length, pallet.width, bottom.dim_x, bottom.dim_y)
    REC_THRESHOLD = 0.15  # only suggest "modest" size reductions, not drastic redesigns

    if nx > 0:
        rem_x = pallet.length - nx * bottom.dim_x
        target_dx = pallet.length / (nx + 1)
        reduction = bottom.dim_x - target_dx
        if 0 < reduction <= bottom.dim_x * REC_THRESHOLD:
            params = {
                "current": round(bottom.dim_x),
                "reduction": round(reduction),
                "target": round(target_dx),
                "nx1": nx + 1,
                "nx": nx,
            }
            if rem_x > 1:
                recs.append({"code": "reduceLengthReclaim", "params": {**params, "rem": round(rem_x)}})
            else:
                recs.append({"code": "reduceLength", "params": params})
    if ny > 0:
        rem_y = pallet.width - ny * bottom.dim_y
        target_dy = pallet.width / (ny + 1)
        reduction = bottom.dim_y - target_dy
        if 0 < reduction <= bottom.dim_y * REC_THRESHOLD:
            params = {
                "current": round(bottom.dim_y),
                "reduction": round(reduction),
                "target": round(target_dy),
                "ny1": ny + 1,
                "ny": ny,
            }
            if rem_y > 1:
                recs.append({"code": "reduceWidthReclaim", "params": {**params, "rem": round(rem_y)}})
            else:
                recs.append({"code": "reduceWidth", "params": params})

    n_layers = len(layers)
    avg_dz = sum(l.dim_z for l in layers) / n_layers
    available_for_layers = config.max_stack_height - pallet.deck_height
    target_dz = available_for_layers / (n_layers + 1)
    reduction_h = avg_dz - target_dz
    if 0 < reduction_h <= avg_dz * REC_THRESHOLD:
        recs.append({
            "code": "reduceHeight",
            "params": {
                "reduction": round(reduction_h),
                "target": round(target_dz),
                "n1": n_layers + 1,
                "n": n_layers,
                "max": round(config.max_stack_height),
            },
        })

    weight_headroom = pallet.load_capacity - total_weight
    height_headroom = config.max_stack_height - total_height
    if height_headroom < avg_dz and weight_headroom > box.weight * 5:
        recs.append({
            "code": "heightLimited",
            "params": {
                "headroom": round(weight_headroom),
                "pct": round(weight_headroom / pallet.load_capacity * 100),
            },
        })
    elif weight_headroom < box.weight and height_headroom > avg_dz:
        recs.append({
            "code": "weightLimited",
            "params": {
                "headroom": round(height_headroom),
                "capacity": round(pallet.load_capacity),
            },
        })

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
            recs.append({
                "code": "lowFillWithDisabledFlags",
                "params": {"fill": round(avg_fill * 100), "flags": disabled},
            })
        else:
            recs.append({
                "code": "lowFillAllRotationsAllowed",
                "params": {"fill": round(avg_fill * 100)},
            })

    return recs
