-- Tabla para almacenar el historial de posicionamiento en Google Shopping.
-- Alimentada por el Cloud Run Job gsmpro-scraper-job (r-posicionamiento).
-- Cada ejecución genera una nueva snapshot identificada por run_id.
--
-- Schedulers:
--   Orgánico: 07:00, 12:00, 17:00 (America/Santiago)
--   Pagado:   08:00, 13:00, 18:00 (America/Santiago)

CREATE TABLE IF NOT EXISTS `atomic-box-494614-r5.ecommerce_data.shopping_positions` (
  -- Identificadores de ejecución
  run_id          STRING    NOT NULL OPTIONS(description="UUID de la ejecución. Agrupa todos los keywords de una misma corrida."),
  run_type        STRING    NOT NULL OPTIONS(description="Tipo de disparo: 'scheduled' o 'manual'"),
  ad_type         STRING    NOT NULL OPTIONS(description="Tipo de ficha monitoreada: 'paid' (patrocinada) o 'organic'"),

  -- Keyword y posicionamiento
  keyword         STRING    NOT NULL OPTIONS(description="Término de búsqueda exacto usado en Google Shopping"),
  gsmpro_position INT64              OPTIONS(description="Posición de GSMPRO en resultados (1=top). NULL si no aparece."),
  gsmpro_appeared BOOL      NOT NULL OPTIONS(description="TRUE si GSMPRO apareció en los resultados"),
  gsmpro_title    STRING             OPTIONS(description="Título exacto del producto de GSMPRO encontrado"),
  gsmpro_price    STRING             OPTIONS(description="Precio del producto de GSMPRO tal como aparece en Shopping"),

  -- Competidor en esa posición (Top 5 se almacena como filas separadas)
  competitor_rank    INT64           OPTIONS(description="Posición del competidor (1-5)"),
  competitor_name    STRING          OPTIONS(description="Nombre de la tienda competidora"),
  competitor_title   STRING          OPTIONS(description="Título del producto del competidor"),
  competitor_price   STRING          OPTIONS(description="Precio del producto del competidor"),
  is_exact_match     BOOL            OPTIONS(description="TRUE si el título del competidor coincide exactamente con el keyword"),

  -- Metadatos temporales
  scanned_at      TIMESTAMP NOT NULL OPTIONS(description="Timestamp exacto del escaneo (zona horaria UTC)"),
  scan_date       DATE      NOT NULL OPTIONS(description="Fecha del escaneo (para partición)")
)
PARTITION BY scan_date
CLUSTER BY ad_type, keyword
OPTIONS(
  description="Historial de posicionamiento en Google Shopping. Pagado y orgánico en ejecuciones separadas.",
  partition_expiration_days=365
);
