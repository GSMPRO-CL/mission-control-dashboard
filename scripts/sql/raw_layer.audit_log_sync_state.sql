CREATE TABLE IF NOT EXISTS `raw_layer.audit_log_sync_state` (
  sync_id STRING NOT NULL OPTIONS(description="'audit_log_main' (singleton inicial)"),
  last_processed_at TIMESTAMP NOT NULL OPTIONS(description="timestamp del último evento procesado"),
  last_event_id STRING OPTIONS(description="audit_id del último evento"),
  last_run_at TIMESTAMP NOT NULL OPTIONS(description="cuándo corrió la última sync"),
  events_processed INT64 NOT NULL OPTIONS(description="total acumulado de eventos procesados"),
  last_run_status STRING NOT NULL OPTIONS(description="'success', 'partial', 'failed'"),
  last_run_error STRING OPTIONS(description="mensaje de error si falló"),
  updated_at TIMESTAMP NOT NULL
)
OPTIONS(
  description="Checkpoint de sincronización para el puller de Shopify Audit Log."
);
