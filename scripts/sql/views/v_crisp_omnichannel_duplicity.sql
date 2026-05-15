CREATE OR REPLACE VIEW `{project_id}.ecommerce_data.v_crisp_omnichannel_duplicity` AS

WITH identified_conversations AS (
  SELECT
    session_id,
    people_id,
    channel_origin,
    created_at,
    visitor_nickname,
    visitor_email
  FROM `{project_id}.ecommerce_data.crisp_conversations`
  WHERE people_id IS NOT NULL
    AND channel_origin IS NOT NULL
),

user_sessions AS (
  SELECT
    people_id,
    ANY_VALUE(visitor_nickname) as visitor_nickname,
    ANY_VALUE(visitor_email) as visitor_email,
    ARRAY_AGG(STRUCT(channel_origin as channel, created_at, session_id) ORDER BY created_at ASC) as sessions,
    COUNT(DISTINCT channel_origin) as distinct_channels
  FROM identified_conversations
  GROUP BY people_id
),

duplicity_calc AS (
  SELECT
    people_id,
    visitor_nickname,
    visitor_email,
    distinct_channels,
    sessions[OFFSET(0)].created_at as first_contact,
    (SELECT created_at FROM UNNEST(sessions) s WHERE s.channel != sessions[OFFSET(0)].channel ORDER BY created_at ASC LIMIT 1) as second_channel_contact,
    (SELECT session_id FROM UNNEST(sessions) s ORDER BY created_at DESC LIMIT 1) as latest_session_id,
    ARRAY(SELECT DISTINCT s.channel FROM UNNEST(sessions) s ORDER BY s.channel) as channels_used
  FROM user_sessions
  WHERE distinct_channels >= 2
)

SELECT
  people_id,
  visitor_nickname,
  visitor_email,
  channels_used,
  distinct_channels,
  first_contact,
  second_channel_contact,
  TIMESTAMP_DIFF(second_channel_contact, first_contact, HOUR) as hours_to_second_channel,
  latest_session_id
FROM duplicity_calc
WHERE TIMESTAMP_DIFF(second_channel_contact, first_contact, HOUR) <= 48;
