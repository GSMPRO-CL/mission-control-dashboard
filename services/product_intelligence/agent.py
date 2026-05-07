import os
import json
from datetime import datetime, timedelta
from google import genai
from google.genai import types

# Inicializar Client con Vertex AI
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "atomic-box-494614-r5")
LOCATION = os.getenv("GCP_LOCATION", "us-central1")
client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

prompt = """
Rol: Eres un investigador experto en tecnología de consumo y analista de mercado. Tu objetivo es rastrear, recopilar y resumir información sobre los lanzamientos más recientes de productos electrónicos.

Categorías de interés: Celulares (Smartphones), Consolas de videojuegos, Laptops, Visores de Realidad Virtual (VR/AR) y Tablets.

Reglas de respuesta:

Cuando se te pida buscar nuevos lanzamientos, debes buscar información actualizada en la web.

Presenta la información de forma estructurada. Para cada producto, incluye: Nombre del producto, Marca, Fecha de anuncio/lanzamiento, Especificaciones clave (procesador, pantalla, precio estimado) y una breve descripción de su innovación principal.

Evita rumores sin fundamentos; céntrate en anuncios oficiales o filtraciones de fuentes de alta confiabilidad.

Usa un tono profesional, objetivo y conciso.

DEBES DEVOLVER TU RESPUESTA ESTRICTAMENTE EN FORMATO JSON.
Devuelve únicamente una lista (array) de objetos. No incluyas texto antes ni después del JSON.
La estructura de cada objeto debe ser la siguiente:
[
  {
    "producto": "Nombre del producto",
    "marca": "Marca",
    "categoria": "Celular / Consola / Laptop / VR / Tablet",
    "especificaciones_clave": "Especificaciones clave (procesador, pantalla, precio estimado) y una breve descripción de su innovación principal.",
    "fuente": "URL de la noticia o fuente"
  }
]
"""

def get_latest_electronic_releases(known_products: list = None) -> list:
    try:
        dynamic_prompt = prompt
        
        # Calcular fecha límite dinámica (120 días atrás) para optimización de tokens
        limit_date = (datetime.now() - timedelta(days=120)).strftime("%Y-%m-%d")
        dynamic_prompt += f"\n\nLÍMITE TEMPORAL: Solo debes buscar y devolver productos cuyas noticias, filtraciones o anuncios oficiales hayan ocurrido DESPUÉS del {limit_date} (últimos 120 días). IGNORA ESTRICTAMENTE cualquier producto o noticia más antigua."

        if known_products and len(known_products) > 0:
            exclusions = ", ".join(known_products)
            dynamic_prompt += f"\n\nREGLA DE EXCLUSIÓN ESTRICTA: Ya tenemos registrados los siguientes productos. NO LOS INCLUYAS en tu respuesta bajo ninguna circunstancia. Busca otros nuevos lanzamientos: {exclusions}"

        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=dynamic_prompt,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.2
                # NO SE DEBE USAR response_mime_type="application/json" JUNTO A GOOGLE SEARCH
            )
        )
        
        raw_text = response.text
        
        # Limpiador de formato Markdown (Markdown Stripper)
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
        print(f"Error ejecutando Gemini o parseando JSON: {e}")
        return []
