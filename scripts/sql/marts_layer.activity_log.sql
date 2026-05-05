CREATE TABLE IF NOT EXISTS `marts_layer.activity_log` (
  activity_id STRING NOT NULL OPTIONS(description="UUID"),
  occurred_at TIMESTAMP NOT NULL,
  employee_code STRING OPTIONS(description="NULL si no hay atribución"),
  team STRING,
  activity_type STRING NOT NULL OPTIONS(description="Valores permitidos: product_creation, product_seo_meta_update, product_tag_update, product_image_update, product_description_update, product_general_update, collection_creation, collection_update, page_creation, page_update, blog_post_creation, blog_post_update, theme_edit"),
  resource_type STRING NOT NULL,
  resource_id STRING NOT NULL,
  resource_handle STRING,
  resource_title STRING,
  fields_changed ARRAY<STRING>,
  source STRING NOT NULL OPTIONS(description="'audit_log', 'webhook', 'snapshot_diff'"),
  confidence STRING NOT NULL OPTIONS(description="'high', 'medium', 'low'"),
  metadata JSON,
  built_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(occurred_at)
CLUSTER BY employee_code, activity_type
OPTIONS(
  description="Tabla unificada que alimenta el dashboard"
);
