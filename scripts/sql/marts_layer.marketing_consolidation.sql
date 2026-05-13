-- ============================================================================
-- Capa Analítica: Consolidación de Marketing y Tráfico
-- Unifica GA4, Shopify, Yotpo y Klaviyo
-- ============================================================================

-- 1. Vista de Sentimiento de Producto (Yotpo + Shopify)
CREATE OR REPLACE VIEW `ecommerce_data.marts_product_sentiment` AS
WITH product_stats AS (
    SELECT 
        product_id AS sku,
        COUNT(review_id) AS total_reviews,
        AVG(score) AS average_score,
        SUM(votes_up) AS total_helpful_votes
    FROM `ecommerce_data.raw_yotpo_reviews`
    GROUP BY product_id
),
shopify_sales AS (
    SELECT 
        ol.sku,
        p.title AS product_name,
        SUM(ol.quantity) AS total_units_sold,
        SUM(ol.price * ol.quantity) AS gross_revenue
    FROM `ecommerce_data.shopify_order_lines` ol
    LEFT JOIN `ecommerce_data.shopify_products` p ON ol.product_id = p.id
    GROUP BY 1, 2
)
SELECT 
    s.sku,
    s.product_name,
    s.total_units_sold,
    s.gross_revenue,
    COALESCE(y.total_reviews, 0) AS total_reviews,
    COALESCE(y.average_score, 0.0) AS average_score,
    y.total_helpful_votes
FROM shopify_sales s
LEFT JOIN product_stats y ON s.sku = y.sku
ORDER BY s.gross_revenue DESC;

-- 2. Vista de Tráfico y Atribución (GA4 + Klaviyo)
CREATE OR REPLACE VIEW `ecommerce_data.marts_marketing_traffic` AS
WITH daily_ga4 AS (
    SELECT 
        date,
        session_default_channel_group AS channel,
        session_source_medium AS source_medium,
        campaign_name,
        SUM(sessions) AS sessions,
        SUM(conversions) AS conversions,
        SUM(purchase_revenue) AS ga4_revenue
    FROM `ecommerce_data.raw_traffic_ga4`
    GROUP BY 1, 2, 3, 4
),
email_metrics AS (
    SELECT 
        DATE(date) AS date,
        SUM(CASE WHEN metric_name = 'Opened Email' THEN count ELSE 0 END) AS emails_opened,
        SUM(CASE WHEN metric_name = 'Clicked Email' THEN count ELSE 0 END) AS emails_clicked,
        SUM(CASE WHEN metric_name = 'Placed Order' THEN sum_value ELSE 0 END) AS klaviyo_revenue
    FROM `ecommerce_data.klaviyo_metrics`
    GROUP BY 1
)
SELECT 
    g.date,
    g.channel,
    g.source_medium,
    g.campaign_name,
    g.sessions,
    g.conversions,
    g.ga4_revenue,
    CASE 
        WHEN g.channel = 'Email' THEN e.emails_opened 
        ELSE NULL 
    END AS related_emails_opened,
    CASE 
        WHEN g.channel = 'Email' THEN e.emails_clicked 
        ELSE NULL 
    END AS related_emails_clicked,
    CASE 
        WHEN g.channel = 'Email' THEN e.klaviyo_revenue 
        ELSE NULL 
    END AS related_klaviyo_revenue
FROM daily_ga4 g
LEFT JOIN email_metrics e ON g.date = e.date AND g.channel = 'Email';
