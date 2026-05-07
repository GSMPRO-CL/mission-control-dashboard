require('dotenv').config({path: '../.env'});
async function run() {
  const websiteId = process.env.CRISP_WEBSITE_ID;
  const auth = Buffer.from(`${process.env.CRISP_IDENTIFIER}:${process.env.CRISP_KEY}`).toString('base64');
  
  // Get 1 conversation to get a session_id
  const res1 = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversations/1`, {
    headers: { 'Authorization': `Basic ${auth}`, 'X-Crisp-Tier': 'plugin' }
  });
  const data1 = await res1.json();
  const sessionId = data1.data[0].session_id;
  
  // Get messages for that session
  const res2 = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversation/${sessionId}/messages`, {
    headers: { 'Authorization': `Basic ${auth}`, 'X-Crisp-Tier': 'plugin' }
  });
  const data2 = await res2.json();
  const operatorMsg = data2.data.find(m => m.from === 'operator');
  console.log(JSON.stringify(operatorMsg, null, 2));
}
run().catch(console.error);
