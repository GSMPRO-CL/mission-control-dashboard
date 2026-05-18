import os
import json
import urllib.request
from google import genai
from google.genai import types

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "atomic-box-494614-r5")
LOCATION = os.getenv("GCP_LOCATION", "us-central1")
client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

def fetch_html(url: str) -> str:
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8')
            # Extraer un aproximado del body para no sobrecargar de tokens con scripts/css
            import re
            body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.IGNORECASE | re.DOTALL)
            if body_match:
                content = body_match.group(1)
                # Quitar tags de script y style
                content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.IGNORECASE | re.DOTALL)
                content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.IGNORECASE | re.DOTALL)
                return content[:15000] # Limitar a primeros 15k caracteres para no exceder tokens innecesariamente
            return html[:15000]
    except Exception as e:
        print(f"Error fetching HTML for {url}: {e}")
        return "No se pudo obtener el HTML de la página."

def analyze_seo(payload: dict) -> dict:
    try:
        product = payload.get("product", {})
        queries = payload.get("queries", [])
        benchmark = payload.get("benchmark", {})
        selected_metric = payload.get("selected_metric", "Todas")
        url = product.get("url", "")
        
        # 1. Fetch HTML
        html_content = fetch_html(url) if url else "URL no proporcionada"

        # 2. Construir Prompt
        queries_str = "\n".join([
            f"- {q['query']}: {q['clicks']} clics, {q['impressions']} imp, Pos {q['position']:.1f}, CTR {q['ctr']:.2f}%" 
            for q in queries
        ])

        prompt = f"""
Eres un experto en SEO Técnico y Posicionamiento Orgánico de e-commerce. Analiza el siguiente producto basándote en sus métricas reales de Google Search Console y el código fuente de su landing page.

**Producto:** {product.get("title")}
**URL:** {url}

**Métricas del Producto (GSC):**
- Posición promedio: {product.get("position", 0):.1f}
- CTR: {product.get("ctr", 0):.2f}%
- Impresiones: {product.get("impressions", 0)}
- Clics: {product.get("clicks", 0)}

**Benchmark del Sitio Global:**
- Posición promedio global: {benchmark.get("site_position", 0):.1f}
- CTR promedio global: {benchmark.get("site_ctr", 0):.2f}%

**Top Queries que llevan tráfico a este producto:**
{queries_str}

**Métrica enfocada a analizar:** {selected_metric}

**Extracto del HTML de la página (para análisis On-Page):**
```html
{html_content}
```

**TAREA:**
Cruza las métricas de rendimiento con la estructura On-Page (títulos, meta, contenido). Diagnostica por qué tiene este rendimiento y elabora hipótesis. Genera recomendaciones prácticas y accionables.

DEBES DEVOLVER TU RESPUESTA ESTRICTAMENTE EN FORMATO JSON.
La estructura debe ser exactamente la siguiente (sin texto adicional fuera del JSON):

{{
  "diagnostico": "Resumen ejecutivo de máximo 3 líneas sobre el estado SEO del producto.",
  "hipotesis": [
    "Hipótesis 1 (ej: El título no contiene la keyword principal)",
    "Hipótesis 2"
  ],
  "recomendaciones": [
    {{
      "accion": "Descripción de la acción a tomar",
      "impacto_esperado": "Alto" o "Medio" o "Bajo",
      "esfuerzo": "Alto" o "Medio" o "Bajo"
    }}
  ],
  "metricas_criticas": [
    {{
      "nombre": "Nombre de la métrica (ej: CTR o Keyword principal)",
      "valor_actual": "Valor actual",
      "valor_ideal": "Valor esperado o benchmark"
    }}
  ]
}}
"""

        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2
            )
        )
        
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
            
        data = json.loads(raw_text.strip())
        return data

    except Exception as e:
        print(f"Error en analyze_seo: {e}")
        return {
            "diagnostico": "Error interno al procesar el análisis con IA.",
            "hipotesis": [],
            "recomendaciones": [],
            "metricas_criticas": []
        }
