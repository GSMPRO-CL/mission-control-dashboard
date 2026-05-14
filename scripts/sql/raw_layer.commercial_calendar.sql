CREATE TABLE IF NOT EXISTS `raw_layer.commercial_calendar` (
  id STRING OPTIONS(description="Identificador único del evento o lanzamiento"),
  event_name STRING OPTIONS(description="Nombre del evento (ej. Cyber Monday, Lanzamiento iPhone 17)"),
  event_type STRING OPTIONS(description="Tipo de evento: Comercial (para ventas) o Launch (Lanzamiento de producto)"),
  event_date DATE OPTIONS(description="Fecha exacta o estimada del evento"),
  description STRING OPTIONS(description="Descripción del impacto comercial o especificaciones del producto"),
  source STRING OPTIONS(description="Fuente de la información (Noticia, anuncio oficial, etc)"),
  created_at TIMESTAMP OPTIONS(description="Fecha en que se insertó o actualizó el evento en la base de datos")
);
