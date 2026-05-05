import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Configure BigQuery client
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
const DATASET_ID = 'raw_layer';

// GraphQL query to fetch staff members
const QUERY_STAFF = `
  query getStaff($cursor: String) {
    staffMembers(first: 50, after: $cursor) {
      edges {
        node {
          id
          email
          firstName
          lastName
          active
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

function normalizeStaffId(gid: string | null) {
  if (!gid) return null;
  const match = gid.match(/\/StaffMember\/(\d+)$/);
  return match ? match[1] : gid;
}

function deriveEmployeeCode(email: string | null, firstName: string | null, lastName: string | null) {
  if (firstName && lastName) {
    const fn = firstName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
    const ln = lastName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
    return `${fn}.${ln}`;
  }
  if (email) {
    return email.split('@')[0].toLowerCase();
  }
  return `unknown.${Date.now()}`;
}

async function fetchShopifyStaff() {
  const staff = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res: Response = await fetch(`https://${process.env.SHOPIFY_DOMAIN}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_API_TOKEN || '',
      },
      body: JSON.stringify({
        query: QUERY_STAFF,
        variables: { cursor },
      }),
    });

    const json = await res.json();

    if (json.errors) {
      throw new Error(`Shopify GraphQL Error: ${JSON.stringify(json.errors)}`);
    }

    const connection = json.data.staffMembers;
    for (const edge of connection.edges) {
      const node = edge.node;
      staff.push({
        staff_id: normalizeStaffId(node.id) || '',
        email: node.email || '',
        first_name: node.firstName || '',
        last_name: node.lastName || '',
        employee_code: deriveEmployeeCode(node.email, node.firstName, node.lastName) || '',
        active: node.active === true,
        updated_at: new Date().toISOString()
      });
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  return staff;
}

export async function GET(request: Request) {
  try {
    // 1. Security Check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET_TOKEN;
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch data from Shopify
    const staffData = await fetchShopifyStaff();
    
    if (staffData.length === 0) {
      return NextResponse.json({ status: 'success', message: 'No staff members found in Shopify.' });
    }

    // 3. Upsert data to BigQuery using UNNEST (Serverless approach)
    // We use a parameterized query to inject the array of structs directly into BigQuery.
    const query = `
      MERGE \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_staff\` T
      USING UNNEST(@staff_array) S
      ON T.staff_id = S.staff_id
      WHEN MATCHED THEN
        UPDATE SET 
          email = S.email,
          first_name = S.first_name,
          last_name = S.last_name,
          active = S.active,
          updated_at = TIMESTAMP(S.updated_at)
      WHEN NOT MATCHED THEN
        INSERT (staff_id, email, first_name, last_name, employee_code, active, updated_at)
        VALUES (S.staff_id, S.email, S.first_name, S.last_name, S.employee_code, S.active, TIMESTAMP(S.updated_at))
    `;

    const options = {
      query: query,
      params: { staff_array: staffData },
    };

    const [job] = await bq.createQueryJob(options);
    await job.promise();

    return NextResponse.json({
      status: 'success',
      staff_processed: staffData.length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error syncing staff:', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        details: error.message,
        cause: error.cause ? String(error.cause) : undefined,
        domain: process.env.SHOPIFY_DOMAIN,
        token_preview: process.env.SHOPIFY_API_TOKEN ? process.env.SHOPIFY_API_TOKEN.substring(0, 5) : 'missing'
      },
      { status: 500 }
    );
  }
}
