const axios = require('axios');
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiZTE0Nzc5Zi03ODA4LTQ5ZDctOTI0Yi0wZWFiODk5YjkxMTciLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMmRmYmExYWMtNTg2ZS00OTliLWExZmItNWQ5MzdiZGYxMjJhIiwiaWF0IjoxNzg2MzgxNDc4LCJleHAiOjE3ODg5MzAwMDB9.5cDEEMtCiw-Xqarr8f5Bu_BAX1VTHh20VoQUOf7boqI';

const workflowData = {
  name: 'Puente CRM a Meta (Bypass Error 200)',
  settings: {},
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'crm-meta-proxy',
        responseMode: 'onReceived',
        options: {}
      },
      id: 'webhook-node-1',
      name: 'Webhook CRM',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1.1,
      position: [250, 300]
    },
    {
      parameters: {
        method: 'POST',
        url: 'https://graph.facebook.com/v21.0/me/messages',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'facebookGraphApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.body) }}',
        options: {}
      },
      id: 'http-request-node-1',
      name: 'Enviar a Meta',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.1,
      position: [470, 300]
    }
  ],
  connections: {
    'Webhook CRM': {
      main: [
        [
          {
            node: 'Enviar a Meta',
            type: 'main',
            index: 0
          }
        ]
      ]
    }
  }
};

async function createWorkflow() {
  try {
    const res = await axios.post('http://localhost:5678/api/v1/workflows', workflowData, {
      headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json' }
    });
    console.log('SUCCESS_WORKFLOW_ID:' + res.data.id);
  } catch(e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
createWorkflow();
