-- Vista que une cada actividad con la asignación de equipo/rol vigente al momento del evento. 
-- En V1 solo considera asignaciones primary; cuando V2 implemente atribución fraccionaria por allocation_pct, 
-- esta vista se reemplazará por una versión que multiplique filas por allocation.

CREATE OR REPLACE VIEW `marts_layer.v_activity_with_team` AS
SELECT 
  a.activity_id,
  a.occurred_at,
  a.employee_code,
  s.team,
  s.role,
  s.is_primary,
  s.allocation_pct,
  a.activity_type,
  a.resource_type,
  a.resource_id,
  a.resource_handle,
  a.resource_title,
  a.fields_changed,
  a.source,
  a.confidence,
  a.metadata
FROM `marts_layer.activity_log` a
LEFT JOIN `raw_layer.staff_assignments` s
  ON a.employee_code = s.employee_code
  AND DATE(a.occurred_at) >= s.valid_from
  AND (s.valid_to IS NULL OR DATE(a.occurred_at) <= s.valid_to)
  AND s.is_primary = TRUE
;
