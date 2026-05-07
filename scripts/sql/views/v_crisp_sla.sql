CREATE OR REPLACE VIEW `atomic-box-494614-r5.ecommerce_data.v_crisp_sla` AS
WITH UserFirstMessage AS (
  SELECT 
    session_id, 
    MIN(created_at) as first_user_msg_at
  FROM `atomic-box-494614-r5.ecommerce_data.crisp_messages`
  WHERE sender_type = 'user'
  GROUP BY session_id
),
OperatorFirstMessage AS (
  SELECT 
    session_id, 
    MIN(created_at) as first_operator_msg_at,
    MAX(operator_name) as primary_operator -- Asumimos que el principal responde la primera vez o más
  FROM `atomic-box-494614-r5.ecommerce_data.crisp_messages`
  WHERE sender_type = 'operator'
  GROUP BY session_id
)
SELECT 
  c.session_id,
  c.created_at as ticket_created_at,
  c.status,
  c.rating_value as csat_score,
  c.rating_comment,
  u.first_user_msg_at,
  o.first_operator_msg_at,
  o.primary_operator as operator_name,
  -- Time To First Response (TTFR) en Minutos
  TIMESTAMP_DIFF(o.first_operator_msg_at, u.first_user_msg_at, MINUTE) as ttfr_minutes
FROM `atomic-box-494614-r5.ecommerce_data.crisp_conversations` c
LEFT JOIN UserFirstMessage u ON c.session_id = u.session_id
LEFT JOIN OperatorFirstMessage o ON c.session_id = o.session_id;
