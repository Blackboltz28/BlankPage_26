from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/api/hello")
def hello():
    return {"message": "hello "}

if __name__ == "__main__":
    app.run(port=5000, debug=True)