import 'dotenv/config';
import { ProxyAgent, fetch } from 'undici';

const proxyUrl = process.env.OPENROUTER_PROXY_URL || '';
const apiKey = process.env.OPENROUTER_API_KEY || '';
const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini';
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

async function check(label, url, options = {}) {
  try {
    const response = await fetch(url, { ...options, dispatcher, signal: AbortSignal.timeout(20_000) });
    const body = await response.text();
    let upstreamCode = '';
    try { upstreamCode = JSON.parse(body)?.error?.code || ''; } catch { /* no body details */ }
    console.log(`${label}: HTTP ${response.status}${upstreamCode ? `, upstream=${upstreamCode}` : ''}`);
    return response.ok;
  } catch (error) {
    console.log(`${label}: transport error ${error?.cause?.code || error?.code || error?.name || 'unknown'}`);
    return false;
  }
}

console.log(`Configuration: proxy=${Boolean(proxyUrl)}, key=${Boolean(apiKey)}, model=${model}`);
await check('Proxy transport', 'https://openrouter.ai/api/v1/models');
if (apiKey) await check('API key', 'https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${apiKey}` } });
if (apiKey) await check('Model request', 'https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with OK only.' }], max_tokens: 8 }),
});
await dispatcher?.close();
