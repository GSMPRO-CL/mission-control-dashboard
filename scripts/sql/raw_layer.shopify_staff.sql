CREATE TABLE IF NOT EXISTS `raw_layer.shopify_staff` (
  staff_id STRING NOT NULL OPTIONS(description="Shopify internal ID"),
  email STRING NOT NULL,
  first_name STRING,
  last_name STRING,
  employee_code STRING NOT NULL OPTIONS(description="Código interno: 'juan.perez'"),
  active BOOL NOT NULL,
  joined_at DATE,
  left_at DATE,
  updated_at TIMESTAMP NOT NULL
)
OPTIONS(
  description="Catálogo de staff de Shopify"
);
