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
        
        # Escapar comillas simples para evitar inyección SQL básica
        marca_safe = marca.replace("'", "\\'")
        nombre_safe = nombre.replace("'", "\\'")
        
        # Lógica de match: similitud en title y vendor
        # Buscamos si la marca y el nombre están contenidos en el título o vendedor
        query = f"""
        SELECT id, title, vendor 
        FROM `{PROJECT_ID}.ecommerce_data.shopify_products`
        WHERE 
            (LOWER(title) LIKE LOWER('%{nombre_safe}%') OR LOWER(title) LIKE LOWER('%{marca_safe}%'))
            AND (LOWER(vendor) LIKE LOWER('%{marca_safe}%') OR LOWER('{marca_safe}') LIKE CONCAT('%', LOWER(vendor), '%'))
        LIMIT 1
        """
        
        try:
            query_job = client.query(query)
            results = list(query_job.result())
            
            if results:
                product["estado_db"] = "EXISTENTE"
            else:
                product["estado_db"] = "NUEVO LANZAMIENTO"
                
        except Exception as e:
            print(f"Error consultando BQ para {nombre}: {e}")
            product["estado_db"] = "ERROR DB"
            
    return products
