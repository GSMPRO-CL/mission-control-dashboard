CREATE TABLE IF NOT EXISTS `raw_layer.shopping_position` (
  keyword STRING OPTIONS(description="Palabra clave buscada, derivada del nombre del producto"),
  product_id INT64 OPTIONS(description="ID del producto de Shopify"),
  scan_date DATE OPTIONS(description="Fecha del escaneo"),
  scan_hour INT64 OPTIONS(description="Hora del escaneo (0-23)"),
  organic_position INT64 OPTIONS(description="Posición en resultados orgánicos (null si no aparece)"),
  paid_position INT64 OPTIONS(description="Posición en resultados pagados (null si no aparece)"),
  top_competitor_name STRING OPTIONS(description="Nombre del competidor con mejor posición o precio"),
  top_competitor_price FLOAT64 OPTIONS(description="Precio del principal competidor"),
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS(description="Timestamp exacto del scrapeo")
)
PARTITION BY scan_date
CLUSTER BY product_id, keyword;
