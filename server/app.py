import json
import os
import sqlite3
import secrets
from datetime import datetime, timedelta
from pathlib import Path

from flask import Flask, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

# The AI packages are optional: without them the app still runs, just without the AI features.
try:
    from dotenv import load_dotenv

    # Loads ANTHROPIC_API_KEY from server/.env before the AI code needs it.
    load_dotenv(Path(__file__).with_name(".env"))
    import ai
except ImportError:
    ai = None

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # biggest upload allowed: 20 MB
CORS(app)

DUE_FORMAT = "%Y-%m-%dT%H:%M"
DEVICE_ONLINE_SECONDS = 30
# Devices only ring for tasks that came due recently, so a new ESP32 doesn't
# go off for something that was due last week.
REMIND_WINDOW = timedelta(hours=12)


def getdb():
    conn = sqlite3.connect("app.db")
    conn.row_factory = sqlite3.Row
    return conn


def initdb():
    with getdb() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                token TEXT
            )
        """)
        # One row per signed-in browser, so a phone, laptop and the kiosk can all stay signed in.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL
            )
        """)
        # Keep anyone who signed in before sessions existed signed in.
        conn.execute("""
            INSERT OR IGNORE INTO sessions (token, user_id)
            SELECT token, id FROM users WHERE token IS NOT NULL
        """)
        # due_at is local time as "YYYY-MM-DDTHH:MM" (what the React date picker sends).
        # device_id is which ESP32 should remind; NULL means all of them.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                due_at TEXT,
                done INTEGER NOT NULL DEFAULT 0,
                device_id INTEGER
            )
        """)
        todo_columns = [row["name"] for row in conn.execute("PRAGMA table_info(todos)")]
        if "device_id" not in todo_columns:
            conn.execute("ALTER TABLE todos ADD COLUMN device_id INTEGER")
        # ESP32 reminder devices. Each one signs in with its own key instead of a password.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                key TEXT UNIQUE NOT NULL,
                last_seen TEXT,
                test_requested INTEGER NOT NULL DEFAULT 0
            )
        """)
        # A row here means that device has finished ringing for that task.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS device_reminders (
                device_id INTEGER NOT NULL,
                todo_id INTEGER NOT NULL,
                PRIMARY KEY (device_id, todo_id)
            )
        """)
        # Files the user uploaded. The file itself lives in Anthropic's Files API (file_id);
        # suggestions is a JSON list of tasks Claude found in it.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                media_type TEXT NOT NULL,
                file_id TEXT NOT NULL,
                summary TEXT NOT NULL,
                suggestions TEXT NOT NULL
            )
        """)


def request_token():
    return request.headers.get("Authorization", "").removeprefix("Bearer ").strip()


def current_user():
    """Find the signed-in user from the "Authorization: Bearer <token>" header."""
    token = request_token()
    if not token:
        return None
    with getdb() as conn:
        return conn.execute(
            "SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ?",
            (token,),
        ).fetchone()


def current_device():
    """Find the ESP32 from its "X-Device-Key" header."""
    key = request.headers.get("X-Device-Key", "").strip()
    if not key:
        return None
    with getdb() as conn:
        return conn.execute("SELECT * FROM devices WHERE key = ?", (key,)).fetchone()


def now_text():
    return datetime.now().strftime(DUE_FORMAT)


def todo_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "due_at": row["due_at"],
        "done": bool(row["done"]),
        "device_id": row["device_id"],
    }


def device_dict(row):
    online = False
    if row["last_seen"]:
        seen = datetime.fromisoformat(row["last_seen"])
        online = (datetime.now() - seen).total_seconds() < DEVICE_ONLINE_SECONDS
    return {
        "id": row["id"],
        "name": row["name"],
        "key": row["key"],
        "online": online,
        "last_seen": row["last_seen"],
    }


def source_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "media_type": row["media_type"],
        "summary": row["summary"],
        "suggestions": json.loads(row["suggestions"]),
    }


