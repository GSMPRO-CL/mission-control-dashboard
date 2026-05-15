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

duplicate_pairs AS (
  SELECT
    a.people_id,
    a.session_id AS session_a,
    b.session_id AS session_b,
    a.channel_origin AS channel_a,
    b.channel_origin AS channel_b,
    a.created_at AS created_at_a,
    b.created_at AS created_at_b,
    a.visitor_nickname,
    a.visitor_email
  FROM identified_conversations a
  JOIN identified_conversations b
    ON a.people_id = b.people_id
    AND a.channel_origin != b.channel_origin
    AND a.session_id < b.session_id
    AND ABS(TIMESTAMP_DIFF(a.created_at, b.created_at, HOUR)) <= 48
),

duplicate_users AS (
  SELECT
    people_id,
    ANY_VALUE(visitor_nickname) AS visitor_nickname,
    ANY_VALUE(visitor_email) AS visitor_email,
    ARRAY_AGG(DISTINCT channel ORDER BY channel) AS channels_used,
    COUNT(DISTINCT channel) AS distinct_channels,
    MIN(earliest) AS first_contact,
    MAX(latest) AS last_contact,
    ARRAY_AGG(session_id ORDER BY session_created_at DESC LIMIT 1)[OFFSET(0)] AS latest_session_id
  FROM (
    SELECT people_id, visitor_nickname, visitor_email,
           channel_a AS channel, created_at_a AS earliest, created_at_b AS latest,
           session_a AS session_id, created_at_a AS session_created_at
    FROM duplicate_pairs
    UNION ALL
    SELECT people_id, visitor_nickname, visitor_email,
           channel_b AS channel, created_at_a AS earliest, created_at_b AS latest,
           session_b AS session_id, created_at_b AS session_created_at
    FROM duplicate_pairs
  )
  GROUP BY people_id
)

SELECT * FROM duplicate_users;
