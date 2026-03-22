FROM python:3.12-slim

WORKDIR /app

# Install CPU-only PyTorch (~200 MB) — pgmpy imports torch at startup.
# Using the CPU index avoids the 3 GB CUDA/NVIDIA packages.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install the remaining pgmpy deps needed for exact BN inference.
# Skip pyro, statsmodels, scikit-learn (unused by VariableElimination).
RUN pip install --no-cache-dir numpy scipy networkx pandas tqdm joblib opt-einsum scikit-learn

# Install pgmpy itself without pulling its full dependency tree again
RUN pip install --no-cache-dir --no-deps pgmpy>=0.1.25

# Install the alac-wheelchair-bn package (skip deps — already installed above)
COPY python/alac-wheelchair-bn /opt/alac-wheelchair-bn
RUN pip install --no-cache-dir --no-deps /opt/alac-wheelchair-bn

# Install FastAPI service dependencies
COPY bn-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the FastAPI application
COPY bn-service/app ./app

ENV PORT=10000
EXPOSE ${PORT}

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
