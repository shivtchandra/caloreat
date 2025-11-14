from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Caloreat Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # replace with production origin later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status":"ok"}
