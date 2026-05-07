-- Tabla para almacenar el monitor de precios de la competencia por producto.
-- Alimentada por el pipeline sync-competitor-prices.js usando SerpApi (Google Shopping).
-- La arquitectura de proveedores permite añadir fuentes adicionales en el futuro
-- sin modificar esta tabla (campo `data_source` identifica el origen).

CREATE TABLE IF NOT EXISTS `atomic-box-494614-r5.ecommerce_data.competitor_prices` (
  -- Identificadores
  record_id         STRING    NOT NULL OPTIONS(description="UUID único de este registro de competidor"),
  product_id        INT64     NOT NULL OPTIONS(description="ID del producto en Shopify"),
  product_title     STRING    NOT NULL OPTIONS(description="Título del producto en nuestro catálogo"),
  vendor            STRING             OPTIONS(description="Marca/Proveedor del producto"),
  keyword_searched  STRING             OPTIONS(description="Término de búsqueda usado para encontrar competidores"),

  -- Datos de nuestro producto
  our_price         FLOAT64   NOT NULL OPTIONS(description="Nuestro precio promedio de variantes activas"),

  -- Datos del competidor
  competitor_name   STRING             OPTIONS(description="Nombre de la tienda competidora"),
  competitor_title  STRING             OPTIONS(description="Título del producto del competidor"),
  competitor_price  FLOAT64            OPTIONS(description="Precio del competidor en la misma moneda"),
  has_stock         BOOL               OPTIONS(description="TRUE si el competidor tiene stock disponible"),
  competitor_url    STRING             OPTIONS(description="URL del producto en la tienda del competidor"),
  thumbnail_url     STRING             OPTIONS(description="URL de la imagen del producto del competidor"),

  -- Análisis de competitividad
  price_diff_amount FLOAT64            OPTIONS(description="Diferencia absoluta de precio (nuestro - competidor). Negativo = somos más caros"),
  price_diff_pct    FLOAT64            OPTIONS(description="Diferencia porcentual vs competidor. Negativo = somos más caros"),
  is_competitive    BOOL               OPTIONS(description="TRUE si nuestro precio es igual o menor al del competidor"),

  -- Metadatos
  data_source       STRING    NOT NULL OPTIONS(description="Proveedor de datos: 'serpapi_shopping', 'scraping_directo', etc."),
  synced_at         TIMESTAMP NOT NULL OPTIONS(description="Fecha y hora de la última sincronización")
)
PARTITION BY DATE(synced_at)
CLUSTER BY product_id, competitor_name
OPTIONS(
  description="Monitor de precios de la competencia por producto. Arquitectura multi-proveedor.",
  partition_expiration_days=90
);
