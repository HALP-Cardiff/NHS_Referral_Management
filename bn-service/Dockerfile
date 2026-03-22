FROM python:3.12-slim

WORKDIR /app

# Install the alac-wheelchair-bn package from the sibling directory
COPY python/alac-wheelchair-bn /opt/alac-wheelchair-bn
RUN pip install --no-cache-dir /opt/alac-wheelchair-bn

# Install FastAPI service dependencies
COPY bn-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the FastAPI application
COPY bn-service/app ./app

EXPOSE 10000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10000"]
