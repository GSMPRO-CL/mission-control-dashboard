-- Vista que enriquece audit_log con employee_code mediante join con shopify_staff.
-- Si staff_id no matchea ningún staff registrado, employee_code será 'unknown' y debe revisarse manualmente.
CREATE OR REPLACE VIEW `<proyecto>.raw_layer.v_audit_log_enriched` AS
SELECT 
  a.audit_id,
  a.occurred_at,
  a.staff_id,
  COALESCE(s.employee_code, 'unknown') AS employee_code,
  COALESCE(s.email, a.staff_email) AS staff_email,
  CONCAT(IFNULL(s.first_name, ''), ' ', IFNULL(s.last_name, '')) AS staff_full_name,
  a.action,
  a.subject_type,
  a.subject_id,
  a.ingested_at,
  a.raw_payload
FROM `<proyecto>.raw_layer.shopify_audit_log` a
LEFT JOIN `<proyecto>.raw_layer.shopify_staff` s
  ON a.staff_id = s.staff_id;
