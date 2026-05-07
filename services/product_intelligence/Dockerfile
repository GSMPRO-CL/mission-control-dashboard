FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente
COPY . .

# Exponer el puerto que usará Cloud Run (por defecto 8080)
EXPOSE 8080

# Ejecutar FastAPI con uvicorn usando la variable PORT de Cloud Run
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
