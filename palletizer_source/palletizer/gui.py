"""
Pallet Stacking Studio - desktop application (Tkinter + matplotlib).

Mirrors the web tool: form-based data entry, a mouse-rotatable 3D view, 2D
top/side views, a coordinate table, fill/weight stats, recommendations and
Excel/PDF export. Adds three things the web version doesn't have:

  * SEVERAL box arrangements per query (see variants.py) that the user can
    switch between from the "Options" popup.
  * A persistent QUERY HISTORY in SQLite (see history.py), browsable from the
    "History" popup; double-click a past query to reload it.
  * Both popups are opened from compact buttons on the top-right.

The 3D view is matplotlib's mplot3d embedded in the Tk canvas, so it rotates
by left-drag and zooms by scroll out of the box.
"""
from __future__ import annotations

import colorsys
import json
import math
import os
import tempfile
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import numpy as np

# Real z-buffered 3D engine (VTK). Optional: if it (or PIL) is missing the app
# falls back to the lightweight Canvas3D renderer below.
try:
    import vtk
    from vtk.util.numpy_support import vtk_to_numpy
    from PIL import Image, ImageTk
    HAVE_VTK = True
except Exception:
    HAVE_VTK = False

import matplotlib
matplotlib.use("TkAgg")
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.colors import to_rgba
from matplotlib.figure import Figure
from matplotlib.patches import Rectangle
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

from . import history
from .models import (AdditionalElements, Box, OrientationFlags, Pallet,
                     StackingConfig)
from .report import export_excel, export_pdf
from .variants import generate_variants
from .visualization import _cuboid_faces, generate_all_visuals

# ---------------------------------------------------------------------------
# Theme
# ---------------------------------------------------------------------------
BG = "#0f141b"; PANEL = "#171f2a"; PANEL2 = "#1e2835"; LINE = "#2b384a"
TEXT = "#e6edf5"; MUTED = "#93a4b8"; ACCENT = "#4da3ff"; ACCENT2 = "#36c08a"
CHIP = "#243043"; DECK = "#6b5331"

EXAMPLE = {
    "box": {"name": "Carton A", "length": 400, "width": 300, "height": 250, "weight": 8.5},
    "pallet": {"name": "EUR pallet (1200x800)", "length": 1200, "width": 800,
               "deck_height": 150, "load_capacity": 700},
    "max_stack_height": 1800,
    "orientation_flags": {"allow_rotate_x": False, "allow_rotate_y": False, "allow_rotate_z": True},
    "additional_elements": {"enabled": False, "use_spacers": True, "spacer_thickness_mm": 5,
                            "spacer_weight_kg": 0.3, "use_corner_posts": False,
                            "corner_post_weight_kg": 0, "use_film": True, "film_weight_kg": 1.2},
}


# ---------------------------------------------------------------------------
# Config <-> dict
# ---------------------------------------------------------------------------
def config_from_dict(d: dict) -> StackingConfig:
    box = Box(**d["box"])
    pallet = Pallet(**d["pallet"])
    flags = OrientationFlags(**d.get("orientation_flags", {}))
    add = None
    ad = d.get("additional_elements")
    if ad:
        add = AdditionalElements(**ad)
    return StackingConfig(box=box, pallet=pallet,
                          max_stack_height=d["max_stack_height"],
                          orientation_flags=flags, additional=add)


# ---------------------------------------------------------------------------
# Drawing (module-level so they can be tested without a Tk window)
# ---------------------------------------------------------------------------
def layer_color(i: int, n: int):
    hue = (205 / 360) if n <= 1 else (i / n) * (300 / 360)
    return colorsys.hls_to_rgb(hue, 0.58, 0.70)


def draw_3d(ax, result):
    ax.clear()
    P = result.config.pallet
    ax.set_facecolor(BG)
    for axis in (ax.xaxis, ax.yaxis, ax.zaxis):
        try:
            axis.set_pane_color((0.05, 0.07, 0.10, 1.0))
        except Exception:
            pass
        axis.label.set_color(MUTED)
    ax.tick_params(colors=MUTED, labelsize=7)

    # Collect every face (deck + all boxes) into ONE Poly3DCollection so
    # matplotlib depth-sorts the individual faces against each other. Using a
    # separate collection per box makes matplotlib sort whole boxes by a single
    # average depth, which is what causes boxes to pop in/out while rotating.
    n = len(result.layers)
    edges = result.total_boxes <= 400
    faces, fcolors, ecolors = [], [], []
    deck_face = to_rgba(DECK, 1.0)
    deck_edge = to_rgba("#3a2c18", 1.0)
    for f in _cuboid_faces(0, 0, 0, P.length, P.width, P.deck_height):
        faces.append(f); fcolors.append(deck_face); ecolors.append(deck_edge)
    dark_edge = to_rgba("#0c1118", 1.0)
    for layer in result.layers:
        col = to_rgba(layer_color(layer.index, n), 1.0)
        edge = dark_edge if edges else col
        for (x, y, w, h) in layer.rects:
            for f in _cuboid_faces(x, y, layer.z_start, w, h, layer.dim_z):
                faces.append(f); fcolors.append(col); ecolors.append(edge)
    coll = Poly3DCollection(faces, facecolors=fcolors, edgecolors=ecolors,
                            linewidths=(0.3 if edges else 0.0))
    ax.add_collection3d(coll)

    top = max(result.total_height, P.deck_height + 1)
    ax.set_xlim(0, P.length); ax.set_ylim(0, P.width); ax.set_zlim(0, top)
    try:
        ax.set_box_aspect((P.length, P.width, top))
    except Exception:
        pass
    ax.set_xlabel("X (mm)"); ax.set_ylabel("Y (mm)"); ax.set_zlabel("Z (mm)")
    ax.view_init(elev=22, azim=-60)


