# Historial de Proyecto (Changelog Permanente)

Este documento mantiene un registro inmutable de las decisiones técnicas, configuraciones y módulos desarrollados para el Dashboard GSMPRO. 
*Sirve como memoria principal para cualquier sesión futura del agente.*

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
