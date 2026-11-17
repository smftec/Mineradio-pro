// CDP 鼠标事件:node scripts/cdp-mouse.mjs move <x> <y> | click <x> <y> [--page 子串]
import { readFileSync } from 'node:fs';

let want = 'Mineradio pro';
let action = null, x = 0, y = 0;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--page') want = args[++i];
  else if (!action) action = args[i];
  else if (x === 0 && y === 0) x = parseFloat(args[i]);
  else y = parseFloat(args[i]);
}
if (!action) { console.error('usage: cdp-mouse.mjs move|click x y [--page t]'); process.exit(1); }

const list = await (await fetch('http://127.0.0.1:9222/json')).json();
const pages = list.filter((t) => t.type === 'page');
const page = pages.find((t) => (t.title || '') === want)
  || pages.find((t) => (t.title || '').includes(want))
  || pages.find((t) => (t.title || '') === 'Mineradio pro') || pages[0];
if (!page) { console.error('no target'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timeout')), 8000);
  ws.onopen = () => {
    const send = (params) => ws.send(JSON.stringify({ id: Math.random(), method: 'Input.dispatchMouseEvent', params }));
    if (action === 'move') {
      send({ type: 'mouseMoved', x, y, pointerType: 'mouse' });
    } else if (action === 'click') {
      send({ type: 'mouseMoved', x, y, pointerType: 'mouse' });
      setTimeout(() => send({ type: 'mousePressed', x, y, button: 'left', clickCount: 1, pointerType: 'mouse' }), 80);
      setTimeout(() => send({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1, pointerType: 'mouse' }), 160);
    }
    setTimeout(() => { clearTimeout(timer); resolve(); ws.close(); }, action === 'click' ? 400 : 150);
  };
  ws.onerror = () => { clearTimeout(timer); reject(new Error('ws error')); };
});
console.log(action, x, y);
