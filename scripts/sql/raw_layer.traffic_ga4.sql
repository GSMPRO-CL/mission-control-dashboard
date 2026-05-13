-- Definición de la tabla raw_traffic_ga4
CREATE TABLE IF NOT EXISTS `ecommerce_data.raw_traffic_ga4` (
    date DATE NOT NULL,
    session_default_channel_group STRING,
    session_source_medium STRING,
    campaign_name STRING,
    sessions INT64,
    total_users INT64,
    new_users INT64,
    engagement_rate FLOAT64,
    average_session_duration FLOAT64,
    conversions INT64,
    ecommerce_purchases INT64,
    purchase_revenue FLOAT64,
    add_to_carts INT64,
    _ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
OPTIONS(
    description="Tabla cruda con métricas diarias de tráfico y e-commerce extraídas de Google Analytics 4 (GA4)",
    require_partition_filter=false
);
