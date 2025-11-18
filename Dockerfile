# syntax=docker/dockerfile:1

# =========================
# Frontend build stage
# =========================
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# =========================
# Backend runtime stage
# =========================
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1
WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist /app/frontend-dist

ENV FRONTEND_DIST=/app/frontend-dist
EXPOSE 5001

CMD ["hypercorn", "--bind", "0.0.0.0:5001", "app:app"]
