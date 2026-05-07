# 🧠 Especificaciones: Inteligencia de Mercado

Este documento mantiene un registro vivo de los requerimientos y el avance estructural del módulo de Inteligencia de Mercado de GSMPRO. Está dividido en fases para garantizar un despliegue escalable.

## Fase 1: Dimensión de Mercado (Market Size)
**Estado: ⏸️ EN ESPERA — Pendiente de aprobación de Google Ads Basic Access**

### Bloqueo Activo
- **Causa Raíz:** El `GOOGLE_ADS_DEVELOPER_TOKEN` actual tiene nivel **Explorer Access**. Google restringe explícitamente el servicio `KeywordPlanIdeaService` a tokens de nivel **Basic Access o superior**.
- **Acción tomada:** El usuario inició el proceso de solicitud de Basic Access en `ads.google.com → Herramientas → Centro de API → Solicitar acceso básico`. Tiempo estimado de aprobación: 1-5 días hábiles.

### Para reanudar cuando se apruebe el Basic Access
1. Actualizar el `GOOGLE_ADS_DEVELOPER_TOKEN` en `.env` y `env.yaml` con el nuevo token aprobado (Google lo reemite).
2. Ejecutar validación: `cd /home/prllc/Escritorio/DashboardGSMPRO/scripts && node sync-market-size.js --dry-run`
3. Si el dry-run muestra `avg_monthly_searches > 0`, ejecutar sync real: `node sync-market-size.js`
4. Verificar en `http://localhost:3000/inteligencia-mercado/dimension` que los KPIs globales muestran datos.
5. Desplegar a producción: `gcloud run deploy dashboard-gsmpro-ui --source . --region us-east1 --env-vars-file ../env.yaml --project atomic-box-494614-r5`

### Infraestructura ya construida (No tocar)
- `scripts/sync-market-size.js` — Pipeline completo y correcto, solo bloqueado por permisos.
- `scripts/sql/raw_layer.market_size_metrics.sql` — DDL desplegada en BigQuery.
- `dashboard/src/app/api/inteligencia-mercado/dimension/route.ts` — API Route lista.
- `dashboard/src/app/inteligencia-mercado/dimension/page.tsx` — Frontend completo.

**Lógica Matemática:**
1. Extraer la *keyword principal* de cada producto activo (limpiando variantes, colores, etc.).
2. Consultar la API de Google Ads (Keyword Plan Idea Service) para obtener el Volumen de Búsqueda Mensual (Promedio y Último Mes).
3. `Compradores Potenciales = Volumen de Búsqueda * 1%`.
4. Obtener el precio promedio del producto (promediando todas sus variantes).
5. `Market Size (Tamaño de Mercado) = Compradores Potenciales * Precio Promedio`.
6. `Market Share (Cuota de Mercado) = Market Size * 5%`.
7. **Globales:** Sumatoria total de todos los productos para obtener el Market Size Global y Market Share Global.

## Fase 2: Competitividad (Monitor de Precios)
**Estado: ⏸️ EN ESPERA — Cuenta SerpApi sin créditos disponibles (Plan Free agotado)**