def insert_todo(conn, user_id, title, due_at, device_id=None):
    cursor = conn.execute(
        "INSERT INTO todos (user_id, title, due_at, device_id) VALUES (?, ?, ?, ?)",
        (user_id, title, due_at, device_id),
    )
    return conn.execute("SELECT * FROM todos WHERE id = ?", (cursor.lastrowid,)).fetchone()


def owned_device_id(conn, user, device_id):
    """Return device_id if it belongs to this user, otherwise None (= all devices)."""
    if device_id is None:
        return None
    row = conn.execute(
        "SELECT id FROM devices WHERE id = ? AND user_id = ?", (device_id, user["id"])
    ).fetchone()
    return row["id"] if row else None


NOT_SIGNED_IN = {"error": "Not signed in"}, 401


# ---------- Accounts ----------

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return {"error": "Username and password are required"}, 400

    try:
        with getdb() as conn:
            conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, generate_password_hash(password)),
            )
    except sqlite3.IntegrityError:
        return {"error": "That username is taken."}, 409

    return {"message": "Account created"}, 201

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    with getdb() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()


        if user is None or not check_password_hash(user["password_hash"], password):
            return {"error": "Wrong username or password."}, 401

        token = secrets.token_hex(16)

        conn.execute(
            "INSERT INTO sessions (token, user_id) VALUES (?, ?)",
            (token, user["id"])
        )
        return {"token": token, "username": user["username"]}


@app.route("/api/health")
def health():
    return {"ok": True}


@app.route("/api/me")
def me():
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN
    return {"username": user["username"]}


@app.route("/api/logout", methods=["POST"])
def logout():
    # Only signs out this browser; other devices stay signed in.
    with getdb() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (request_token(),))
    return {"message": "Signed out"}


# ---------- Tasks ----------

@app.route("/api/todos", methods=["GET"])
def list_todos():
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN

    with getdb() as conn:
        rows = conn.execute(
            "SELECT * FROM todos WHERE user_id = ? ORDER BY due_at IS NULL, due_at, id",
            (user["id"],),
        ).fetchall()
    return {"todos": [todo_dict(row) for row in rows]}


@app.route("/api/todos", methods=["POST"])
def create_todo():
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN

    data = request.get_json()
    title = data.get("title", "").strip()
    due_at = data.get("due_at") or None
    if not title:
        return {"error": "Give the task a name"}, 400

    with getdb() as conn:
        device_id = owned_device_id(conn, user, data.get("device_id"))
        row = insert_todo(conn, user["id"], title, due_at, device_id)
    return todo_dict(row), 201


@app.route("/api/todos/<int:todo_id>", methods=["PATCH"])
def update_todo(todo_id):
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN

    data = request.get_json()
    with getdb() as conn:
        todo = conn.execute(
            "SELECT * FROM todos WHERE id = ? AND user_id = ?", (todo_id, user["id"])
        ).fetchone()
        if todo is None:
            return {"error": "Task not found"}, 404

        title = data.get("title", todo["title"]).strip()
        due_at = (data["due_at"] or None) if "due_at" in data else todo["due_at"]
        done = data.get("done", bool(todo["done"]))
        if "device_id" in data:
            device_id = owned_device_id(conn, user, data["device_id"])
        else:
            device_id = todo["device_id"]

        conn.execute(
            "UPDATE todos SET title = ?, due_at = ?, done = ?, device_id = ? WHERE id = ?",
            (title, due_at, int(done), device_id, todo_id),
        )
        # A new due time means the devices should ring again.
        if due_at != todo["due_at"]:
            conn.execute("DELETE FROM device_reminders WHERE todo_id = ?", (todo_id,))
        row = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
    return todo_dict(row)


@app.route("/api/todos/<int:todo_id>", methods=["DELETE"])
def delete_todo(todo_id):
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN

    with getdb() as conn:
        cursor = conn.execute(
            "DELETE FROM todos WHERE id = ? AND user_id = ?", (todo_id, user["id"])
        )
        conn.execute("DELETE FROM device_reminders WHERE todo_id = ?", (todo_id,))
    if cursor.rowcount == 0:
        return {"error": "Task not found"}, 404
    return {"message": "Deleted"}


