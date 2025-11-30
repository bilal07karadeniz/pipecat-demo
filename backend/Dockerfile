# Backend Dockerfile for Pipecat Voice Interview Bot
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
# - poppler-utils: Required for pdf2image (PPTX to images)
# - libmagic1: File type detection
# - ffmpeg: Audio/video processing for pipecat
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libmagic1 \
    ffmpeg \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create storage directory
RUN mkdir -p /app/storage/sessions /app/storage/assets

# Expose port
EXPOSE 8000

# Environment variables (can be overridden)
ENV HOST=0.0.0.0
ENV PORT=8000
ENV STORAGE_PATH=/app/storage

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
