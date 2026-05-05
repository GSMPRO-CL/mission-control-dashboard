const { shopifyGraphQL } = require('./scripts/lib/shopify-graphql');
const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const q = `query PullEvents($cursor: String) {
  events(first: 250, sortKey: CREATED_AT, reverse: true, after: $cursor) {
    edges {
      node {
        id createdAt action message appTitle attributeToApp attributeToUser criticalAlert
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function run() {
  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  const [rows] = await bq.query('SELECT staff_id, first_name, last_name, email, CONCAT(first_name, " ", last_name) as full_name FROM `raw_layer.shopify_staff`');
  const staffList = rows;

  function extractStaffId(node, staffList) {
    const gidMatch = node.id.match(/staff_member_id=(\d+)/);
    if (gidMatch) return gidMatch[1];
    if (node.message) {
      const msg = node.message.toLowerCase();
      let extractedName = null;
      const aTagMatch = node.message.match(/<a[^>]*>(.*?)<\/a>/);
      if (aTagMatch) extractedName = aTagMatch[1].trim().toLowerCase();
      for (const staff of staffList) {
        if (staff.full_name && msg.includes(staff.full_name.toLowerCase())) return staff.staff_id;
        if (extractedName && staff.full_name && extractedName.includes(staff.first_name.toLowerCase()) && extractedName.includes(staff.last_name.toLowerCase())) return staff.staff_id;
        if (staff.first_name && staff.last_name && msg.includes(staff.first_name.toLowerCase()) && msg.includes(staff.last_name.toLowerCase())) return staff.staff_id;
      }
    }
    return null;
  }

  let hasNextPage = true;
  let cursor = null;
  let eventsExtracted = 0;
  let unassigned = [];
  
  while (hasNextPage && eventsExtracted < 1000) {
    const res = await shopifyGraphQL(q, { cursor });
    for (const edge of res.events.edges) {
      eventsExtracted++;
      const node = edge.node;
      if (node.attributeToUser) {
        const id = extractStaffId(node, staffList);
        if (!id) {
          unassigned.push({ action: node.action, message: node.message, appTitle: node.appTitle });
        }
      }
    }
    hasNextPage = res.events.pageInfo.hasNextPage;
    cursor = res.events.pageInfo.endCursor;
  }
  
  console.log('Unassigned Count:', unassigned.length);
  console.log('Sample Unassigned:');
  console.log(JSON.stringify(unassigned.slice(0, 15), null, 2));
}
run();
