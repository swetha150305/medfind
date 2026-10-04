# ---- Stage 1: build the React frontend ----
FROM node:22-slim AS web
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Same-origin API in the browser: leave VITE_API_URL unset so it uses "/api".
# Optional: pass --build-arg VITE_GOOGLE_CLIENT_ID=... if you use Google sign-in.
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# ---- Stage 2: Python backend serving API + built frontend ----
FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
# Starter database (cleaned: no accounts). Copied to the data folder on first start.
RUN mkdir -p /seed && cp backend/medfind.db /seed/medfind.db
COPY data/ ./data/
COPY --from=web /app/frontend/dist ./frontend/dist
ENV MEDFIND_DB_PATH=/data/medfind.db
EXPOSE 8000
CMD ["sh", "-c", "mkdir -p /data && [ -f /data/medfind.db ] || cp /seed/medfind.db /data/medfind.db; uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
