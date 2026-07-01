"""
Persistent query history and user management backed by SQLite.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional

_default_db = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "palletizer_history.db")
DB_PATH = os.getenv("DB_PATH") or _default_db


def _connect(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _hash_password(password: str, salt: Optional[str] = None) -> str:
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return f"{salt}:{h}"


def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, _ = stored_hash.split(':', 1)
        return _hash_password(password, salt) == stored_hash
    except Exception:
        return False


def init_db(db_path: str = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role          TEXT DEFAULT 'user',
                created_at    TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS queries (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at  TEXT NOT NULL,
                username    TEXT DEFAULT '',
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
        # Migrate existing queries table if username column is missing
        cols = [row[1] for row in conn.execute("PRAGMA table_info(queries)").fetchall()]
        if 'username' not in cols:
            conn.execute("ALTER TABLE queries ADD COLUMN username TEXT DEFAULT ''")
        # Cache of computed results keyed by a canonical hash of the input
        # parameters, so identical requests are served without recomputing.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS result_cache (
                cache_key   TEXT PRIMARY KEY,
                result_json TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                hits        INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.commit()


# ── User management ───────────────────────────────────────────────────────────

def create_user(username: str, password: str, role: str = 'user',
                db_path: str = DB_PATH) -> Optional[int]:
    """Insert a new user. Returns the new row id, or None if username is taken."""
    init_db(db_path)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with _connect(db_path) as conn:
            cur = conn.execute(
                "INSERT INTO users (username, password_hash, role, created_at) VALUES (?,?,?,?)",
                (username, _hash_password(password), role, now),
            )
            conn.commit()
            return cur.lastrowid
    except sqlite3.IntegrityError:
        return None


def get_user_by_username(username: str, db_path: str = DB_PATH) -> Optional[sqlite3.Row]:
    with _connect(db_path) as conn:
        return conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()


def authenticate_user(username: str, password: str,
                      db_path: str = DB_PATH) -> Optional[Dict]:
    """Return {id, username, role} if credentials are valid, else None."""
    init_db(db_path)
    row = get_user_by_username(username, db_path)
    if row and _verify_password(password, row['password_hash']):
        return {'id': row['id'], 'username': row['username'], 'role': row['role']}
    return None


def list_users(db_path: str = DB_PATH) -> List[sqlite3.Row]:
    init_db(db_path)
    with _connect(db_path) as conn:
        return conn.execute(
            "SELECT id, username, role, created_at FROM users ORDER BY id"
        ).fetchall()


def delete_user(user_id: int, db_path: str = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute("DELETE FROM users WHERE id=?", (user_id,))
        conn.commit()


def update_user_password(user_id: int, new_password: str, db_path: str = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute(
            "UPDATE users SET password_hash=? WHERE id=?",
            (_hash_password(new_password), user_id),
        )
        conn.commit()


def update_user_role(user_id: int, role: str, db_path: str = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute("UPDATE users SET role=? WHERE id=?", (role, user_id))
        conn.commit()


# ── Query history ─────────────────────────────────────────────────────────────

def save_query(config_dict: Dict, summary: Dict,
               label: Optional[str] = None, variant: str = "",
               username: str = "", db_path: str = DB_PATH) -> int:
    """Insert a query row. Returns the new row id."""
    init_db(db_path)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    box = config_dict.get("box", {})
    pallet = config_dict.get("pallet", {})
    if not label:
        label = f"{box.get('name', 'Box')} on {pallet.get('name', 'Pallet')}"
    with _connect(db_path) as conn:
        cur = conn.execute("""
            INSERT INTO queries
              (created_at, username, label, box_name, pallet_name, total_boxes, layers,
               fill_pct, height_mm, weight_kg, variant, config_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            now, username, label, box.get("name", ""), pallet.get("name", ""),
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
            "SELECT * FROM queries ORDER BY id DESC"
        ).fetchall()


def get_config(query_id: int, db_path: str = DB_PATH) -> Optional[Dict]:
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT config_json FROM queries WHERE id=?", (query_id,)
        ).fetchone()
        return json.loads(row["config_json"]) if row else None


def delete_query(query_id: int, db_path: str = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute("DELETE FROM queries WHERE id=?", (query_id,))
        conn.commit()


def clear_history(db_path: str = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute("DELETE FROM queries")
        conn.commit()


# ── Result cache ──────────────────────────────────────────────────────────────

def get_cached_result(cache_key: str, db_path: str = DB_PATH) -> Optional[Dict]:
    """Return the previously computed result for `cache_key`, or None if the
    parameters have not been computed before. Records a cache hit."""
    init_db(db_path)
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT result_json FROM result_cache WHERE cache_key=?", (cache_key,)
        ).fetchone()
        if row is None:
            return None
        conn.execute(
            "UPDATE result_cache SET hits = hits + 1 WHERE cache_key=?", (cache_key,)
        )
        conn.commit()
        return json.loads(row["result_json"])


def save_cached_result(cache_key: str, result: Dict, db_path: str = DB_PATH) -> None:
    """Store (or overwrite) the computed result for `cache_key`."""
    init_db(db_path)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with _connect(db_path) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO result_cache (cache_key, result_json, created_at, hits) "
            "VALUES (?, ?, ?, COALESCE((SELECT hits FROM result_cache WHERE cache_key=?), 0))",
            (cache_key, json.dumps(result), now, cache_key),
        )
        conn.commit()


def clear_result_cache(db_path: str = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute("DELETE FROM result_cache")
        conn.commit()
