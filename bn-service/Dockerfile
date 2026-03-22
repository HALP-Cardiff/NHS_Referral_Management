FROM python:3.12-slim

WORKDIR /app

# Install only the pgmpy deps actually needed for exact BN inference.
# Skip torch, pyro, statsmodels, scikit-learn (~1 GB+ RAM) which pgmpy
# lists but are unused by VariableElimination / TabularCPD.
RUN pip install --no-cache-dir numpy scipy networkx pandas tqdm joblib

# Install pgmpy WITHOUT its transitive deps (torch etc. already skipped above)
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
