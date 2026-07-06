"""
HTTP API for the React web app: auth, user management, query history +
the pallet-stacking calculations.

Admin credentials are hardcoded below — search for ADMIN_USERNAME / ADMIN_PASSWORD.

Run from this folder:  python server.py
"""
from __future__ import annotations

import importlib.util
import os
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from palletizer.api import apply_names, cache_key, compute_variants

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

API_HOST  = os.getenv("API_HOST",  "127.0.0.1")
API_PORT  = int(os.getenv("API_PORT",  "5000"))
API_DEBUG = os.getenv("API_DEBUG", "true").lower() == "true"

# ── Admin credentials ─────────────────────────────────────────────────────────
# The built-in admin account is NOT stored in the database — it is checked
# directly against these constants.  Change them here and restart the server.
ADMIN_USERNAME = "admin"       # <── administrator login
ADMIN_PASSWORD = "Admin@123"   # <── administrator password
# ─────────────────────────────────────────────────────────────────────────────

# In-memory session store: token → {username, role, expires}
_sessions: dict = {}

_history_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "palletizer", "history.py"
)
_spec = importlib.util.spec_from_file_location("palletizer_history", _history_path)
history = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(history)

app = Flask(__name__)
CORS(app)


def _row_to_dict(row):
    return {k: row[k] for k in row.keys()}


def _cleanup_sessions():
    now = datetime.now(timezone.utc)
    expired = [t for t, s in list(_sessions.items()) if s['expires'] < now]
    for t in expired:
        del _sessions[t]


def _get_current_user():
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None
    token = auth[7:]
    _cleanup_sessions()
    return _sessions.get(token)


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _get_current_user():
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        if user['role'] != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post('/api/auth/login')
def login():
    body = request.get_json(force=True, silent=True) or {}
    username = (body.get('username') or '').strip()
    password = body.get('password') or ''
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        user = {'username': ADMIN_USERNAME, 'role': 'admin'}
    else:
        user = history.authenticate_user(username, password)
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401

    token = secrets.token_hex(32)
    _sessions[token] = {
        'username': user['username'],
        'role': user['role'],
        'expires': datetime.now(timezone.utc) + timedelta(hours=24),
    }
    return jsonify({'token': token, 'username': user['username'], 'role': user['role']})


@app.post('/api/auth/logout')
@require_auth
def logout():
    auth = request.headers.get('Authorization', '')
    token = auth[7:] if auth.startswith('Bearer ') else ''
    _sessions.pop(token, None)
    return '', 204


@app.get('/api/auth/me')
@require_auth
def me():
    user = _get_current_user()
    return jsonify({'username': user['username'], 'role': user['role']})




# ── Admin: users ──────────────────────────────────────────────────────────────

@app.get('/api/admin/users')
@require_admin
def admin_list_users():
    users = [_row_to_dict(r) for r in history.list_users()]
    # Prepend the built-in admin (not stored in DB)
    users.insert(0, {
        'id': 0, 'username': ADMIN_USERNAME, 'role': 'admin',
        'created_at': 'built-in', 'builtin': True,
    })
    return jsonify(users)


@app.post('/api/admin/users')
@require_admin
def admin_create_user():
    body = request.get_json(force=True, silent=True) or {}
    username = (body.get('username') or '').strip()
    password = body.get('password') or ''
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if username == ADMIN_USERNAME:
        return jsonify({'error': 'Username not available'}), 409
    user_id = history.create_user(username, password, role='user')
    if user_id is None:
        return jsonify({'error': 'Username already taken'}), 409
    return jsonify({'id': user_id}), 201


@app.delete('/api/admin/users/<int:user_id>')
@require_admin
def admin_delete_user(user_id):
    if user_id == 0:
        return jsonify({'error': 'Cannot delete the built-in admin'}), 400
    history.delete_user(user_id)
    return '', 204


