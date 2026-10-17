import sqlite3
import secrets
from flask import Flask, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
CORS(app)

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
        # due_at is local time as "YYYY-MM-DDTHH:MM" (what the React date picker sends).
        # reminded is for the Pi: it flips to 1 once the hardware reminder has gone off.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                due_at TEXT,
                done INTEGER NOT NULL DEFAULT 0,
                reminded INTEGER NOT NULL DEFAULT 0
            )
        """)


def current_user():
    """Find the signed-in user from the "Authorization: Bearer <token>" header."""
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token:
        return None
    with getdb() as conn:
        return conn.execute("SELECT * FROM users WHERE token = ?", (token,)).fetchone()


def todo_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "due_at": row["due_at"],
        "done": bool(row["done"]),
    }


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
            "UPDATE users SET token = ? WHERE id = ?",
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
        return {"error": "Not signed in"}, 401
    return {"username": user["username"]}


@app.route("/api/logout", methods=["POST"])
def logout():
    user = current_user()
    if user is not None:
        with getdb() as conn:
            conn.execute("UPDATE users SET token = NULL WHERE id = ?", (user["id"],))
    return {"message": "Signed out"}


@app.route("/api/todos", methods=["GET"])
def list_todos():
    user = current_user()
    if user is None:
        return {"error": "Not signed in"}, 401

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
        return {"error": "Not signed in"}, 401

    data = request.get_json()
    title = data.get("title", "").strip()
    due_at = data.get("due_at") or None
    if not title:
        return {"error": "Give the task a name"}, 400

    with getdb() as conn:
        cursor = conn.execute(
            "INSERT INTO todos (user_id, title, due_at) VALUES (?, ?, ?)",
            (user["id"], title, due_at),
        )
        row = conn.execute("SELECT * FROM todos WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return todo_dict(row), 201


@app.route("/api/todos/<int:todo_id>", methods=["PATCH"])
def update_todo(todo_id):
    user = current_user()
    if user is None:
        return {"error": "Not signed in"}, 401

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
        # A new due time means the Pi should remind again.
        reminded = todo["reminded"] if due_at == todo["due_at"] else 0

        conn.execute(
            "UPDATE todos SET title = ?, due_at = ?, done = ?, reminded = ? WHERE id = ?",
            (title, due_at, int(done), reminded, todo_id),
        )
        row = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
    return todo_dict(row)


@app.route("/api/todos/<int:todo_id>", methods=["DELETE"])
def delete_todo(todo_id):
    user = current_user()
    if user is None:
        return {"error": "Not signed in"}, 401

    with getdb() as conn:
        cursor = conn.execute(
            "DELETE FROM todos WHERE id = ? AND user_id = ?", (todo_id, user["id"])
        )
    if cursor.rowcount == 0:
        return {"error": "Task not found"}, 404
    return {"message": "Deleted"}


if __name__ == "__main__":
    initdb()
    app.run(host="0.0.0.0",     port=5000, debug=True)