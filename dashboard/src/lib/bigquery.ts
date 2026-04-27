import { BigQuery } from '@google-cloud/bigquery';

export const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
});

export const DATASET_ID = 'ecommerce_data';