def draw_top(ax, result, layer_index: int):
    ax.clear()
    ax.set_facecolor(BG)
    if not result.layers:
        ax.text(0.5, 0.5, "No layout", color=MUTED, ha="center"); ax.axis("off"); return
    P = result.config.pallet
    layer_index = max(0, min(layer_index, len(result.layers) - 1))
    layer = result.layers[layer_index]
    ax.add_patch(Rectangle((0, 0), P.length, P.width, fill=True,
                           facecolor="#2a2014", edgecolor=DECK, linewidth=2))
    col = layer_color(layer.index, len(result.layers))
    # id of first box in this layer (boxes numbered layer by layer)
    base = sum(len(l.rects) for l in result.layers[:layer_index]) + 1
    for k, (x, y, w, h) in enumerate(layer.rects):
        ax.add_patch(Rectangle((x, y), w, h, facecolor=col, edgecolor="#0c1118",
                               linewidth=0.8, alpha=0.9))
        if len(layer.rects) <= 60:
            ax.text(x + w / 2, y + h / 2, str(base + k), ha="center", va="center",
                    fontsize=6, color="#06121f")
    ax.set_xlim(-40, P.length + 40); ax.set_ylim(-40, P.width + 40)
    ax.set_aspect("equal")
    ax.set_title(f"Layer {layer_index + 1} - {len(layer.rects)} boxes - {layer.orientation}",
                 color=TEXT, fontsize=9)
    ax.set_xlabel("length X (mm)", color=MUTED, fontsize=8)
    ax.set_ylabel("width Y (mm)", color=MUTED, fontsize=8)
    ax.tick_params(colors=MUTED, labelsize=7)


def draw_side(ax, result, axis_kind: str):
    ax.clear()
    ax.set_facecolor(BG)
    if not result.layers:
        ax.text(0.5, 0.5, "No layout", color=MUTED, ha="center"); ax.axis("off"); return
    P = result.config.pallet
    along_len = axis_kind == "length"
    span = P.length if along_len else P.width
    max_h = result.config.max_stack_height

    ax.add_patch(Rectangle((0, 0), span, P.deck_height, facecolor="#2a2014",
                           edgecolor=DECK, linewidth=2))
    n = len(result.layers)
    for b in result.placed_boxes:
        along = b.x if along_len else b.y
        dlen = b.dim_x if along_len else b.dim_y
        ax.add_patch(Rectangle((along, b.z), dlen, b.dim_z,
                               facecolor=layer_color(b.layer, n),
                               edgecolor="#0c1118", linewidth=0.5, alpha=0.6))
    ax.axhline(max_h, color="#e7a13a", linestyle="--", linewidth=1)
    ax.text(0, max_h + max_h * 0.01, f"max {max_h:.0f} mm", color="#e7a13a", fontsize=8)
    ax.set_xlim(-40, span + 40); ax.set_ylim(0, max_h * 1.08)
    ax.set_aspect("equal")
    ax.set_title(f"{'Front (along length)' if along_len else 'Side (along width)'}",
                 color=TEXT, fontsize=9)
    ax.set_xlabel(("length" if along_len else "width") + " (mm)", color=MUTED, fontsize=8)
    ax.set_ylabel("height (mm)", color=MUTED, fontsize=8)
    ax.tick_params(colors=MUTED, labelsize=7)


# ---------------------------------------------------------------------------
# Canvas3D - a small, correct 3D viewer on a Tk Canvas.
#
# matplotlib's mplot3d sorts whole collections by one average depth, so boxes
# pop in/out while rotating. Here we draw each cuboid face as a filled polygon
# and (a) cull back faces and (b) paint the remaining faces back-to-front by
# their true rotated depth. Because the boxes are axis-aligned and never
# overlap, this painter's-algorithm ordering is exact - nothing disappears.
# ---------------------------------------------------------------------------
# vertex order of _box_verts: 0-3 bottom ring, 4-7 top ring
_FACES_IDX = [
    (0, 1, 2, 3),   # bottom  (-z)
    (4, 5, 6, 7),   # top     (+z)
    (0, 1, 5, 4),   # -y side
    (1, 2, 6, 5),   # +x side
    (2, 3, 7, 6),   # +y side
    (3, 0, 4, 7),   # -x side
]
_FACE_NORMALS = np.array([
    [0, 0, -1], [0, 0, 1], [0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]
], dtype=float)
# world-fixed shading (top brightest -> a top-lit look that stays consistent
# as the model rotates)
_FACE_SHADE = [0.50, 1.00, 0.74, 0.86, 0.66, 0.80]


def _box_verts(x, y, z, dx, dy, dz):
    return np.array([
        [x, y, z], [x + dx, y, z], [x + dx, y + dy, z], [x, y + dy, z],
        [x, y, z + dz], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x, y + dy, z + dz],
    ], dtype=float)


def _shade_hex(rgb, f):
    return "#%02x%02x%02x" % tuple(min(255, int(c * f)) for c in rgb)


