const { fetchCloudRun } = require('./dashboard/src/lib/cloud-run-client.ts');
// Wait, that's TS, I can't just require it easily in vanilla JS without transpiling.

// Let's just write a standalone script.
const { GoogleAuth } = require('google-auth-library');

async function test() {
    try {
        const serviceUrl = 'https://product-intelligence-service-uxqmnnhz3a-uc.a.run.app';
        console.log("Getting token for", serviceUrl);
        const auth = new GoogleAuth();
        const client = await auth.getIdTokenClient(serviceUrl);
        const headers = await client.getRequestHeaders();
        console.log("Headers obtained successfully");
        
        console.log("Making request to Cloud Run...");
        const response = await fetch(`${serviceUrl}/api/v1/calendar/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify({})
        });
        
        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
