-- Vista: Resumen diario de ventas para el módulo de Resumen
-- Consolida métricas de órdenes diarias ya pre-agregadas
CREATE OR REPLACE VIEW `{project}.ecommerce_data.v_ventas_daily_summary` AS
SELECT
  DATE(created_at) AS sale_date,
  -- Métricas brutas
  COUNT(id) AS gross_orders,
  SUM(total_price) AS gross_sales,
  SUM(total_discounts) AS total_discounts,
  -- Métricas netas (solo paid/partially_refunded)
  COUNT(CASE WHEN financial_status IN ('paid', 'partially_refunded') THEN id END) AS net_orders,
  SUM(CASE WHEN financial_status IN ('paid', 'partially_refunded') THEN total_price ELSE 0 END) AS net_sales,
  -- Distribución de estados
  COUNTIF(financial_status = 'paid') AS paid_count,
  COUNTIF(financial_status = 'pending') AS pending_count,
  COUNTIF(financial_status = 'refunded') AS refunded_count,
  COUNTIF(financial_status = 'partially_refunded') AS partially_refunded_count,
  COUNTIF(financial_status NOT IN ('paid', 'pending', 'refunded', 'partially_refunded')) AS other_count
FROM `{project}.ecommerce_data.shopify_orders`
GROUP BY sale_date;
