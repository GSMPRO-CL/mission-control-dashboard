import os
from google.cloud import bigquery

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "atomic-box-494614-r5")
client = bigquery.Client(project=PROJECT_ID)

def check_products_in_bq(products: list) -> list:
    """
    Recibe una lista de diccionarios de productos y verifica su existencia en BigQuery.
    Añade el campo 'estado_db' a cada producto.
    """
    for product in products:
        marca = product.get("marca", "")
        nombre = product.get("producto", "")
        
        query = f"""
        SELECT id, title, vendor 
        FROM `{PROJECT_ID}.ecommerce_data.shopify_products`
        WHERE 
            (LOWER(title) LIKE LOWER(CONCAT('%', @nombre, '%')) OR LOWER(title) LIKE LOWER(CONCAT('%', @marca, '%')))
            AND (LOWER(vendor) LIKE LOWER(CONCAT('%', @marca, '%')) OR LOWER(@marca) LIKE CONCAT('%', LOWER(vendor), '%'))
        LIMIT 1
        """
        
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("nombre", "STRING", nombre),
                bigquery.ScalarQueryParameter("marca", "STRING", marca),
            ]
        )
        
        try:
            query_job = client.query(query, job_config=job_config)
            results = list(query_job.result())
            
            if results:
                product["estado_db"] = "EXISTENTE"
            else:
                product["estado_db"] = "NUEVO LANZAMIENTO"
                
        except Exception as e:
            print(f"Error consultando BQ para {nombre}: {e}")
            product["estado_db"] = "ERROR DB"
            
    return products
