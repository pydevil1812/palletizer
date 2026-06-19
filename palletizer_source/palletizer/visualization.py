"""
Visualization for a StackingResult: 2D top view(s), 2D side/front
elevation, and a 3D rendering. All functions save a PNG and return its
path. Matplotlib is used everywhere so the program has no heavyweight
extra dependency; swapping in plotly for an interactive 3D view is a
natural future extension (see `plot_3d` docstring).
"""
from __future__ import annotations

import os
from typing import List, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

from .models import LayerResult, Pallet, StackingResult

LAYER_CMAP = plt.get_cmap("tab20")


def _layer_color(idx: int):
    return LAYER_CMAP(idx % 20)


def _draw_top_view(ax, pallet: Pallet, layer: LayerResult, title: str):
    ax.add_patch(Rectangle((0, 0), pallet.length, pallet.width,
                            fill=False, edgecolor="black", linewidth=2))
    for i, (x, y, w, h) in enumerate(layer.rects):
        ax.add_patch(Rectangle((x, y), w, h, facecolor=_layer_color(layer.index),
                                edgecolor="white", linewidth=0.8, alpha=0.9))
        if len(layer.rects) <= 60:
            ax.text(x + w / 2, y + h / 2, str(i + 1), ha="center", va="center", fontsize=6)
    ax.set_xlim(-50, pallet.length + 50)
    ax.set_ylim(-50, pallet.width + 50)
    ax.set_aspect("equal")
    ax.set_title(title, fontsize=9)
    ax.set_xlabel("X (mm)", fontsize=7)
    ax.set_ylabel("Y (mm)", fontsize=7)
    ax.tick_params(labelsize=6)


