const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Reusable Shopify GraphQL Client
 * Handles rate limits, pagination, and exponential backoff retries.
 * 
 * @param {string} query The GraphQL query
 * @param {object} variables Variables for the query
 * @param {object} options Options: { paginate: boolean, connectionPath: string }
 * @returns {object|array} Data or array of paginated items
 */
async function shopifyGraphQL(query, variables = {}, options = {}) {
  const token = process.env.SHOPIFY_API_TOKEN;
  const domain = process.env.SHOPIFY_DOMAIN;

  if (!token || !domain) {
    throw new Error("Missing SHOPIFY_API_TOKEN or SHOPIFY_DOMAIN in environment variables.");
  }

  const url = `https://${domain}/admin/api/2024-10/graphql.json`;
  let results = [];
  let hasNextPage = true;
  let cursor = null;

  const maxRetries = 3;
  const backoffDelays = [1000, 2000, 4000];

  while (hasNextPage) {
    if (options.paginate) {
      variables.cursor = cursor;
    }

    let success = false;
    let data;
    let response;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token
          },
          body: JSON.stringify({ query, variables })
        });

        if (!response.ok && response.status >= 500) {
          throw new Error(`HTTP ${response.status}`);
        }

        data = await response.json();

        const isThrottled = data.errors && data.errors.some(e => e.message && e.message.includes('THROTTLED') || (e.extensions && e.extensions.code === 'THROTTLED'));

        if (!response.ok || isThrottled) {
          throw new Error(isThrottled ? 'THROTTLED' : `HTTP ${response.status}`);
        }

        if (data.errors && data.errors.length > 0) {
          throw new Error(`GraphQL Error: ${data.errors[0].message}`);
        }

        success = true;
        break; // Success, exit retry loop
      } catch (err) {
        if (attempt < maxRetries && (err.message.includes('THROTTLED') || err.message.includes('HTTP 5'))) {
          console.log(`[shopify-gql] Attempt ${attempt + 1} failed (${err.message}), retrying in ${backoffDelays[attempt]}ms...`);
          await sleep(backoffDelays[attempt]);
        } else if (attempt === maxRetries) {
          throw new Error(`[shopify-gql] Failed after ${maxRetries} retries: ${err.message}`);
        } else {
          // If it's a 4xx error or GraphQL error (not throttled), throw immediately
          throw err;
        }
      }
    }

    // Rate Limit Handling
    if (data.extensions && data.extensions.cost) {
      const cost = data.extensions.cost;
      const actualCost = cost.actualQueryCost;
      const throttleStatus = cost.throttleStatus;
      const available = throttleStatus.currentlyAvailable;
      const restoreRate = throttleStatus.restoreRate;
      const maxAvailable = throttleStatus.maximumAvailable;

      console.log(`[shopify-gql] cost: ${actualCost}, available: ${available}/${maxAvailable}`);

      if (available < 100) {
        // Sleep to wait for bucket to restore up to at least what we requested or a safe buffer
        const requestedCost = cost.requestedQueryCost || actualCost;
        const requiredToRestore = Math.max(0, requestedCost - available);
        const sleepSeconds = Math.ceil(requiredToRestore / restoreRate);
        if (sleepSeconds > 0) {
          console.log(`[shopify-gql] Throttle limit near, sleeping for ${sleepSeconds} seconds...`);
          await sleep(sleepSeconds * 1000);
        }
      }
    }

    if (options.paginate && options.connectionPath) {
      // Traverse object path to find connection
      let connection = data.data;
      const paths = options.connectionPath.split('.');
      for (const p of paths) {
        if (connection && connection[p] !== undefined) {
          connection = connection[p];
        } else {
           throw new Error(`Invalid connectionPath: ${options.connectionPath}. Path not found in response.`);
        }
      }
      
      if (!connection.pageInfo) {
         throw new Error(`Pagination requested but pageInfo not found at ${options.connectionPath}`);
      }

      // Add to results
      if (connection.edges) {
         results = results.concat(connection.edges);
      }

      hasNextPage = connection.pageInfo.hasNextPage;
      cursor = connection.pageInfo.endCursor;
    } else {
      // Non-paginated query
      return data.data;
    }
  }

  return results;
}

module.exports = { shopifyGraphQL };
