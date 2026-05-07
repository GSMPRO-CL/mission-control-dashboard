# 🗺️ Roadmap de Desarrollo: GSMPRO Dashboard

Este documento sirve como plano arquitectónico del desarrollo modular del proyecto, mapeando qué áreas están operativas en producción, cuáles están en desarrollo, y cuáles están pendientes.

---

## 🟢 Módulos Completados (En Producción)
*Tienen ingesta de datos automática (BigQuery) y visualización conectada en Next.js.*

- [x] **Ventas / KPIs** (Ingresos, Pedidos, AOV, Modelos Financieros Base).
- [x] **Ventas / Productos** (Análisis de Top Productos y Marcas cruzado con SEO).
- [x] **Inteligencia de Mercado** (Agente autónomo de IA Python/Gemini con exclusión histórica y UI Premium).
- [x] **Tráfico / General** (Google Analytics / Shopify Traffic Metrics).
- [x] **Tráfico / Orgánico** (Integración robusta con Google Search Console).
- [x] **Tráfico / Pagado (Google Ads)** (Integración OAuth2 offline y tableros GAQL).
- [x] **Equipo / Actividad** (Motor Audit Log Puller con modelo SCD-2 de asignación).
- [x] **Customer Services (Soporte)** (Extracción NLP Crisp, SLA y Rendimiento de Agentes).

---

## 🟠 Módulos Bloqueados por Dependencia Externa
*Arquitectura y código 100% listos. En espera de aprobación o acceso externo.*

- [ ] **Inteligencia de Mercado / Dimensión de Mercado** ⏸️
  - [x] Tabla BigQuery `market_size_metrics` creada.
  - [x] Pipeline `sync-market-size.js` construido.
  - [x] API Route y Frontend (Treemap + Ranking) listos.
  - [ ] **Bloqueado:** Google Ads Basic Access pendiente de aprobación. Ver `MARKET_INTELLIGENCE_SPECS.md` Fase 1.

- [ ] **Inteligencia de Mercado / Competitividad** ⏸️
  - [x] Tabla BigQuery `competitor_prices` creada (particionada, multi-proveedor).
  - [x] Pipeline `sync-competitor-prices.js` con patrón Strategy construido.
  - [x] API Route y Frontend (Monitor de precios con códigos de color) listos.
  - [x] `SERPAPI_KEY` registrada en `.env` y `env.yaml`.
  - [ ] **Bloqueado:** Plan SerpApi Free agotado (250/mes). Requiere plan pago para ejecutar sync.

- [ ] **Inteligencia de Mercado / Tendencias** ⏸️
  - [x] Tabla BigQuery `market_trends` creada (histórica, particionada 2 años).
  - [x] Pipeline `sync-market-trends.js` con patrón Strategy y algoritmo de señales construido.
  - [x] API Route y Frontend (gráfico de líneas + tarjetas Breakout/Rising/Risk) listos.
  - [ ] **Bloqueado:** Mismo plan SerpApi que Fase 2. Actualizar plan desbloquea ambas fases.

---

## 🟡 Módulos Parciales / En Progreso
*Tienen data parcial en BD, o maquetado inicial en la UI, pero requieren integraciones profundas.*

- [ ] **Tráfico / Pagado (Meta Ads)**
  - [ ] Integración Graph API y panel de ROAS comparativo.
- [ ] **Marketing (Email, Ads)**
  - [ ] Integración con Klaviyo API para Atribución de Email Marketing.

---

## 🔴 Módulos Críticos Pendientes (Roadmap Futuro)
*Áreas totalmente ausentes en backend y frontend. Requerirán modelado de datos desde cero.*

- [ ] **Finanzas**
  - [ ] Estado de Resultados (P&L), Ingresos netos, Costos de Mercadería (COGS).
  - [ ] Rastreo de Gastos Fijos y Costos Operacionales.
- [ ] **Compras**
  - [ ] Generación y Tracking de Órdenes de Compra (PO).
  - [ ] Rendimiento y calidad de Proveedores.
- [ ] **Operaciones**
  - [ ] Control Dinámico de Inventario y Cobertura de Stock.
  - [ ] Costos y tiempos de Fulfillment.
  - [ ] Tasa de Devoluciones por SKU.
- [ ] **Clientes**
  - [ ] Segmentación Cohorte y Retención (LTV - Lifetime Value).
  - [ ] Clientes VIP vs One-time buyers.
- [ ] **Configuración Core**
  - [ ] Panel Admin de gestión de usuarios y accesos (RBAC).
  - [ ] Centro de control de Webhooks y APIs.
