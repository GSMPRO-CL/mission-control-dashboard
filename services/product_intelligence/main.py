from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from agent import get_latest_electronic_releases
from bq_matcher import check_products_in_bq
from dotenv import load_dotenv

# Cargar variables de entorno (como GCP_PROJECT_ID)
load_dotenv("../../.env")

app = FastAPI(title="Product Intelligence Service")

# Permitir CORS para desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/releases")
def get_releases():
    try:
        # 1. Obtener los últimos lanzamientos de internet vía Gemini
        raw_products = get_latest_electronic_releases()
        
        if not raw_products:
            return []
            
        # 2. Cotejar contra la base de datos (BigQuery)
        processed_products = check_products_in_bq(raw_products)
        
        return processed_products
    except Exception as e:
        print(f"Error en el flujo principal: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor procesando lanzamientos.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