@app.put('/api/admin/users/<int:user_id>/password')
@require_admin
def admin_update_password(user_id):
    body = request.get_json(force=True, silent=True) or {}
    new_password = body.get('password') or ''
    if len(new_password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    history.update_user_password(user_id, new_password)
    return jsonify({'ok': True})


@app.put('/api/admin/users/<int:user_id>/role')
@require_admin
def admin_update_role(user_id):
    body = request.get_json(force=True, silent=True) or {}
    role = body.get('role') or ''
    if role not in ('user', 'admin'):
        return jsonify({'error': 'Role must be "user" or "admin"'}), 400
    history.update_user_role(user_id, role)
    return jsonify({'ok': True})


# ── Admin: history ────────────────────────────────────────────────────────────

@app.get('/api/admin/history')
@require_admin
def admin_list_history():
    return jsonify([_row_to_dict(r) for r in history.list_queries()])


@app.delete('/api/admin/history/<int:query_id>')
@require_admin
def admin_delete_history_entry(query_id):
    history.delete_query(query_id)
    return '', 204


@app.delete('/api/admin/history')
@require_admin
def admin_clear_history():
    history.clear_history()
    return '', 204


# ── Admin: result cache ───────────────────────────────────────────────────────

@app.delete('/api/admin/cache')
@require_admin
def admin_clear_cache():
    """Drop all cached compute results (e.g. after an algorithm change)."""
    history.clear_result_cache()
    return '', 204


# ── Catalogs: read for any user, modify for admins only ──────────────────────

def _parse_pallet_body(body):
    """Validate a pallet payload; returns (fields, error)."""
    name = (body.get('name') or '').strip()
    if not name:
        return None, 'Name is required'
    try:
        length = float(body.get('length'))
        width = float(body.get('width'))
        deck_height = float(body.get('deck_height', 145))
        load_capacity = float(body.get('load_capacity', 1500))
    except (TypeError, ValueError):
        return None, 'length/width/deck_height/load_capacity must be numbers'
    if length <= 0 or width <= 0 or deck_height < 0 or load_capacity <= 0:
        return None, 'Dimensions must be positive'
    return (name, length, width, deck_height, load_capacity), None


def _parse_box_body(body):
    """Validate a box payload; returns (fields, error)."""
    name = (body.get('name') or '').strip()
    if not name:
        return None, 'Name is required'
    sku = (body.get('sku') or '').strip()
    try:
        length = float(body.get('length'))
        width = float(body.get('width'))
        height = float(body.get('height'))
        weight = float(body.get('weight', 0))
    except (TypeError, ValueError):
        return None, 'length/width/height/weight must be numbers'
    if length <= 0 or width <= 0 or height <= 0 or weight < 0:
        return None, 'Dimensions must be positive'
    return (sku, name, length, width, height, weight), None


@app.get('/api/catalog/pallets')
@require_auth
def catalog_list_pallets():
    return jsonify([_row_to_dict(r) for r in history.list_catalog_pallets()])


@app.post('/api/admin/catalog/pallets')
@require_admin
def catalog_create_pallet():
    body = request.get_json(force=True, silent=True) or {}
    fields, err = _parse_pallet_body(body)
    if err:
        return jsonify({'error': err}), 400
    new_id = history.create_catalog_pallet(*fields)
    if new_id is None:
        return jsonify({'error': 'A pallet with this name already exists'}), 409
    return jsonify({'id': new_id}), 201


@app.put('/api/admin/catalog/pallets/<int:pallet_id>')
@require_admin
def catalog_update_pallet(pallet_id):
    body = request.get_json(force=True, silent=True) or {}
    fields, err = _parse_pallet_body(body)
    if err:
        return jsonify({'error': err}), 400
    if not history.update_catalog_pallet(pallet_id, *fields):
        return jsonify({'error': 'A pallet with this name already exists'}), 409
    return jsonify({'ok': True})


@app.delete('/api/admin/catalog/pallets/<int:pallet_id>')
@require_admin
def catalog_delete_pallet(pallet_id):
    history.delete_catalog_pallet(pallet_id)
    return '', 204


@app.post('/api/admin/catalog/pallets/import')
@require_admin
def catalog_import_pallets():
    body = request.get_json(force=True, silent=True) or {}
    rows, err = _validated_import_rows(body, _parse_pallet_body,
                                       ('name', 'length', 'width', 'deck_height', 'load_capacity'))
    if err:
        return jsonify({'error': err}), 400
    count = history.import_catalog_pallets(rows, replace=bool(body.get('replace')))
    return jsonify({'imported': count})


@app.get('/api/catalog/boxes')
@require_auth
def catalog_list_boxes():
    return jsonify([_row_to_dict(r) for r in history.list_catalog_boxes()])


@app.post('/api/admin/catalog/boxes')
@require_admin
def catalog_create_box():
    body = request.get_json(force=True, silent=True) or {}
    fields, err = _parse_box_body(body)
    if err:
        return jsonify({'error': err}), 400
    return jsonify({'id': history.create_catalog_box(*fields)}), 201


@app.put('/api/admin/catalog/boxes/<int:box_id>')
@require_admin
def catalog_update_box(box_id):
    body = request.get_json(force=True, silent=True) or {}
    fields, err = _parse_box_body(body)
    if err:
        return jsonify({'error': err}), 400
    history.update_catalog_box(box_id, *fields)
    return jsonify({'ok': True})


@app.delete('/api/admin/catalog/boxes/<int:box_id>')
@require_admin
def catalog_delete_box(box_id):
    history.delete_catalog_box(box_id)
    return '', 204


@app.post('/api/admin/catalog/boxes/import')
@require_admin
def catalog_import_boxes():
    body = request.get_json(force=True, silent=True) or {}
    rows, err = _validated_import_rows(body, _parse_box_body,
                                       ('sku', 'name', 'length', 'width', 'height', 'weight'))
    if err:
        return jsonify({'error': err}), 400
    count = history.import_catalog_boxes(rows, replace=bool(body.get('replace')))
    return jsonify({'imported': count})


def _validated_import_rows(body, parser, keys):
    """Validate body['rows'] with `parser`; returns (normalized_rows, error)."""
    raw = body.get('rows')
    if not isinstance(raw, list) or not raw:
        return None, 'rows must be a non-empty list'
    rows = []
    for i, r in enumerate(raw):
        if not isinstance(r, dict):
            return None, f'Row {i + 1}: expected an object'
        fields, err = parser(r)
        if err:
            return None, f'Row {i + 1}: {err}'
        rows.append(dict(zip(keys, fields)))
    return rows, None


# ── Configuration templates ───────────────────────────────────────────────────

@app.get('/api/catalog/templates')
@require_auth
def catalog_list_templates():
    return jsonify([_row_to_dict(r) for r in history.list_templates()])


@app.get('/api/catalog/templates/<int:template_id>')
@require_auth
def catalog_get_template(template_id):
    config = history.get_template_config(template_id)
    if config is None:
        return jsonify({'error': 'not found'}), 404
    return jsonify({'config': config})


@app.post('/api/admin/catalog/templates')
@require_admin
def catalog_create_template():
    body = request.get_json(force=True, silent=True) or {}
    name = (body.get('name') or '').strip()
    config = body.get('config')
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if not isinstance(config, dict) or not config:
        return jsonify({'error': 'config is required'}), 400
    return jsonify({'id': history.create_template(name, config)}), 201


@app.delete('/api/admin/catalog/templates/<int:template_id>')
@require_admin
def catalog_delete_template(template_id):
    history.delete_template(template_id)
    return '', 204


# ── History (auth required) ───────────────────────────────────────────────────

@app.get('/api/history')
@require_auth
def list_history():
    return jsonify([_row_to_dict(r) for r in history.list_queries()])


@app.get('/api/history/<int:query_id>')
@require_auth
def get_history_config(query_id):
    config = history.get_config(query_id)
    if config is None:
        return jsonify({'error': 'not found'}), 404
    return jsonify({'config': config})


@app.post('/api/history')
@require_auth
def save_history():
    user = _get_current_user()
    body = request.get_json(force=True, silent=True) or {}
    config = body.get('config')
    summary = body.get('summary') or {}
    if not config:
        return jsonify({'error': 'config is required'}), 400
    new_id = history.save_query(
        config, summary,
        label=body.get('label'),
        variant=body.get('variant') or '',
        username=user['username'],
    )
    return jsonify({'id': new_id}), 201


@app.delete('/api/history/<int:query_id>')
@require_admin
def delete_history(query_id):
    history.delete_query(query_id)
    return '', 204


@app.delete('/api/history')
@require_admin
def clear_history():
    history.clear_history()
    return '', 204


# ── Compute (auth required) ───────────────────────────────────────────────────

@app.post('/api/compute')
@require_auth
def compute():
    data = request.get_json(force=True, silent=True) or {}

    # Serve a previously computed result for identical parameters instead of
    # recalculating (see palletizer.history result_cache).
    key = cache_key(data)
    cached = history.get_cached_result(key)
    if cached is not None:
        apply_names(cached, data)  # names aren't part of the key
        cached['cached'] = True
        return jsonify(cached)

    result = compute_variants(data)
    if 'errors' in result:
        return jsonify(result), 400

    history.save_cached_result(key, result)
    result['cached'] = False
    return jsonify(result)


if __name__ == '__main__':
    history.init_db()
    app.run(host=API_HOST, port=API_PORT, debug=API_DEBUG)