def plot_top_views(result: StackingResult, out_path: str) -> str:
    """Top view for every DISTINCT layer pattern (deduplicated by
    footprint dimensions + box count), so the figure stays compact even
    for tall stacks where most layers repeat the same pattern."""
    pallet = result.config.pallet
    layers = result.layers
    if not layers:
        fig, ax = plt.subplots(figsize=(4, 3))
        ax.text(0.5, 0.5, "No layers could be placed", ha="center", va="center")
        ax.axis("off")
        fig.savefig(out_path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        return out_path

    seen = {}
    for layer in layers:
        key = (round(layer.dim_x, 1), round(layer.dim_y, 1), layer.count)
        if key not in seen:
            seen[key] = layer

    patterns = list(seen.values())
    n = len(patterns)
    ncols = min(3, n)
    nrows = (n + ncols - 1) // ncols
    fig, axes = plt.subplots(nrows, ncols, figsize=(4.2 * ncols, 4.2 * nrows), squeeze=False)

    for idx, layer in enumerate(patterns):
        ax = axes[idx // ncols][idx % ncols]
        which_layers = [l.index + 1 for l in layers
                        if (round(l.dim_x, 1), round(l.dim_y, 1), l.count) ==
                           (round(layer.dim_x, 1), round(layer.dim_y, 1), layer.count)]
        layer_desc = f"Layer {which_layers[0]}" if len(which_layers) == 1 else \
                     f"Layers {which_layers[0]}-{which_layers[-1]}" if which_layers == list(range(which_layers[0], which_layers[-1] + 1)) \
                     else f"Layers {which_layers}"
        title = f"{layer_desc}: {layer.count} boxes ({layer.dim_x:.0f}x{layer.dim_y:.0f} mm footprint)"
        _draw_top_view(ax, pallet, layer, title)

    for idx in range(n, nrows * ncols):
        axes[idx // ncols][idx % ncols].axis("off")

    fig.suptitle(f"Top view by layer pattern — {result.config.pallet.name}", fontsize=11)
    fig.tight_layout(rect=[0, 0, 1, 0.96])
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


def plot_side_views(result: StackingResult, out_path: str) -> str:
    """Front elevation (X-Z) and side elevation (Y-Z), drawn as one slab
    per layer (since all boxes in a layer share the same height)."""
    pallet = result.config.pallet
    layers = result.layers
    fig, (ax_front, ax_side) = plt.subplots(1, 2, figsize=(11, 5))

    max_h = result.config.max_stack_height
    ax_front.add_patch(Rectangle((0, 0), pallet.length, pallet.deck_height,
                                  facecolor="#8a6a4a", edgecolor="black"))
    ax_side.add_patch(Rectangle((0, 0), pallet.width, pallet.deck_height,
                                 facecolor="#8a6a4a", edgecolor="black"))

    for layer in layers:
        extent_x = max((x + w for x, y, w, h in layer.rects), default=0)
        extent_y = max((y + h for x, y, w, h in layer.rects), default=0)
        color = _layer_color(layer.index)
        ax_front.add_patch(Rectangle((0, layer.z_start), extent_x, layer.dim_z,
                                      facecolor=color, edgecolor="black", linewidth=0.6))
        ax_side.add_patch(Rectangle((0, layer.z_start), extent_y, layer.dim_z,
                                     facecolor=color, edgecolor="black", linewidth=0.6))

    for ax, span, label in ((ax_front, pallet.length, "Front view (X-Z)"),
                             (ax_side, pallet.width, "Side view (Y-Z)")):
        ax.axhline(max_h, color="red", linestyle="--", linewidth=1, label="Max stack height")
        ax.set_xlim(-50, span + 50)
        ax.set_ylim(0, max_h * 1.08)
        ax.set_aspect("equal")
        ax.set_title(label, fontsize=10)
        ax.set_ylabel("Z (mm)", fontsize=8)
        ax.tick_params(labelsize=7)
        ax.legend(fontsize=7, loc="upper right")

    ax_front.set_xlabel("X (mm)", fontsize=8)
    ax_side.set_xlabel("Y (mm)", fontsize=8)
    fig.suptitle(f"Elevation views — {result.total_boxes} boxes, {result.total_height:.0f} mm tall", fontsize=11)
    fig.tight_layout(rect=[0, 0, 1, 0.93])
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


def _cuboid_faces(x, y, z, dx, dy, dz):
    p = [
        (x, y, z), (x + dx, y, z), (x + dx, y + dy, z), (x, y + dy, z),
        (x, y, z + dz), (x + dx, y, z + dz), (x + dx, y + dy, z + dz), (x, y + dy, z + dz),
    ]
    return [
        [p[0], p[1], p[2], p[3]],
        [p[4], p[5], p[6], p[7]],
        [p[0], p[1], p[5], p[4]],
        [p[1], p[2], p[6], p[5]],
        [p[2], p[3], p[7], p[6]],
        [p[3], p[0], p[4], p[7]],
    ]


def plot_3d(result: StackingResult, out_path: str) -> str:
    """Static 3D rendering via matplotlib's mplot3d.

    Future extension: for an INTERACTIVE 3D view (rotate/zoom in the
    browser), swap this for a plotly `go.Mesh3d`/`go.Figure` and export
    with `fig.write_html(...)`; the box geometry helper `_cuboid_faces`
    above is reusable as-is for building plotly mesh vertices/faces.
    """
    pallet = result.config.pallet
    fig = plt.figure(figsize=(8, 8))
    ax = fig.add_subplot(111, projection="3d")

    deck_faces = _cuboid_faces(0, 0, 0, pallet.length, pallet.width, pallet.deck_height)
    ax.add_collection3d(Poly3DCollection(deck_faces, facecolor="#8a6a4a", edgecolor="black",
                                          linewidths=0.3, alpha=0.9))

    for layer in result.layers:
        color = _layer_color(layer.index)
        for (x, y, w, h) in layer.rects:
            faces = _cuboid_faces(x, y, layer.z_start, w, h, layer.dim_z)
            ax.add_collection3d(Poly3DCollection(faces, facecolor=color, edgecolor="black",
                                                  linewidths=0.25, alpha=0.92))

    top = max(result.total_height, pallet.deck_height + 1)
    ax.set_xlim(0, pallet.length)
    ax.set_ylim(0, pallet.width)
    ax.set_zlim(0, top)
    try:
        ax.set_box_aspect((pallet.length, pallet.width, top))
    except AttributeError:
        pass
    ax.set_xlabel("X (mm)")
    ax.set_ylabel("Y (mm)")
    ax.set_zlabel("Z (mm)")
    ax.set_title(f"3D stacking — {result.total_boxes} boxes, {len(result.layers)} layers")
    ax.view_init(elev=22, azim=-60)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


def generate_all_visuals(result: StackingResult, out_dir: str) -> dict:
    os.makedirs(out_dir, exist_ok=True)
    return {
        "top_view": plot_top_views(result, os.path.join(out_dir, "top_view.png")),
        "side_view": plot_side_views(result, os.path.join(out_dir, "side_view.png")),
        "view_3d": plot_3d(result, os.path.join(out_dir, "view_3d.png")),
    }
