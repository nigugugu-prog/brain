// Netlify Function: Supabaseプロキシ（Node.js 18+ の組み込みfetch使用）
const SB_URL = 'https://qfclqwdfsgsxdtpfbjzh.supabase.co/rest/v1';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmY2xxd2Rmc2dzeGR0cGZianpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzAzNTgsImV4cCI6MjA5NTgwNjM1OH0.yXy-BaEH9Cjl3VU27sxA4gQhfe68CiEO0WUJjG_e-M0';
const BOARD_ID = 'main';

const RES_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SB_HEADERS = {
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
};

// Node.js の https モジュールを使う（fetchが使えない環境でも確実に動く）
const https = require('https');

function httpsRequest(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: RES_HEADERS, body: '' };
  }

  try {
    // GET: データ読み込み
    if (event.httpMethod === 'GET') {
      const url = `${SB_URL}/boards?id=eq.${BOARD_ID}&select=data&limit=1`;
      const result = await httpsRequest('GET', url, SB_HEADERS, null);
      return { statusCode: result.status, headers: RES_HEADERS, body: result.body };
    }

    // POST: データ保存（upsert）
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const payload = JSON.stringify({
        id: BOARD_ID,
        data: body.data,
        updated_at: new Date().toISOString(),
      });
      const headers = Object.assign({}, SB_HEADERS, {
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(payload).toString(),
      });
      const result = await httpsRequest('POST', `${SB_URL}/boards`, headers, payload);
      return {
        statusCode: result.status >= 200 && result.status < 300 ? 200 : result.status,
        headers: RES_HEADERS,
        body: result.body || '{}',
      };
    }

    return { statusCode: 405, headers: RES_HEADERS, body: 'Method not allowed' };

  } catch (e) {
    return {
      statusCode: 500,
      headers: RES_HEADERS,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
