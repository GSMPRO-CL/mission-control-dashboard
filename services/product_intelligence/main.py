from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from agent import get_latest_electronic_releases
from calendar_agent import get_upcoming_commercial_calendar_events
from bq_matcher import check_products_in_bq
from seo_inspector import analyze_seo
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

import os
import uuid
from datetime import datetime, timezone
from google.cloud import bigquery

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "atomic-box-494614-r5")
bq_client = bigquery.Client(project=PROJECT_ID)

@app.post("/api/v1/releases/scan")
def run_scan():
    try:
        # 1. Obtener historial de productos ya registrados para optimizar tokens y memoria
        query = f"SELECT DISTINCT producto FROM `{PROJECT_ID}.raw_layer.market_intelligence_launches`"
        query_job = bq_client.query(query)
        known_products = [row.producto for row in query_job.result()]
        
        # 2. Obtener los últimos lanzamientos de internet vía Gemini
        raw_products = get_latest_electronic_releases(known_products)
        
        if not raw_products:
            return {"status": "success", "message": "No new products found", "inserted": 0}
            
        # 2. Cotejar contra la base de datos (BigQuery)
        processed_products = check_products_in_bq(raw_products)
        
        # 3. Insertar en BigQuery
        rows_to_insert = []
        scan_time = datetime.now(timezone.utc).isoformat()
        
        for p in processed_products:
            rows_to_insert.append({
                "id": str(uuid.uuid4()),
                "producto": p.get("producto", ""),
                "marca": p.get("marca", ""),
                "categoria": p.get("categoria", ""),
                "especificaciones_clave": p.get("especificaciones_clave", ""),
                "fuente": p.get("fuente", ""),
                "estado_db": p.get("estado_db", ""),
                "fecha_escaneo": scan_time,
                "fecha_lanzamiento": p.get("fecha_lanzamiento", None)
            })
            
        errors = bq_client.insert_rows_json(
            f"{PROJECT_ID}.raw_layer.market_intelligence_launches",
            rows_to_insert
        )
        
        if errors:
            print(f"Errores insertando en BQ: {errors}")
            raise HTTPException(status_code=500, detail="Error guardando en base de datos")
            
        return {"status": "success", "message": "Escaneo completado exitosamente", "inserted": len(rows_to_insert)}
        
    except Exception as e:
        print(f"Error en el flujo principal: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor procesando lanzamientos.")

@app.post("/api/v1/calendar/scan")
def run_calendar_scan():
    try:
        # 1. Obtener historial de eventos para optimizar tokens y evitar duplicados
        query = f"SELECT DISTINCT event_name FROM `{PROJECT_ID}.raw_layer.commercial_calendar` WHERE event_date >= CURRENT_DATE()"
        query_job = bq_client.query(query)
        known_events = [row.event_name for row in query_job.result()]
        
        # 2. Obtener los próximos eventos vía Gemini
        raw_events = get_upcoming_commercial_calendar_events(known_events)
        
        if not raw_events:
            return {"status": "success", "message": "No new events found", "inserted": 0}
            
        # 3. Insertar en BigQuery
        rows_to_insert = []
        scan_time = datetime.now(timezone.utc).isoformat()
        
        for e in raw_events:
            # Check for duplications locally to be safe
            if e.get("event_name") in known_events:
                continue
                
            rows_to_insert.append({
                "id": str(uuid.uuid4()),
                "event_name": e.get("event_name", ""),
                "event_type": e.get("event_type", ""),
                "event_date": e.get("event_date", ""),
                "description": e.get("description", ""),
                "source": e.get("source", ""),
                "created_at": scan_time
            })
            
        if not rows_to_insert:
             return {"status": "success", "message": "No new non-duplicate events to insert", "inserted": 0}
            
        errors = bq_client.insert_rows_json(
            f"{PROJECT_ID}.raw_layer.commercial_calendar",
            rows_to_insert
        )
        
        if errors:
            print(f"Errores insertando en BQ (Calendar): {errors}")
            raise HTTPException(status_code=500, detail="Error guardando en base de datos")
            
        return {"status": "success", "message": "Escaneo de calendario completado", "inserted": len(rows_to_insert)}
        
    except Exception as e:
        print(f"Error en el flujo de calendario: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor procesando calendario.")

@app.post("/api/v1/seo/analyze")
async def run_seo_analysis(payload: dict):
    try:
        # payload expected: { product: {...}, queries: [...], benchmark: {...}, selected_metric: "..." }
        analysis_result = analyze_seo(payload)
        return {"status": "success", "analysis": analysis_result}
    except Exception as e:
        print(f"Error en el análisis SEO: {e}")
        raise HTTPException(status_code=500, detail="Error analizando métricas SEO")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
