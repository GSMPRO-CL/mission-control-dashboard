CREATE TABLE IF NOT EXISTS `raw_layer.shopify_snapshots` (
  snapshot_date DATE NOT NULL,
  resource_type STRING NOT NULL OPTIONS(description="'product', 'collection', 'page', 'article'"),
  resource_id STRING NOT NULL,
  resource_handle STRING,
  title STRING,
  meta_title STRING,
  meta_description STRING,
  tags ARRAY<STRING>,
  collection_ids ARRAY<STRING>,
  body_html_hash STRING OPTIONS(description="SHA-256 de bodyHtml"),
  status STRING,
  vendor STRING,
  product_type STRING,
  shopify_updated_at TIMESTAMP,
  raw_fields JSON,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY snapshot_date
CLUSTER BY resource_type, resource_id
OPTIONS(
  description="Estado diario de recursos modificados",
  partition_expiration_days=365
);
