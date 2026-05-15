CREATE TABLE IF NOT EXISTS `ecommerce_data.crisp_sync_state` (
  sync_id              STRING NOT NULL OPTIONS(description="'crisp_conversations' o 'crisp_messages'"),
  last_processed_at    TIMESTAMP NOT NULL OPTIONS(description="timestamp del último evento procesado (updated_at)"),
  last_session_id      STRING OPTIONS(description="session_id o message_id del último evento"),
  last_run_at          TIMESTAMP NOT NULL OPTIONS(description="cuándo corrió la última sync"),
  records_processed    INT64 NOT NULL OPTIONS(description="total acumulado de registros procesados"),
  last_run_status      STRING NOT NULL OPTIONS(description="'success', 'partial', 'failed'"),
  last_run_error       STRING OPTIONS(description="mensaje de error si falló"),
  updated_at           TIMESTAMP NOT NULL
)
OPTIONS(
  description="Checkpoint de sincronización para los scripts de Crisp."
);
