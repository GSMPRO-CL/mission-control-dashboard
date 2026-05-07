# Historial de Proyecto (Changelog Permanente)

Este documento mantiene un registro inmutable de las decisiones técnicas, configuraciones y módulos desarrollados para el Dashboard GSMPRO. 
*Sirve como memoria principal para cualquier sesión futura del agente.*

## [05-05-2026] - Producción y Módulo de Customer Services (Soporte)
- **Extracción de SLA:** Se actualizó el pipeline Node.js (`sync-crisp-messages`) para capturar la identidad de los operadores, y se consolidó el BigQuery con una vista SQL (`v_crisp_sla`) que delega el cálculo matemático del TTFR.
- **Sentiment Analysis:** Rutas de API `/api/support/sentiment` implementadas nativamente contra el motor NLP de Google.
- **Glassmorphism UI:** Se refactorizó la ruta del cliente (ahora `/soporte`) migrándola desde un scaffolding hacia una interfaz rica de `Recharts` que grafica el rendimiento y la inteligencia emocional del soporte.
- **Despliegue Inmutable:** El módulo fue fusionado y enviado a `us-east1` usando de nuevo la inyección maestra de variables a través de `env.yaml`.


## [05-05-2026] - Corrección de Arquitectura e Inteligencia de Mercado Completa
- **Microservicio Privado:** El agente Python/Gemini se containerizó (Dockerfile) y desplegó a Cloud Run (`gsmpro-product-intelligence`).
- **Next.js Auth:** Se integró `google-auth-library` en Next.js para invocar al backend de IA usando un Identity Token seguro, permitiendo bloquear el acceso público.
- **Saneamiento Cloud:** Se resolvió el "Hydration Mismatch", se arregló la inconsistencia de regiones (todo unificado en `us-east1`) y se purgaron los servicios fantasmas.
- **Registro Maestro:** Se impuso la política de registrar toda variable crítica en `env.yaml` para despliegues inmutables.

## [05-05-2026] - Producción y Google Ads
- **Google Ads Integration:** Se finalizó la autenticación offline con la API (OAuth2) capturando el `REFRESH_TOKEN`.
- **Panel Google Ads:** Se construyó la ruta de Next.js `/trafico/pagado-google` consumiendo métricas GAQL de API Route.
- **Despliegue Cloud Run:** Se inyectaron exitosamente las variables críticas (`.env`) en GCP.
- **Optimización de Build:** Se aisló el contexto de Docker a `/dashboard`, omitiendo archivos pesados (CSV).
- **Resolución de Errores:** Se resolvió error estricto de TypeScript en los Tooltips de Recharts que bloqueaba el build.

## [04-05-2026] - Inteligencia de Mercado (Product Launch)
- **Servicio Python (Vertex AI):** Se desarrolló el backend en Python para identificar nuevos lanzamientos de productos cruzando Google Search Grounding con BigQuery.
- **Diagnóstico Frontend:** Se detectaron problemas estructurales en el módulo de "Lanzamientos de Productos", planteando un roadmap sin alterar el código prematuramente.

## [01-05-2026] - Inteligencia de Ventas y Staff
- **Atribución de Colaboradores (Shopify):** Desarrollo de pipelines (Audit Logs y Staff Assignments) para vincular la actividad humana con BigQuery usando modelos SCD-2.
- **Pipeline de Crisp:** Refactorización de la integración de Crisp.chat para análisis de sentimiento mediante NLP.
