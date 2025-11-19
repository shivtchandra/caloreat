# backend/run.py
import os
import uvicorn
<<<<<<< HEAD
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
=======
from app import app  # 👈 app.py in the same folder

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))  # Railway sets PORT
    uvicorn.run(app, host="0.0.0.0", port=port)
>>>>>>> 14d08a3 (Update Dockerfile, run.py and frontend API configs for Render deployment)
