ALTER TABLE `{project_id}.ecommerce_data.crisp_conversations`
  ADD COLUMN IF NOT EXISTS people_id STRING,
  ADD COLUMN IF NOT EXISTS channel_origin STRING,
  ADD COLUMN IF NOT EXISTS visitor_nickname STRING,
  ADD COLUMN IF NOT EXISTS visitor_email STRING,
  ADD COLUMN IF NOT EXISTS visitor_phone STRING;
