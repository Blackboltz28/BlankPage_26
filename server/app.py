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


if __name__ == "__main__":
    initdb()
    app.run(host="0.0.0.0", port=5000, debug=True)