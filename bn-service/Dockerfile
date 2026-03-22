FROM python:3.12-slim

WORKDIR /app

# Install CPU-only PyTorch first to prevent pgmpy pulling the 3 GB CUDA version
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install the alac-wheelchair-bn package from the sibling directory
COPY python/alac-wheelchair-bn /opt/alac-wheelchair-bn
RUN pip install --no-cache-dir /opt/alac-wheelchair-bn

# Install FastAPI service dependencies
COPY bn-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the FastAPI application
COPY bn-service/app ./app

ENV PORT=10000
EXPOSE ${PORT}

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
