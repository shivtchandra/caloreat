# backend/run.py
import os
import uvicorn
from app import app  # <- your FastAPI app is in backend/app.py

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    print("🚀 PORT env =", os.getenv("PORT"))  # will show up in Railway logs
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        reload=False,    # IMPORTANT: no reload in Railway
    )