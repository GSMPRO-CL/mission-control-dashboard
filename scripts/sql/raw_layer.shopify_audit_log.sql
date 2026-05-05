CREATE TABLE IF NOT EXISTS `raw_layer.shopify_audit_log` (
  audit_id STRING NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  staff_id STRING,
  staff_email STRING,
  action STRING NOT NULL OPTIONS(description="'create', 'update', 'delete', 'publish'"),
  subject_type STRING NOT NULL OPTIONS(description="'Product', 'Collection', 'Page', 'Article', 'Theme'"),
  subject_id STRING NOT NULL,
  ip_address STRING,
  user_agent STRING,
  raw_payload JSON,
  ingested_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(occurred_at)
CLUSTER BY staff_id, subject_type
OPTIONS(
  description="Eventos crudos de Audit Log",
  partition_expiration_days=730
);
