import os
import json
from datetime import datetime
from google import genai
from google.genai import types

# Inicializar Client con Vertex AI
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "atomic-box-494614-r5")
LOCATION = os.getenv("GCP_LOCATION", "us-central1")
client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

prompt = """
Rol: Eres un analista de inteligencia de mercado e e-commerce para Chile y a nivel Global.
Tu objetivo es investigar y consolidar un calendario comercial actualizado que incluya eventos e-commerce importantes y los próximos lanzamientos de tecnología.

Categorías a buscar:
1. Eventos Comerciales: Cyber Monday, Black Friday, Cyber Day, Hot Sale, Navidad, Día de la Madre, Día del Padre, etc., con foco en Chile o aquellos eventos de alcance global con alto impacto en e-commerce.
2. Lanzamientos de Tecnología: Próximos lanzamientos confirmados o altamente esperados a nivel global (Ej. nuevos iPhones, Samsung Galaxy, Consolas de videojuegos, Laptops, VR/AR, etc.).

Reglas de búsqueda y respuesta:
- Debes usar la web para buscar información ACTUALIZADA y confirmar fechas.
- DEBES DEVOLVER TU RESPUESTA ESTRICTAMENTE EN FORMATO JSON.
- Solo debes buscar eventos que ocurran DESDE HOY hacia el FUTURO (o que estén sucediendo en este momento). No incluyas eventos que ya finalizaron.
- Para lanzamientos de tecnología que aún no tienen una fecha exacta pero sí un mes o trimestre esperado, aproxima la fecha al primer día de ese mes o trimestre, y aclara en la descripción que es un lanzamiento esperado/rumorado.
- Devuelve únicamente una lista (array) de objetos JSON. No incluyas texto explicativo antes ni después del JSON.

La estructura de CADA OBJETO JSON debe ser exactamente la siguiente:
[
  {
    "event_name": "Nombre del evento (Ej. Cyber Day Chile 2024, Lanzamiento iPhone 17)",
    "event_type": "Commercial" o "Launch",
    "event_date": "YYYY-MM-DD",
    "description": "Descripción concisa del evento, impacto comercial esperado, o especificaciones clave del producto.",
    "source": "URL de la fuente de la información (muy importante)"
  }
]
"""

def get_upcoming_commercial_calendar_events(known_events: list = None) -> list:
    try:
        dynamic_prompt = prompt
        current_date = datetime.now().strftime("%Y-%m-%d")
        dynamic_prompt += f"\n\nLÍMITE TEMPORAL: Hoy es {current_date}. Solo debes devolver eventos cuya fecha sea igual o posterior a hoy."

        if known_events and len(known_events) > 0:
            exclusions = ", ".join(known_events)
            dynamic_prompt += f"\n\nREGLA DE EXCLUSIÓN: Ya tenemos registrados los siguientes eventos en nuestra base de datos para este año. Para optimizar tokens, NO los repitas si no hay cambios significativos en su fecha: {exclusions}"

        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=dynamic_prompt,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.2
            )
        )
        
        raw_text = response.text
        
        # Limpiador de formato Markdown
        clean_text = raw_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        elif clean_text.startswith("```"):
            clean_text = clean_text[3:]
            
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
            
        clean_text = clean_text.strip()
        
        data = json.loads(clean_text)
        return data
    except Exception as e:
        print(f"Error ejecutando Gemini o parseando JSON en calendar_agent: {e}")
        return []
