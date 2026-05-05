CREATE TABLE IF NOT EXISTS `ecommerce_data.shopify_traffic_daily` (
  date DATE NOT NULL,
  total_sessions INT64,
  unique_visitors INT64,
  pageviews INT64,
  bounce_rate FLOAT64
)
PARTITION BY date
OPTIONS(
  description="Daily traffic metrics for Shopify store (to be synced via GA4 or Shopify API)"
);
