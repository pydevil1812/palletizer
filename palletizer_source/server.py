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
from datetime import datetime, timedelta
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from palletizer.api import compute_variants

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
    now = datetime.utcnow()
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
        'expires': datetime.utcnow() + timedelta(hours=24),
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


@app.post('/api/auth/register')
def register():
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
@require_auth
def delete_history(query_id):
    history.delete_query(query_id)
    return '', 204


@app.delete('/api/history')
@require_auth
def clear_history():
    history.clear_history()
    return '', 204


# ── Compute (auth required) ───────────────────────────────────────────────────

@app.post('/api/compute')
@require_auth
def compute():
    data = request.get_json(force=True, silent=True) or {}
    result = compute_variants(data)
    if 'errors' in result:
        return jsonify(result), 400
    return jsonify(result)


if __name__ == '__main__':
    history.init_db()
    app.run(host=API_HOST, port=API_PORT, debug=API_DEBUG)
