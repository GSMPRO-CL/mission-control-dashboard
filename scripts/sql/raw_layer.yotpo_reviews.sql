-- Definición de la tabla raw_yotpo_reviews
CREATE TABLE IF NOT EXISTS `ecommerce_data.raw_yotpo_reviews` (
    review_id INT64 NOT NULL,
    product_id STRING,
    score INT64,
    votes_up INT64,
    votes_down INT64,
    content STRING,
    title STRING,
    created_at TIMESTAMP,
    verified_buyer BOOLEAN,
    status STRING,
    _ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
OPTIONS(
    description="Tabla cruda con reseñas individuales extraídas de Yotpo",
    require_partition_filter=false
);