class Canvas3D(tk.Frame):
    def __init__(self, master):
        super().__init__(master, bg=BG)
        self.canvas = tk.Canvas(self, bg="#0c1118", highlightthickness=0)
        self.canvas.pack(fill="both", expand=True)
        self.azim, self.elev, self.zoom = -60.0, 22.0, 1.0
        self.verts = None          # (N*8, 3) centred vertices
        self.box_base = []         # rgb per box (0-255)
        self.extent = 1.0
        self.draw_edges = True
        self._last = None
        self.canvas.bind("<ButtonPress-1>", self._press)
        self.canvas.bind("<B1-Motion>", self._drag)
        self.canvas.bind("<MouseWheel>", self._wheel)
        self.canvas.bind("<Configure>", lambda e: self.redraw())

    def reset(self):
        self.azim, self.elev, self.zoom = -60.0, 22.0, 1.0
        self.redraw()

    def set_result(self, result):
        cuboids = []  # (verts8, rgb255)
        if result and (result.layers or result.config):
            P = result.config.pallet
            cuboids.append((_box_verts(0, 0, 0, P.length, P.width, P.deck_height),
                            (107, 83, 49)))
            n = len(result.layers)
            for layer in result.layers:
                rgb = tuple(int(255 * c) for c in layer_color(layer.index, n))
                for (x, y, w, h) in layer.rects:
                    cuboids.append((_box_verts(x, y, layer.z_start, w, h, layer.dim_z), rgb))
            self.draw_edges = result.total_boxes <= 400
        if not cuboids:
            self.verts = None
            self.canvas.delete("all")
            return
        allv = np.vstack([c[0] for c in cuboids])
        mn, mx = allv.min(axis=0), allv.max(axis=0)
        center = (mn + mx) / 2.0
        self.extent = float(max(mx - mn)) or 1.0
        self.verts = allv - center
        self.box_base = [c[1] for c in cuboids]
        self.redraw()

    def _rot(self):
        a, e = math.radians(self.azim), math.radians(self.elev)
        ca, sa, ce, se = math.cos(a), math.sin(a), math.cos(e), math.sin(e)
        rz = np.array([[ca, -sa, 0], [sa, ca, 0], [0, 0, 1]])
        rx = np.array([[1, 0, 0], [0, ce, -se], [0, se, ce]])
        return rx @ rz

    def redraw(self):
        cv = self.canvas
        cv.delete("all")
        if self.verts is None:
            return
        w, h = cv.winfo_width(), cv.winfo_height()
        if w < 4 or h < 4:
            return
        R = self._rot()
        P = self.verts @ R.T                       # rotated vertices
        normals = _FACE_NORMALS @ R.T              # rotated face normals
        scale = 0.8 * min(w, h) / self.extent * self.zoom
        sx = w / 2 + P[:, 0] * scale
        sy = h / 2 - P[:, 2] * scale
        depth = P[:, 1]                            # +Y points toward the camera

        faces = []
        edge = "#0c1118" if self.draw_edges else ""
        for bi, base in enumerate(self.box_base):
            off = bi * 8
            for fi, idx in enumerate(_FACES_IDX):
                if normals[fi, 1] <= 0:            # cull back faces
                    continue
                vids = [off + k for k in idx]
                cz = float(depth[vids].mean())
                pts = []
                for vid in vids:
                    pts.append(sx[vid]); pts.append(sy[vid])
                faces.append((cz, pts, _shade_hex(base, _FACE_SHADE[fi])))
        faces.sort(key=lambda t: t[0])             # far first, near last
        for _, pts, col in faces:
            cv.create_polygon(pts, fill=col, outline=edge, width=1)

    def _press(self, e):
        self._last = (e.x, e.y)

    def _drag(self, e):
        if self._last is None:
            self._last = (e.x, e.y); return
        dx, dy = e.x - self._last[0], e.y - self._last[1]
        self._last = (e.x, e.y)
        self.azim += dx * 0.4
        self.elev = max(-89.0, min(89.0, self.elev - dy * 0.4))
        self.redraw()

    def _wheel(self, e):
        self.zoom *= 1.1 if e.delta > 0 else 1 / 1.1
        self.zoom = max(0.2, min(8.0, self.zoom))
        self.redraw()


