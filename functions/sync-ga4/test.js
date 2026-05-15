require('dotenv').config({ path: '../../.env' });
const { syncGA4 } = require('./index.js');

const req = {};
const res = {
  status: (code) => ({
    json: (data) => console.log(`STATUS: ${code}`, data)
  })
};

syncGA4(req, res).then(() => console.log('Done')).catch(console.error);
