// CDP 截图:node scripts/cdp-shot.mjs <输出.png> [窗口标题子串]
import { writeFileSync } from 'node:fs';

const out = process.argv[2] || 'shot.png';
let want = 'Mineradio pro';
const pi = process.argv.indexOf('--page');
if (pi > 0) want = process.argv[pi + 1];

const list = await (await fetch('http://127.0.0.1:9222/json')).json();
const pages = list.filter((t) => t.type === 'page');
const page = pages.find((t) => (t.title || '').includes(want)) || pages.find((t) => (t.title || '').includes('Mineradio pro'));
if (!page) {
  console.error('no page target:', pages.map((p) => p.title));
  process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
const b64 = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timeout')), 15000);
  ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id === 1) { clearTimeout(timer); resolve(msg.result?.data); ws.close(); }
  };
  ws.onerror = () => reject(new Error('ws error'));
});
writeFileSync(out, Buffer.from(b64, 'base64'));
console.log('saved', out);
