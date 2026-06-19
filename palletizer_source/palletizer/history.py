"""
Persistent query history backed by SQLite.

Every time the user computes a layout the input configuration and a short
result summary are appended here, so they can be browsed and re-opened later.
The full configuration is stored as JSON (the same schema as the CLI's
example_input.json), which is what gets reloaded into the form.
"""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional

# Database lives at the palletizer_source/ root (one level above this package)
# so it sits next to the source tree and survives between runs.
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "palletizer_history.db")


def _connect(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS queries (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at  TEXT NOT NULL,
                label       TEXT,
                box_name    TEXT,
                pallet_name TEXT,
                total_boxes INTEGER,
                layers      INTEGER,
                fill_pct    REAL,
                height_mm   REAL,
                weight_kg   REAL,
                variant     TEXT,
                config_json TEXT NOT NULL
            )
        """)
        conn.commit()


def save_query(config_dict: Dict, summary: Dict,
               label: Optional[str] = None, variant: str = "",
               db_path: str = DB_PATH) -> int:
    """Insert a query row. `config_dict` is the CLI-schema config; `summary`
    holds the headline numbers. Returns the new row id."""
    init_db(db_path)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    box = config_dict.get("box", {})
    pallet = config_dict.get("pallet", {})
    if not label:
        label = f"{box.get('name', 'Box')} on {pallet.get('name', 'Pallet')}"
    with _connect(db_path) as conn:
        cur = conn.execute("""
            INSERT INTO queries
              (created_at, label, box_name, pallet_name, total_boxes, layers,
               fill_pct, height_mm, weight_kg, variant, config_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (
            now, label, box.get("name", ""), pallet.get("name", ""),
            int(summary.get("total_boxes", 0)), int(summary.get("layers", 0)),
            float(summary.get("fill_pct", 0.0)), float(summary.get("height_mm", 0.0)),
            float(summary.get("weight_kg", 0.0)), variant,
            json.dumps(config_dict),
        ))
        conn.commit()
        return cur.lastrowid


def list_queries(db_path: str = DB_PATH) -> List[sqlite3.Row]:
    init_db(db_path)
    with _connect(db_path) as conn:
        return conn.execute(
            "SELECT * FROM queries ORDER BY id DESC").fetchall()


def get_config(query_id: int, db_path: str = DB_PATH) -> Optional[Dict]:
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT config_json FROM queries WHERE id=?", (query_id,)).fetchone()
        return json.loads(row["config_json"]) if row else None


def delete_query(query_id: int, db_path: str = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute("DELETE FROM queries WHERE id=?", (query_id,))
        conn.commit()


def clear_history(db_path: str = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute("DELETE FROM queries")
        conn.commit()