# ---------- ESP32 devices: managed from the website ----------

@app.route("/api/devices", methods=["GET"])
def list_devices():
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN

    with getdb() as conn:
        rows = conn.execute(
            "SELECT * FROM devices WHERE user_id = ? ORDER BY id", (user["id"],)
        ).fetchall()
    return {"devices": [device_dict(row) for row in rows]}


@app.route("/api/devices", methods=["POST"])
def create_device():
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN

    name = request.get_json().get("name", "").strip()
    if not name:
        return {"error": "Give the device a name, like Kitchen"}, 400

    with getdb() as conn:
        cursor = conn.execute(
            "INSERT INTO devices (user_id, name, key) VALUES (?, ?, ?)",
            (user["id"], name, secrets.token_hex(8)),
        )
        row = conn.execute("SELECT * FROM devices WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return device_dict(row), 201


@app.route("/api/devices/<int:device_id>", methods=["DELETE"])
def delete_device(device_id):
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN

    with getdb() as conn:
        cursor = conn.execute(
            "DELETE FROM devices WHERE id = ? AND user_id = ?", (device_id, user["id"])
        )
        if cursor.rowcount == 0:
            return {"error": "Device not found"}, 404
        conn.execute("DELETE FROM device_reminders WHERE device_id = ?", (device_id,))
        conn.execute("UPDATE todos SET device_id = NULL WHERE device_id = ?", (device_id,))
    return {"message": "Deleted"}


@app.route("/api/devices/<int:device_id>/test", methods=["POST"])
def test_device(device_id):
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN

    with getdb() as conn:
        cursor = conn.execute(
            "UPDATE devices SET test_requested = 1 WHERE id = ? AND user_id = ?",
            (device_id, user["id"]),
        )
    if cursor.rowcount == 0:
        return {"error": "Device not found"}, 404
    return {"message": "The device will beep the next time it checks in"}


# ---------- ESP32 devices: called by the ESP32 itself ----------

@app.route("/api/device/poll")
def device_poll():
    """The ESP32 calls this every few seconds: "anything I should ring for?" """
    device = current_device()
    if device is None:
        return {"error": "Unknown device key"}, 401

    now = datetime.now()
    with getdb() as conn:
        conn.execute(
            "UPDATE devices SET last_seen = ?, test_requested = 0 WHERE id = ?",
            (now.isoformat(timespec="seconds"), device["id"]),
        )
        rows = conn.execute(
            """
            SELECT * FROM todos
            WHERE user_id = ? AND done = 0 AND due_at IS NOT NULL
              AND due_at <= ? AND due_at >= ?
              AND (device_id IS NULL OR device_id = ?)
              AND id NOT IN (SELECT todo_id FROM device_reminders WHERE device_id = ?)
            ORDER BY due_at
            """,
            (
                device["user_id"],
                now.strftime(DUE_FORMAT),
                (now - REMIND_WINDOW).strftime(DUE_FORMAT),
                device["id"],
                device["id"],
            ),
        ).fetchall()
    return {
        "name": device["name"],
        "test": bool(device["test_requested"]),
        "reminders": [{"id": row["id"], "title": row["title"], "due_at": row["due_at"]} for row in rows],
    }


@app.route("/api/device/reminders/<int:todo_id>/<action>", methods=["POST"])
def device_finish_reminder(todo_id, action):
    """The ESP32's button: "done" ticks the task off, "dismiss" just stops the ringing."""
    device = current_device()
    if device is None:
        return {"error": "Unknown device key"}, 401
    if action not in ("done", "dismiss"):
        return {"error": "Action must be done or dismiss"}, 400

    with getdb() as conn:
        todo = conn.execute(
            "SELECT * FROM todos WHERE id = ? AND user_id = ?", (todo_id, device["user_id"])
        ).fetchone()
        if todo is None:
            return {"error": "Task not found"}, 404
        conn.execute(
            "INSERT OR IGNORE INTO device_reminders (device_id, todo_id) VALUES (?, ?)",
            (device["id"], todo_id),
        )
        if action == "done":
            conn.execute("UPDATE todos SET done = 1 WHERE id = ?", (todo_id,))
    return {"message": "OK"}


# ---------- AI (Claude) ----------

def ai_error(error):
    return {"error": str(error)}, 503


AI_NOT_INSTALLED = {"error": "The AI packages aren't installed. On the server, run: pip install -r requirements.txt"}, 503


@app.route("/api/ai/status")
def ai_status():
    return {"enabled": ai is not None and ai.enabled()}


@app.route("/api/ai/add", methods=["POST"])
def ai_add():
    """Smart add: turn a sentence like "call mom friday at 6" into tasks."""
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN
    if ai is None:
        return AI_NOT_INSTALLED

    data = request.get_json()
    text = data.get("text", "").strip()
    if not text:
        return {"error": "Type something to add"}, 400

    try:
        tasks = ai.parse_tasks(text)
    except ai.AIError as error:
        return ai_error(error)
    if not tasks:
        tasks = [{"title": text, "due_at": None}]

    with getdb() as conn:
        device_id = owned_device_id(conn, user, data.get("device_id"))
        rows = [insert_todo(conn, user["id"], t["title"], t["due_at"], device_id) for t in tasks]
    return {"todos": [todo_dict(row) for row in rows]}, 201


@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN
    if ai is None:
        return AI_NOT_INSTALLED

    history = [
        {"role": m["role"], "content": str(m["content"])}
        for m in request.get_json().get("messages", [])
        if m.get("role") in ("user", "assistant") and m.get("content")
    ][-20:]
    if not history or history[-1]["role"] != "user":
        return {"error": "Send a question"}, 400

    with getdb() as conn:
        tasks = conn.execute("SELECT * FROM todos WHERE user_id = ?", (user["id"],)).fetchall()
        sources = conn.execute("SELECT * FROM sources WHERE user_id = ?", (user["id"],)).fetchall()

    try:
        reply, suggestions = ai.chat(history, tasks, sources)
    except ai.AIError as error:
        return ai_error(error)
    return {"reply": reply, "suggestions": suggestions}


@app.route("/api/sources", methods=["GET"])
def list_sources():
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN

    with getdb() as conn:
        rows = conn.execute(
            "SELECT * FROM sources WHERE user_id = ? ORDER BY id DESC", (user["id"],)
        ).fetchall()
    return {"sources": [source_dict(row) for row in rows]}


@app.route("/api/sources", methods=["POST"])
def upload_source():
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN
    if ai is None:
        return AI_NOT_INSTALLED

    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return {"error": "Choose a file to upload"}, 400
    media_type = ai.SUPPORTED_TYPES.get(Path(upload.filename).suffix.lower())
    if media_type is None:
        return {"error": "Upload a PDF, an image, or a .txt / .md file"}, 415

    try:
        file_id, summary, suggestions = ai.read_source(upload.filename, upload.read(), media_type)
    except ai.AIError as error:
        return ai_error(error)

    with getdb() as conn:
        cursor = conn.execute(
            """INSERT INTO sources (user_id, name, media_type, file_id, summary, suggestions)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (user["id"], upload.filename, media_type, file_id, summary, json.dumps(suggestions)),
        )
        row = conn.execute("SELECT * FROM sources WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return source_dict(row), 201


@app.route("/api/sources/<int:source_id>", methods=["DELETE"])
def delete_source(source_id):
    user = current_user()
    if user is None:
        return NOT_SIGNED_IN

    with getdb() as conn:
        row = conn.execute(
            "SELECT * FROM sources WHERE id = ? AND user_id = ?", (source_id, user["id"])
        ).fetchone()
        if row is None:
            return {"error": "Source not found"}, 404
        conn.execute("DELETE FROM sources WHERE id = ?", (source_id,))
    if ai is not None:
        ai.delete_source_file(row["file_id"])
    return {"message": "Deleted"}


if __name__ == "__main__":
    initdb()
    # DEBUG=1 turns on auto-reload while coding. Leave it off on the Pi:
    # debug mode lets anyone on the network reach Flask's debugger.
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=os.environ.get("DEBUG") == "1")
