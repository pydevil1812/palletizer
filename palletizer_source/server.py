"""
HTTP API for the React web app: query history + the pallet-stacking
calculations themselves.

`/api/history/*` is a thin wrapper around `palletizer.history` (SQLite-
backed). `/api/compute` runs the same packing/variants engine the desktop
app uses (`palletizer.api`, built on `palletizer.packer`/`variants`) — all
the layout math lives there, not in the browser.

Run from this folder:  python server.py
"""
from __future__ import annotations

import importlib.util
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from palletizer.api import compute_variants

# `palletizer/history.py` only needs the stdlib (json/os/sqlite3/datetime),
# but `import palletizer.history` would run `palletizer/__init__.py` first,
# which pulls in the desktop app's heavy plotting/report deps (matplotlib,
# numpy, pandas, ...). Load the module directly so this lightweight API
# server doesn't need any of that installed.
_history_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "palletizer", "history.py")
_spec = importlib.util.spec_from_file_location("palletizer_history", _history_path)
history = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(history)

app = Flask(__name__)
CORS(app)


def _row_to_dict(row):
    return {k: row[k] for k in row.keys()}


@app.get("/api/history")
def list_history():
    return jsonify([_row_to_dict(r) for r in history.list_queries()])


@app.get("/api/history/<int:query_id>")
def get_history_config(query_id):
    config = history.get_config(query_id)
    if config is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({"config": config})


@app.post("/api/history")
def save_history():
    body = request.get_json(force=True, silent=True) or {}
    config = body.get("config")
    summary = body.get("summary") or {}
    if not config:
        return jsonify({"error": "config is required"}), 400
    new_id = history.save_query(
        config, summary, label=body.get("label"), variant=body.get("variant") or ""
    )
    return jsonify({"id": new_id}), 201


@app.delete("/api/history/<int:query_id>")
def delete_history(query_id):
    history.delete_query(query_id)
    return "", 204


@app.delete("/api/history")
def clear_history():
    history.clear_history()
    return "", 204


@app.post("/api/compute")
def compute():
    data = request.get_json(force=True, silent=True) or {}
    result = compute_variants(data)
    if "errors" in result:
        return jsonify(result), 400
    return jsonify(result)


if __name__ == "__main__":
    history.init_db()
    app.run(port=5000, debug=True)
