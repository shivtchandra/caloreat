# backend/run.py
import os
import uvicorn
from app import app  # 👈 app.py in the same folder

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))  # Railway sets PORT
    uvicorn.run(app, host="0.0.0.0", port=port)
