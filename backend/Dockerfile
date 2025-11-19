# Use official Python image
FROM python:3.11-slim

# Set working dir
WORKDIR /app

# Ensure pip, build tools present
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt .

# Install deps (use pip via python -m pip for reliability)
RUN python -m pip install --upgrade pip setuptools wheel \
 && python -m pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Expose port and cmd
ENV PORT=8000
EXPOSE 8000
CMD python run.py
  # and run.py handles PORT via os.getenv

