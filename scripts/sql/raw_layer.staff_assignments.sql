CREATE TABLE IF NOT EXISTS `raw_layer.staff_assignments` (
  assignment_id STRING NOT NULL OPTIONS(description="UUID v4"),
  employee_code STRING NOT NULL OPTIONS(description="FK lógica a shopify_staff"),
  team STRING NOT NULL OPTIONS(description="'management', 'support_ecommerce', 'operations', 'customer_service', 'executive'"),
  role STRING NOT NULL,
  allocation_pct INT64 NOT NULL OPTIONS(description="Porcentaje de dedicación al equipo (1-100). En V1 ignorado por el transformer; reservado para V2."),
  valid_from DATE NOT NULL,
  valid_to DATE,
  is_primary BOOL NOT NULL OPTIONS(description="TRUE para el equipo principal del colaborador. Permite distinguir asignación principal de apoyo temporal a otro equipo."),
  notes STRING,
  created_at TIMESTAMP NOT NULL,
  created_by STRING OPTIONS(description="usuario o sistema que creó la asignación")
)
PARTITION BY valid_from
CLUSTER BY employee_code
OPTIONS(
  description="Asignaciones de team/role con vigencia temporal (SCD-2). Múltiples filas por employee_code permitidas. Filas con valid_to=NULL son vigentes hoy."
);