# ---------------------------------------------------------------------------
# VTKView - the real 3D engine.
#
# VTK renders with a true per-pixel depth buffer (the same engine behind
# ParaView/PyVista), so there is NO polygon-sorting step and therefore no
# disappearing boxes at any angle. The scene is rendered off-screen and shown
# as an image in the tab; left-drag orbits the camera, the wheel zooms.
# ---------------------------------------------------------------------------
class VTKView(tk.Frame):
    def __init__(self, master):
        super().__init__(master, bg=BG)
        if not HAVE_VTK:
            raise RuntimeError("VTK / Pillow not available")
        self.label = tk.Label(self, bg="#0c1118", bd=0)
        self.label.pack(fill="both", expand=True)

        self.ren = vtk.vtkRenderer()
        self.ren.SetBackground(0.047, 0.067, 0.094)
        self.ren.SetTwoSidedLighting(True)
        self.rw = vtk.vtkRenderWindow()
        self.rw.SetOffScreenRendering(1)
        self.rw.AddRenderer(self.ren)
        self.w2i = vtk.vtkWindowToImageFilter()
        self.w2i.SetInput(self.rw)
        self.w2i.ReadFrontBufferOff()

        self._photo = None
        self._last = None
        self._has_data = False
        self.label.bind("<ButtonPress-1>", self._press)
        self.label.bind("<B1-Motion>", self._drag)
        self.label.bind("<MouseWheel>", self._wheel)
        self.bind("<Configure>", lambda e: self._render())

    def _add_box(self, x, y, z, dx, dy, dz, color, edges):
        src = vtk.vtkCubeSource(); src.SetBounds(x, x + dx, y, y + dy, z, z + dz)
        m = vtk.vtkPolyDataMapper(); m.SetInputConnection(src.GetOutputPort())
        a = vtk.vtkActor(); a.SetMapper(m)
        p = a.GetProperty()
        p.SetColor(float(color[0]), float(color[1]), float(color[2]))
        p.SetAmbient(0.45); p.SetDiffuse(0.72); p.SetSpecular(0.0)
        if edges:
            p.EdgeVisibilityOn(); p.SetEdgeColor(0.05, 0.07, 0.10); p.SetLineWidth(1)
        self.ren.AddActor(a)

    def set_result(self, result):
        self.ren.RemoveAllViewProps()
        self._has_data = False
        if result:
            P = result.config.pallet
            self._add_box(0, 0, 0, P.length, P.width, P.deck_height, (0.42, 0.325, 0.19), True)
            n = len(result.layers)
            edges = result.total_boxes <= 400
            for layer in result.layers:
                col = layer_color(layer.index, n)
                for (x, y, w, h) in layer.rects:
                    self._add_box(x, y, layer.z_start, w, h, layer.dim_z, col, edges)
            self._has_data = True
        self._reset_camera()
        self._render()

    def _reset_camera(self):
        cam = self.ren.GetActiveCamera()
        cam.SetViewUp(0, 0, 1)
        cam.SetPosition(1, 1, 1); cam.SetFocalPoint(0, 0, 0)
        self.ren.ResetCamera()
        cam.Azimuth(-50); cam.Elevation(18); cam.OrthogonalizeViewUp()
        self.ren.ResetCameraClippingRange()

    def reset(self):
        self._reset_camera(); self._render()

    def _render(self):
        w, h = self.winfo_width(), self.winfo_height()
        if w < 10 or h < 10 or not self._has_data:
            return
        self.rw.SetSize(w, h)
        self.rw.Render()
        self.w2i.Modified(); self.w2i.Update()
        img = self.w2i.GetOutput()
        dx, dy, _ = img.GetDimensions()
        if dx == 0 or dy == 0:
            return
        arr = vtk_to_numpy(img.GetPointData().GetScalars()).reshape(dy, dx, -1)
        arr = np.ascontiguousarray(arr[::-1, :, :3])      # VTK is bottom-up
        self._photo = ImageTk.PhotoImage(Image.fromarray(arr))
        self.label.config(image=self._photo)

    def _press(self, e):
        self._last = (e.x, e.y)

    def _drag(self, e):
        if self._last is None:
            self._last = (e.x, e.y); return
        dx, dy = e.x - self._last[0], e.y - self._last[1]
        self._last = (e.x, e.y)
        cam = self.ren.GetActiveCamera()
        cam.Azimuth(-dx * 0.4); cam.Elevation(dy * 0.4); cam.OrthogonalizeViewUp()
        self.ren.ResetCameraClippingRange(); self._render()

    def _wheel(self, e):
        self.ren.GetActiveCamera().Dolly(1.1 if e.delta > 0 else 0.9)
        self.ren.ResetCameraClippingRange(); self._render()


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Pallet Stacking Studio")
        self.geometry("1300x820")
        self.minsize(1040, 620)
        self.configure(bg=BG)

        self.vars = {}
        self.variants = []
        self.variant_index = 0
        self.result = None
        self.options_win = None
        self.history_win = None

        self._init_style()
        self._build_toolbar()
        self._build_body()
        history.init_db()

        self._apply_dict(EXAMPLE)
        self.compute(record=False)

    # ---- styling ----
    def _init_style(self):
        st = ttk.Style(self)
        try:
            st.theme_use("clam")
        except tk.TclError:
            pass
        st.configure("TNotebook", background=BG, borderwidth=0)
        st.configure("TNotebook.Tab", background=PANEL, foreground=MUTED, padding=(16, 7),
                     borderwidth=0)
        st.map("TNotebook.Tab", background=[("selected", ACCENT)],
               foreground=[("selected", "#06182c")])
        st.configure("Treeview", background=PANEL2, fieldbackground=PANEL2, foreground=TEXT,
                     rowheight=22, borderwidth=0)
        st.configure("Treeview.Heading", background=PANEL, foreground=MUTED, borderwidth=0)
        st.map("Treeview", background=[("selected", ACCENT)], foreground=[("selected", "#06182c")])
        st.configure("TCombobox", fieldbackground=PANEL2, background=PANEL2, foreground=TEXT,
                     arrowcolor=TEXT)
        st.configure("Vertical.TScrollbar", background=PANEL2, troughcolor=BG, borderwidth=0,
                     arrowcolor=MUTED)

    def _btn(self, parent, text, cmd, primary=False, small=False):
        b = tk.Button(parent, text=text, command=cmd, relief="flat", cursor="hand2",
                      bg=(ACCENT if primary else PANEL2), fg=("#06182c" if primary else TEXT),
                      activebackground=(ACCENT if primary else LINE),
                      activeforeground="#06182c" if primary else TEXT,
                      font=("Segoe UI", 9, "bold" if primary else "normal"),
                      padx=(8 if small else 12), pady=(3 if small else 6), bd=0,
                      highlightthickness=1, highlightbackground=LINE)
        return b

    # ---- toolbar ----
    def _build_toolbar(self):
        bar = tk.Frame(self, bg=PANEL, height=48)
        bar.pack(side="top", fill="x")
        tk.Label(bar, text="📦  Pallet Stacking Studio", bg=PANEL, fg=TEXT,
                 font=("Segoe UI", 12, "bold")).pack(side="left", padx=12)
        self._btn(bar, "⤓ Load JSON", self.load_json).pack(side="left", padx=3, pady=7)
        self._btn(bar, "⤒ Save JSON", self.save_json).pack(side="left", padx=3)
        self._btn(bar, "▶ Compute", lambda: self.compute(), primary=True).pack(side="left", padx=3)

        # right-hand compact buttons
        self._btn(bar, "🕘 History", self.open_history, small=True).pack(side="right", padx=(3, 12), pady=7)
        self._btn(bar, "⚙ Options", self.open_options, small=True).pack(side="right", padx=3)
        self._btn(bar, "PDF", self.export_pdf_dialog, small=True).pack(side="right", padx=3)
        self._btn(bar, "Excel", self.export_excel_dialog, small=True).pack(side="right", padx=3)
        self._btn(bar, "💡 Recommendations", self.open_recs, small=True).pack(side="right", padx=3)

    # ---- body ----
    def _build_body(self):
        body = tk.Frame(self, bg=BG)
        body.pack(side="top", fill="both", expand=True)

        # --- left: scrollable form ---
        left = tk.Frame(body, bg=PANEL, width=330)
        left.pack(side="left", fill="y")
        left.pack_propagate(False)
        canvas = tk.Canvas(left, bg=PANEL, highlightthickness=0)
        vsb = ttk.Scrollbar(left, orient="vertical", command=canvas.yview)
        form = tk.Frame(canvas, bg=PANEL)
        form.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=form, anchor="nw", width=312)
        canvas.configure(yscrollcommand=vsb.set)
        canvas.pack(side="left", fill="both", expand=True, padx=(8, 0), pady=8)
        vsb.pack(side="right", fill="y")
        # only scroll the form while the cursor is over the sidebar, so the
        # mouse wheel still zooms the 3D view elsewhere
        def _wheel(e):
            canvas.yview_scroll(int(-e.delta / 120), "units")
        canvas.bind("<Enter>", lambda e: canvas.bind_all("<MouseWheel>", _wheel))
        canvas.bind("<Leave>", lambda e: canvas.unbind_all("<MouseWheel>"))
        self._build_form(form)

        # --- right: results ---
        right = tk.Frame(body, bg=BG)
        right.pack(side="left", fill="both", expand=True)

        self.stats = tk.Frame(right, bg=PANEL)
        self.stats.pack(side="top", fill="x")
        self.stat_labels = {}
        for key in ["Boxes", "Layers", "Per layer", "Footprint", "Volume", "Height",
                    "Gross", "Capacity", "Limiting"]:
            cell = tk.Frame(self.stats, bg=CHIP, padx=10, pady=6)
            cell.pack(side="left", padx=5, pady=8)
            tk.Label(cell, text=key, bg=CHIP, fg=MUTED, font=("Segoe UI", 8)).pack(anchor="w")
            v = tk.Label(cell, text="-", bg=CHIP, fg=TEXT, font=("Segoe UI", 12, "bold"))
            v.pack(anchor="w")
            self.stat_labels[key] = v

        self.variant_lbl = tk.Label(right, text="", bg=BG, fg=ACCENT,
                                    font=("Segoe UI", 10, "bold"), anchor="w")
        self.variant_lbl.pack(side="top", fill="x", padx=12, pady=(6, 0))
        self.variant_desc = tk.Label(right, text="", bg=BG, fg=MUTED, font=("Segoe UI", 9),
                                    anchor="w", justify="left", wraplength=900)
        self.variant_desc.pack(side="top", fill="x", padx=12)

        nb = ttk.Notebook(right)
        nb.pack(side="top", fill="both", expand=True, padx=8, pady=8)

        # 3D tab (custom depth-correct Canvas renderer)
        tab3d = tk.Frame(nb, bg=BG); nb.add(tab3d, text="3D")
        ctl3d = tk.Frame(tab3d, bg=BG); ctl3d.pack(side="bottom", fill="x")
        engine = "VTK (z-buffered)" if HAVE_VTK else "built-in"
        tk.Label(ctl3d, text=f"drag to rotate · scroll to zoom · engine: {engine}", bg=BG,
                 fg=MUTED, font=("Segoe UI", 8)).pack(side="left", padx=10, pady=2)
        self._btn(ctl3d, "Reset view", self._reset_3d, small=True).pack(side="right", padx=8, pady=3)
        try:
            self.view3d = VTKView(tab3d)
        except Exception as ex:
            print("3D: VTK unavailable, using built-in renderer:", ex)
            self.view3d = Canvas3D(tab3d)
        self.view3d.pack(fill="both", expand=True)

        # Top tab
        tabtop = tk.Frame(nb, bg=BG); nb.add(tabtop, text="Top")
        toptop = tk.Frame(tabtop, bg=BG); toptop.pack(side="top", fill="x")
        tk.Label(toptop, text="Layer:", bg=BG, fg=MUTED).pack(side="left", padx=(10, 4), pady=4)
        self.top_layer = ttk.Combobox(toptop, state="readonly", width=22)
        self.top_layer.pack(side="left", pady=4)
        self.top_layer.bind("<<ComboboxSelected>>", lambda e: self._render_top())
        self.figtop = Figure(figsize=(6, 5), facecolor=BG)
        self.axtop = self.figtop.add_subplot(111)
        self.canvastop = FigureCanvasTkAgg(self.figtop, master=tabtop)
        self.canvastop.get_tk_widget().pack(fill="both", expand=True)

        # Side tab
        tabside = tk.Frame(nb, bg=BG); nb.add(tabside, text="Side")
        sidetop = tk.Frame(tabside, bg=BG); sidetop.pack(side="top", fill="x")
        tk.Label(sidetop, text="Elevation:", bg=BG, fg=MUTED).pack(side="left", padx=(10, 4), pady=4)
        self.side_axis = ttk.Combobox(sidetop, state="readonly", width=22,
                                      values=["Front (along length)", "Side (along width)"])
        self.side_axis.current(0)
        self.side_axis.pack(side="left", pady=4)
        self.side_axis.bind("<<ComboboxSelected>>", lambda e: self._render_side())
        self.figside = Figure(figsize=(6, 5), facecolor=BG)
        self.axside = self.figside.add_subplot(111)
        self.canvasside = FigureCanvasTkAgg(self.figside, master=tabside)
        self.canvasside.get_tk_widget().pack(fill="both", expand=True)

        # Table tab
        tabtbl = tk.Frame(nb, bg=BG); nb.add(tabtbl, text="Table")
        cols = ("#", "Layer", "X", "Y", "Z", "DimX", "DimY", "DimZ", "Orientation", "kg")
        self.tree = ttk.Treeview(tabtbl, columns=cols, show="headings")
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=70, anchor="e")
        self.tree.column("Orientation", width=140, anchor="w")
        tvsb = ttk.Scrollbar(tabtbl, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=tvsb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        tvsb.pack(side="right", fill="y")

    # ---- form ----
    def _section(self, parent, title):
        tk.Label(parent, text=title.upper(), bg=PANEL, fg=MUTED,
                 font=("Segoe UI", 8, "bold")).pack(anchor="w", pady=(12, 4), padx=2)
        f = tk.Frame(parent, bg=PANEL2, highlightthickness=1, highlightbackground=LINE)
        f.pack(fill="x", padx=2)
        inner = tk.Frame(f, bg=PANEL2); inner.pack(fill="x", padx=8, pady=8)
        return inner

    def _entry(self, parent, label, key, default):
        row = tk.Frame(parent, bg=PANEL2); row.pack(fill="x", pady=2)
        tk.Label(row, text=label, bg=PANEL2, fg=MUTED, font=("Segoe UI", 8),
                 width=18, anchor="w").pack(side="left")
        var = tk.StringVar(value=str(default))
        self.vars[key] = var
        e = tk.Entry(row, textvariable=var, bg="#0e151e", fg=TEXT, insertbackground=TEXT,
                     relief="flat", highlightthickness=1, highlightbackground=LINE, width=12)
        e.pack(side="right", fill="x", expand=True)

    def _check(self, parent, label, key, default):
        var = tk.BooleanVar(value=default)
        self.vars[key] = var
        c = tk.Checkbutton(parent, text=label, variable=var, bg=PANEL2, fg=TEXT,
                           selectcolor=PANEL, activebackground=PANEL2, activeforeground=TEXT,
                           font=("Segoe UI", 9), anchor="w", highlightthickness=0)
        c.pack(fill="x", anchor="w", pady=1)

    def _build_form(self, parent):
        s = self._section(parent, "Box (carton)")
        self._entry(s, "Name", "box.name", "Carton A")
        self._entry(s, "Length L (mm)", "box.length", 400)
        self._entry(s, "Width W (mm)", "box.width", 300)
        self._entry(s, "Height H (mm)", "box.height", 250)
        self._entry(s, "Gross weight (kg)", "box.weight", 8.5)

        s = self._section(parent, "Pallet")
        self._entry(s, "Name", "pallet.name", "EUR pallet")
        self._entry(s, "Length (mm)", "pallet.length", 1200)
        self._entry(s, "Width (mm)", "pallet.width", 800)
        self._entry(s, "Deck height (mm)", "pallet.deck_height", 150)
        self._entry(s, "Load capacity (kg)", "pallet.load_capacity", 700)

        s = self._section(parent, "Limits")
        self._entry(s, "Max height (mm)", "max_stack_height", 1800)

        s = self._section(parent, "Acceptable orientations")
        self._check(s, "Rotate footprint 90° (Z)", "rot_z", True)
        self._check(s, "Tip onto side face (X)", "rot_x", False)
        self._check(s, "Tip onto end face (Y)", "rot_y", False)

        s = self._section(parent, "Additional elements (optional)")
        self._check(s, "Enable additional elements", "add.enabled", False)
        self._check(s, "Spacer sheets between layers", "add.use_spacers", True)
        self._entry(s, "Spacer thick. (mm)", "add.spacer_thickness_mm", 5)
        self._entry(s, "Spacer weight (kg)", "add.spacer_weight_kg", 0.3)
        self._check(s, "Corner posts", "add.use_corner_posts", False)
        self._entry(s, "Corner posts wt (kg)", "add.corner_post_weight_kg", 0)
        self._check(s, "Stretch film", "add.use_film", True)
        self._entry(s, "Film weight (kg)", "add.film_weight_kg", 1.2)

        self._btn(parent, "▶ Compute", lambda: self.compute(), primary=True).pack(
            fill="x", padx=2, pady=(14, 4))
        self._btn(parent, "Reset example", lambda: (self._apply_dict(EXAMPLE), self.compute())).pack(
            fill="x", padx=2)

    # ---- form <-> dict ----
    def _fnum(self, key):
        try:
            return float(self.vars[key].get())
        except (ValueError, KeyError):
            return 0.0

    def _to_dict(self):
        return {
            "box": {"name": self.vars["box.name"].get() or "Box",
                    "length": self._fnum("box.length"), "width": self._fnum("box.width"),
                    "height": self._fnum("box.height"), "weight": self._fnum("box.weight")},
            "pallet": {"name": self.vars["pallet.name"].get() or "Pallet",
                       "length": self._fnum("pallet.length"), "width": self._fnum("pallet.width"),
                       "deck_height": self._fnum("pallet.deck_height"),
                       "load_capacity": self._fnum("pallet.load_capacity")},
            "max_stack_height": self._fnum("max_stack_height"),
            "orientation_flags": {"allow_rotate_x": self.vars["rot_x"].get(),
                                  "allow_rotate_y": self.vars["rot_y"].get(),
                                  "allow_rotate_z": self.vars["rot_z"].get()},
            "additional_elements": {
                "enabled": self.vars["add.enabled"].get(),
                "use_spacers": self.vars["add.use_spacers"].get(),
                "spacer_thickness_mm": self._fnum("add.spacer_thickness_mm"),
                "spacer_weight_kg": self._fnum("add.spacer_weight_kg"),
                "use_corner_posts": self.vars["add.use_corner_posts"].get(),
                "corner_post_weight_kg": self._fnum("add.corner_post_weight_kg"),
                "use_film": self.vars["add.use_film"].get(),
                "film_weight_kg": self._fnum("add.film_weight_kg")},
        }

    def _apply_dict(self, d):
        b = d.get("box", {}); p = d.get("pallet", {})
        o = d.get("orientation_flags", {})
        a = d.get("additional_elements", d.get("additional", {})) or {}
        setters = {
            "box.name": b.get("name"), "box.length": b.get("length"), "box.width": b.get("width"),
            "box.height": b.get("height"), "box.weight": b.get("weight"),
            "pallet.name": p.get("name"), "pallet.length": p.get("length"),
            "pallet.width": p.get("width"), "pallet.deck_height": p.get("deck_height"),
            "pallet.load_capacity": p.get("load_capacity"),
            "max_stack_height": d.get("max_stack_height"),
            "add.spacer_thickness_mm": a.get("spacer_thickness_mm"),
            "add.spacer_weight_kg": a.get("spacer_weight_kg"),
            "add.corner_post_weight_kg": a.get("corner_post_weight_kg"),
            "add.film_weight_kg": a.get("film_weight_kg"),
        }
        for k, v in setters.items():
            if v is not None and k in self.vars:
                self.vars[k].set(str(v))
        self.vars["rot_x"].set(bool(o.get("allow_rotate_x", False)))
        self.vars["rot_y"].set(bool(o.get("allow_rotate_y", False)))
        self.vars["rot_z"].set(bool(o.get("allow_rotate_z", True)))
        self.vars["add.enabled"].set(bool(a.get("enabled", False)))
        self.vars["add.use_spacers"].set(bool(a.get("use_spacers", False)))
        self.vars["add.use_corner_posts"].set(bool(a.get("use_corner_posts", a.get("use_corner", False))))
        self.vars["add.use_film"].set(bool(a.get("use_film", False)))

    # ---- compute / render ----
    def compute(self, record=True):
        d = self._to_dict()
        try:
            config = config_from_dict(d)
            if config.box.length <= 0 or config.box.width <= 0 or config.box.height <= 0:
                raise ValueError("Box dimensions must be greater than 0.")
            if config.pallet.length <= 0 or config.pallet.width <= 0:
                raise ValueError("Pallet dimensions must be greater than 0.")
            if config.max_stack_height <= config.pallet.deck_height:
                raise ValueError("Max stack height must exceed the deck height.")
            self.variants = generate_variants(config)
        except Exception as e:
            messagebox.showerror("Invalid input", str(e))
            return
        self.variant_index = 0
        self.result = self.variants[0]["result"]
        self._render_all()

        if record:
            r = self.result
            summary = {"total_boxes": r.total_boxes, "layers": len(r.layers),
                       "fill_pct": r.volume_fill_pct, "height_mm": r.total_height,
                       "weight_kg": r.total_weight}
            try:
                history.save_query(d, summary, variant=self.variants[0]["name"])
            except Exception as e:
                print("history save failed:", e)
        if self.options_win and tk.Toplevel.winfo_exists(self.options_win):
            self._populate_options()

    def select_variant(self, idx):
        if 0 <= idx < len(self.variants):
            self.variant_index = idx
            self.result = self.variants[idx]["result"]
            self._render_all()

    def _render_all(self):
        v = self.variants[self.variant_index]
        r = self.result
        self.variant_lbl.config(
            text=f"Arrangement {self.variant_index + 1}/{len(self.variants)}:  {v['name']}")
        self.variant_desc.config(text=v["description"])
        per = ", ".join(str(len(l.rects)) for l in r.layers) or "0"
        vals = {
            "Boxes": str(r.total_boxes),
            "Layers": str(len(r.layers)),
            "Per layer": (str(len(r.layers[0].rects)) if r.layers else "0"),
            "Footprint": f"{r.footprint_fill_pct:.0f}%",
            "Volume": f"{r.volume_fill_pct:.0f}%",
            "Height": f"{r.total_height:.0f}",
            "Gross": f"{r.total_weight + r.additional_weight:.0f}",
            "Capacity": f"{r.weight_utilization_pct:.0f}%",
            "Limiting": self._limit_label(r),
        }
        for k, val in vals.items():
            self.stat_labels[k].config(text=val)

        # top-layer selector
        names = [f"Layer {i + 1} ({len(l.rects)})" for i, l in enumerate(r.layers)]
        self.top_layer["values"] = names
        if names:
            self.top_layer.current(len(names) - 1)
        self._render_3d(); self._render_top(); self._render_side(); self._fill_table()

    def _limit_label(self, r):
        h_head = r.config.max_stack_height - r.total_height
        w_head = r.config.pallet.load_capacity - r.total_weight
        avg = (sum(l.dim_z for l in r.layers) / len(r.layers)) if r.layers else 0
        if not r.layers:
            return "none"
        if h_head < avg and w_head >= r.config.box.weight:
            return "height"
        if w_head < r.config.box.weight:
            return "weight"
        return "footprint"

    def _render_3d(self):
        self.view3d.set_result(self.result)

    def _render_top(self):
        idx = self.top_layer.current()
        if idx < 0:
            idx = len(self.result.layers) - 1
        draw_top(self.axtop, self.result, idx)
        self.figtop.tight_layout(); self.canvastop.draw_idle()

    def _render_side(self):
        kind = "length" if self.side_axis.current() == 0 else "width"
        draw_side(self.axside, self.result, kind)
        self.figside.tight_layout(); self.canvasside.draw_idle()

    def _reset_3d(self):
        self.view3d.reset()

    def _fill_table(self):
        self.tree.delete(*self.tree.get_children())
        w = self.result.config.box.weight
        for b in self.result.placed_boxes:
            self.tree.insert("", "end", values=(
                b.box_id, b.layer + 1, round(b.x), round(b.y), round(b.z),
                round(b.dim_x), round(b.dim_y), round(b.dim_z), b.orientation, f"{w:.1f}"))

    # ---- Options popup (variant switcher) ----
    def open_options(self):
        if self.options_win and tk.Toplevel.winfo_exists(self.options_win):
            self.options_win.lift(); return
        win = tk.Toplevel(self); win.title("Arrangement options")
        win.configure(bg=BG); win.geometry("440x460")
        self.options_win = win
        tk.Label(win, text="Choose a box arrangement", bg=BG, fg=TEXT,
                 font=("Segoe UI", 11, "bold")).pack(anchor="w", padx=12, pady=(12, 2))
        tk.Label(win, text="Switch between the layouts generated for this query.",
                 bg=BG, fg=MUTED, font=("Segoe UI", 9)).pack(anchor="w", padx=12)
        self.opt_holder = tk.Frame(win, bg=BG)
        self.opt_holder.pack(fill="both", expand=True, padx=12, pady=10)
        self._populate_options()

    def _populate_options(self):
        for w in self.opt_holder.winfo_children():
            w.destroy()
        self.opt_var = tk.IntVar(value=self.variant_index)
        for i, v in enumerate(self.variants):
            r = v["result"]
            card = tk.Frame(self.opt_holder, bg=PANEL2, highlightthickness=1,
                            highlightbackground=(ACCENT if i == self.variant_index else LINE))
            card.pack(fill="x", pady=4)
            rb = tk.Radiobutton(card, text=v["name"], variable=self.opt_var, value=i,
                                command=lambda i=i: self._choose_option(i),
                                bg=PANEL2, fg=TEXT, selectcolor=PANEL,
                                activebackground=PANEL2, activeforeground=TEXT,
                                font=("Segoe UI", 10, "bold"), anchor="w")
            rb.pack(fill="x", padx=6, pady=(6, 0))
            tk.Label(card, text=f"{r.total_boxes} boxes · {len(r.layers)} layers · "
                                f"vol fill {r.volume_fill_pct:.0f}% · {r.total_height:.0f} mm",
                     bg=PANEL2, fg=MUTED, font=("Segoe UI", 8)).pack(anchor="w", padx=28, pady=(0, 6))

    def _choose_option(self, i):
        self.select_variant(i)
        self._populate_options()

    # ---- History popup ----
    def open_history(self):
        if self.history_win and tk.Toplevel.winfo_exists(self.history_win):
            self.history_win.lift(); self._reload_history(); return
        win = tk.Toplevel(self); win.title("Query history")
        win.configure(bg=BG); win.geometry("760x440")
        self.history_win = win
        tk.Label(win, text="Query history", bg=BG, fg=TEXT,
                 font=("Segoe UI", 11, "bold")).pack(anchor="w", padx=12, pady=(12, 2))
        tk.Label(win, text="Double-click a row (or select + Open) to reload that query.",
                 bg=BG, fg=MUTED, font=("Segoe UI", 9)).pack(anchor="w", padx=12)
        cols = ("id", "date", "label", "boxes", "layers", "fill", "height", "weight")
        widths = (40, 130, 220, 50, 50, 50, 60, 60)
        tv = ttk.Treeview(win, columns=cols, show="headings")
        for c, w in zip(cols, widths):
            tv.heading(c, text=c)
            tv.column(c, width=w, anchor=("w" if c == "label" else "e"))
        tv.pack(fill="both", expand=True, padx=12, pady=8)
        tv.bind("<Double-1>", lambda e: self._open_selected_history())
        self.history_tree = tv
        btns = tk.Frame(win, bg=BG); btns.pack(fill="x", padx=12, pady=(0, 10))
        self._btn(btns, "Open", self._open_selected_history, primary=True).pack(side="left")
        self._btn(btns, "Delete", self._delete_selected_history).pack(side="left", padx=6)
        self._btn(btns, "Clear all", self._clear_history).pack(side="left")
        self._btn(btns, "Refresh", self._reload_history).pack(side="right")
        self._reload_history()

    def _reload_history(self):
        tv = self.history_tree
        tv.delete(*tv.get_children())
        for row in history.list_queries():
            tv.insert("", "end", iid=str(row["id"]), values=(
                row["id"], row["created_at"], row["label"], row["total_boxes"],
                row["layers"], f"{row['fill_pct']:.0f}%", f"{row['height_mm']:.0f}",
                f"{row['weight_kg']:.0f}"))

    def _open_selected_history(self):
        sel = self.history_tree.selection()
        if not sel:
            return
        cfg = history.get_config(int(sel[0]))
        if cfg:
            self._apply_dict(cfg)
            self.compute(record=False)

    def _delete_selected_history(self):
        sel = self.history_tree.selection()
        if not sel:
            return
        history.delete_query(int(sel[0]))
        self._reload_history()

    def _clear_history(self):
        if messagebox.askyesno("Clear history", "Delete all saved queries?"):
            history.clear_history()
            self._reload_history()

    # ---- recommendations popup ----
    def open_recs(self):
        win = tk.Toplevel(self); win.title("Recommendations")
        win.configure(bg=BG); win.geometry("620x360")
        tk.Label(win, text="Recommendations", bg=BG, fg=TEXT,
                 font=("Segoe UI", 11, "bold")).pack(anchor="w", padx=12, pady=(12, 6))
        txt = tk.Text(win, bg=PANEL2, fg=TEXT, relief="flat", wrap="word",
                      font=("Segoe UI", 10), padx=10, pady=10)
        txt.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        recs = self.result.recommendations if self.result else []
        if not recs:
            txt.insert("end", "No adjustments suggested - the layout looks efficient.")
        else:
            for i, r in enumerate(recs, 1):
                txt.insert("end", f"{i}. {r}\n\n")
        txt.config(state="disabled")

    # ---- IO ----
    def load_json(self):
        path = filedialog.askopenfilename(filetypes=[("JSON", "*.json")])
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                self._apply_dict(json.load(f))
            self.compute()
        except Exception as e:
            messagebox.showerror("Load failed", str(e))

    def save_json(self):
        path = filedialog.asksaveasfilename(defaultextension=".json",
                                            filetypes=[("JSON", "*.json")],
                                            initialfile="pallet_config.json")
        if not path:
            return
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self._to_dict(), f, indent=2)
        messagebox.showinfo("Saved", f"Configuration saved to:\n{path}")

    def export_excel_dialog(self):
        if not self.result:
            return
        path = filedialog.asksaveasfilename(defaultextension=".xlsx",
                                            filetypes=[("Excel", "*.xlsx")],
                                            initialfile="pallet_report.xlsx")
        if not path:
            return
        try:
            export_excel(self.result, path)
            messagebox.showinfo("Exported", f"Excel report saved to:\n{path}")
        except Exception as e:
            messagebox.showerror("Export failed", str(e))

    def export_pdf_dialog(self):
        if not self.result:
            return
        path = filedialog.asksaveasfilename(defaultextension=".pdf",
                                            filetypes=[("PDF", "*.pdf")],
                                            initialfile="pallet_report.pdf")
        if not path:
            return
        try:
            tmp = tempfile.mkdtemp(prefix="pallet_")
            images = generate_all_visuals(self.result, tmp)
            export_pdf(self.result, images, path)
            messagebox.showinfo("Exported", f"PDF report saved to:\n{path}")
        except Exception as e:
            messagebox.showerror("Export failed", str(e))


def main():
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
