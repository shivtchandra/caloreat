"""
main.py
Thin entrypoint used by Railway / Docker to start the real API defined in app.py.

Railway (see railway.toml and backend/Dockerfile) runs:
  uvicorn main:app --host 0.0.0.0 --port $PORT

To avoid duplicating logic, we simply re-export the FastAPI instance from app.py
and add a lightweight health endpoint on the same app.
"""

from app import app  # re-use the main FastAPI app defined in app.py


@app.get("/health")
def health():
    return {"status": "ok"}
