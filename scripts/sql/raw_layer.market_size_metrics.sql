-- Tabla para almacenar las métricas de Market Size y Market Share por producto
-- Calculadas a partir del volumen de búsqueda de Google Ads y el precio promedio de Shopify.
-- Se actualiza mediante MERGE (upsert) para mantener el historial más reciente.

CREATE TABLE IF NOT EXISTS `atomic-box-494614-r5.ecommerce_data.market_size_metrics` (
  product_id          INT64     NOT NULL OPTIONS(description="ID del producto en Shopify"),
  product_title       STRING    NOT NULL OPTIONS(description="Título completo del producto"),
  vendor              STRING             OPTIONS(description="Marca/Proveedor del producto"),
  keyword             STRING             OPTIONS(description="Keyword principal extraída del título"),
  avg_price           FLOAT64            OPTIONS(description="Precio promedio de todas las variantes activas"),
  avg_monthly_searches INT64             OPTIONS(description="Volumen promedio mensual de búsqueda (Google Ads KPI)"),
  last_month_searches INT64             OPTIONS(description="Volumen de búsqueda del último mes disponible"),
  avg_potential_buyers FLOAT64           OPTIONS(description="Compradores potenciales promedio (searches * 1%)"),
  last_month_buyers   FLOAT64            OPTIONS(description="Compradores potenciales último mes (searches * 1%)"),
  market_size_avg     FLOAT64            OPTIONS(description="Tamaño de mercado promedio (buyers_avg * avg_price)"),
  market_size_last    FLOAT64            OPTIONS(description="Tamaño de mercado último mes (buyers_last * avg_price)"),
  market_share_avg    FLOAT64            OPTIONS(description="Cuota de mercado estimada promedio (market_size_avg * 5%)"),
  market_share_last   FLOAT64            OPTIONS(description="Cuota de mercado estimada último mes (market_size_last * 5%)"),
  synced_at           TIMESTAMP NOT NULL OPTIONS(description="Fecha y hora de la última sincronización")
)
OPTIONS(
  description="Métricas de Market Size y Market Share calculadas por producto usando volumen de búsqueda de Google Ads."
);