### Bloqueo Activo
- **Causa Raíz:** La cuenta de SerpApi (`sales@proshoproyal.net`) tiene **Plan Free (250 búsquedas/mes)** y ya agotó las búsquedas del mes.
- **Acción requerida:** Actualizar a un plan pago en [serpapi.com/pricing](https://serpapi.com/pricing) para ejecutar el sync de 1,522 productos.

### Para reanudar cuando se actualice el plan SerpApi
1. Validar créditos: `node -e "require('dotenv').config({path:'.env'}); fetch('https://serpapi.com/account?api_key='+process.env.SERPAPI_KEY).then(r=>r.json()).then(d=>console.log('Créditos:', d.total_searches_left))"`
2. Ejecutar dry-run con 3 productos: `cd scripts && node sync-competitor-prices.js --limit=3 --dry-run`
3. Sync completo: `node sync-competitor-prices.js`
4. Verificar en `http://localhost:3000/inteligencia-mercado/competitividad`
5. Desplegar a producción: `gcloud run deploy dashboard-gsmpro-ui --source . --region us-east1 --env-vars-file ../env.yaml --project atomic-box-494614-r5`

### Infraestructura ya construida (No tocar)
- `scripts/sync-competitor-prices.js` — Pipeline multi-proveedor (patrón Strategy). Listo.
- `scripts/sql/raw_layer.competitor_prices.sql` — DDL desplegada en BigQuery.
- `dashboard/src/app/api/inteligencia-mercado/competitividad/route.ts` — API Route lista.
- `dashboard/src/app/inteligencia-mercado/competitividad/page.tsx` — Frontend completo.
- `SERPAPI_KEY` registrada en `.env` y `env.yaml`.

**Arquitectura:**
1. Utilizar **SerpApi** (Google Shopping Cards) para extraer listados de competidores, precios y estado de stock.
2. Cruzar esta información con nuestros precios actuales para determinar nuestro "Índice de Competitividad" (¿Somos más caros o más baratos?).
3. **Escalabilidad (Open Architecture):** Diseñar el código con un patrón de "Proveedores de Scraping", permitiendo que a futuro se conecten otros métodos de tracking de precios (ej. scraping directo, APIs de competidores) sin romper el flujo.

## Fase 3: Tendencias (Google Trends)
**Estado: ⏸️ EN ESPERA — Misma dependencia que Fase 2: Plan SerpApi pago requerido**

### Bloqueo Activo
- **Causa Raíz:** Google Trends no tiene API pública oficial sin autenticación de sesión. Todas las alternativas de npm (`google-trends-api`) han sido bloqueadas por deteción de bots de Google. SerpApi es el proveedor más robusto, pero comparte el mismo plan con la Fase 2.
- **Ventaja:** Actualizar el plan de SerpApi desbloquea Fase 2 Y Fase 3 simultáneamente.
- **Alternativa independiente:** `DataForSEO` (variables ya documentadas en el pipeline).

### Para reanudar cuando se actualice el plan SerpApi
1. Verificar créditos: `node -e "require('dotenv').config({path:'.env'}); fetch('https://serpapi.com/account?api_key='+process.env.SERPAPI_KEY).then(r=>r.json()).then(d=>console.log('Left:', d.total_searches_left))"`
2. Dry-run top 5 marcas: `cd scripts && node sync-market-trends.js --top=5 --dry-run`
3. Sync completo: `node sync-market-trends.js --top=30`
4. Verificar en `http://localhost:3000/inteligencia-mercado/tendencias`
5. Desplegar: `gcloud run deploy dashboard-gsmpro-ui --source . --region us-east1 --env-vars-file ../env.yaml --project atomic-box-494614-r5`

### Infraestructura ya construida (No tocar)
- `scripts/sync-market-trends.js` — Pipeline multi-proveedor con algoritmo de señales (Breakout/Rising/Risk).
- `scripts/sql/raw_layer.market_trends.sql` — DDL desplegada en BigQuery (particionada por fecha, 2 años).
- `dashboard/src/app/api/inteligencia-mercado/tendencias/route.ts` — API Route lista.
- `dashboard/src/app/inteligencia-mercado/tendencias/page.tsx` — Frontend completo con gráfico de líneas y tarjetas de alertas.

**Propuesta de Desarrollo:**
1. Analizar el índice de interés (0 a 100) de nuestras **Marcas o Categorías Top** utilizando una integración con Google Trends (vía API o SerpApi).
2. Cruzar este índice con nuestro inventario:
   - Si la tendencia de una marca sube exponencialmente (Ruptura/Breakout): Sugerir **"Oportunidad de Restock o Campaña Ads"**.
   - Si la tendencia cae sostenidamente: Sugerir **"Riesgo de Inventario Muerto"**.

## Fase 4: Posicionamiento Shopping
**Objetivo:** Integrar y mejorar el rastreo actual del posicionamiento orgánico y pagado en Google Shopping.

**Desarrollo:**
1. Extraer dinámicamente los **Top 50 productos más vendidos** desde nuestra base de datos.
2. Ejecutar un escaneo vía SerpApi 3 veces al día.
3. Crear un **Switch (Pagado / Orgánico)** en el frontend para alternar la visualización del ranking en tiempo real.
4. Migrar el script aislado actual a la arquitectura central (Node.js/Cloud Run) para mayor control y prevención de fallos.
