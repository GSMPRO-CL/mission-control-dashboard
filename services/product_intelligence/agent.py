import os
import json
from vertexai.generative_models import GenerativeModel, Tool, grounding
import vertexai

# Inicializar Vertex AI
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "atomic-box-494614-r5")
LOCATION = os.getenv("GCP_LOCATION", "us-central1")
vertexai.init(project=PROJECT_ID, location=LOCATION)

# Habilitar Google Search Grounding
tool = Tool.from_google_search_retrieval(grounding.GoogleSearchRetrieval())

prompt = """
Busca en internet los últimos lanzamientos y noticias de productos electrónicos de consumo anunciados o lanzados en la última semana. 
Enfócate en las siguientes categorías: celulares (smartphones), consolas, laptops, dispositivos VR/AR y tablets.

Debes devolver estrictamente un objeto JSON que sea una lista (array) de objetos con la siguiente estructura:
[
  {
    "producto": "Nombre del Producto (ej. Samsung Galaxy S24 Ultra)",
    "marca": "Marca del Producto (ej. Samsung)",
    "categoria": "Celular / Consola / Laptop / VR / Tablet",
    "especificaciones_clave": "Breve resumen de specs o novedad principal",
    "fuente": "URL de la noticia o fuente oficial"
  }
]

No incluyas texto adicional fuera del JSON. Si no encuentras información reciente, devuelve una lista vacía [].
"""

def get_latest_electronic_releases() -> list:
    model = GenerativeModel(
        model_name="gemini-2.5-pro", 
        tools=[tool]
    )
    
    response = model.generate_content(
        prompt,
        generation_config={
            "temperature": 0.2,
            "response_mime_type": "application/json"
        }
    )
    
    try:
        data = json.loads(response.text)
        return data
    except json.JSONDecodeError:
        print("Error al parsear la respuesta JSON de Gemini.")
        print(response.text)
        return []
