-- Tabla para almacenar el índice de interés de Google Trends por marca/categoría.
-- La tabla es histórica: cada ejecución del pipeline agrega nuevas filas (no reemplaza).
-- Esto permite construir series temporales y detectar tendencias a largo plazo.
-- Arquitectura multi-proveedor: campo `data_source` identifica el origen de los datos.

CREATE TABLE IF NOT EXISTS `atomic-box-494614-r5.ecommerce_data.market_trends` (
  -- Identificadores
  record_id       STRING    NOT NULL OPTIONS(description="UUID único de este punto de datos"),
  keyword         STRING    NOT NULL OPTIONS(description="Término analizado (marca, categoría o producto)"),
  keyword_type    STRING    NOT NULL OPTIONS(description="Tipo: 'brand', 'category', 'product'"),
  geo             STRING    NOT NULL OPTIONS(description="Código de país ISO-2 (ej: 'CL')"),

  -- Datos de tendencia
  trend_date      DATE      NOT NULL OPTIONS(description="Fecha a la que corresponde el valor de interés"),
  interest_value  INT64     NOT NULL OPTIONS(description="Índice de interés de 0 a 100 (Google Trends)"),
  is_partial      BOOL               OPTIONS(description="TRUE si el punto de datos es parcial (semana en curso)"),

  -- Señales calculadas por el pipeline
  signal          STRING             OPTIONS(description="Señal: 'breakout', 'rising', 'stable', 'falling', 'risk'"),
  signal_detail   STRING             OPTIONS(description="Descripción legible de la señal generada"),

  -- Cruce con inventario
  vendor_products INT64              OPTIONS(description="Cantidad de productos activos de esta marca en nuestro catálogo"),
  avg_stock       FLOAT64            OPTIONS(description="Promedio de inventario disponible de esta marca"),

  -- Metadatos
  data_source     STRING    NOT NULL OPTIONS(description="Proveedor: 'serpapi_trends', 'dataforseo_trends', etc."),
  synced_at       TIMESTAMP NOT NULL OPTIONS(description="Fecha y hora de ingesta")
)
PARTITION BY trend_date
CLUSTER BY keyword, geo
OPTIONS(
  description="Índice de interés de Google Trends por marca/categoría con señales de oportunidad y riesgo.",
  partition_expiration_days=730
);
