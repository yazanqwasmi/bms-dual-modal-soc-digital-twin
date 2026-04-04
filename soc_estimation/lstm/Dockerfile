FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy inference server
COPY lstm_inference_server.py .

# Model and scaler are mounted at runtime via docker-compose volume,
# or baked in by copying trained artifacts here before docker build.
# Expected paths (see MODEL_PATH / SCALER_PATH env vars):
#   /app/model/lstm_soc_model.h5
#   /app/model/scaler_params.json

EXPOSE 5001

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/health')"

CMD ["python3", "lstm_inference_server.py"]
