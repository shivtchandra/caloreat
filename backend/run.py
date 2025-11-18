import os
import uvicorn

def main():
    port = int(os.getenv("PORT", "8000"))  # read PORT from env (Railway sets this)
    uvicorn.run(
        "app.main:app",   # 👉 change to your actual module:variable
        host="0.0.0.0",
        port=port,
        reload=False      # keep False in production
    )

if __name__ == "__main__":
    main()
