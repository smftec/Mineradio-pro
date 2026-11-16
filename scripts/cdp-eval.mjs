// CDP 执行脚本:对 Mineradio pro 主窗口执行 JS 表达式
// 用法:node scripts/cdp-eval.mjs "<expression>"  或  node scripts/cdp-eval.mjs --file path.js
import { readFileSync } from 'node:fs';

// 参数:--page <窗口标题子串> 选择目标;表达式来自下一个非选项参数,或 --file <路径>
let expression = null;
let want = 'Mineradio pro';
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--page') {
    want = process.argv[++i];
  } else if (process.argv[i] === '--file') {
    expression = readFileSync(process.argv[++i], 'utf-8');
  } else if (expression === null) {
    expression = process.argv[i];
  }
}

const list = await (await fetch('http://127.0.0.1:9222/json')).json();
const pages = list.filter((t) => t.type === 'page');
const page = pages.find((t) => (t.title || '') === want)
  || pages.find((t) => (t.title || '') === 'Mineradio pro')
  || pages.find((t) => (t.title || '').includes(want))
  || pages[0];
if (!page) {
  console.error('no page target. targets:', pages.map((p) => p.title));
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
const result = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timeout')), 15000);
  ws.onopen = () => {
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression, awaitPromise: true, returnByValue: true },
    }));
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id === 1) {
      clearTimeout(timer);
      if (msg.result?.exceptionDetails) {
        reject(new Error(msg.result.exceptionDetails.exception?.description || JSON.stringify(msg.result.exceptionDetails)));
      } else {
        resolve(msg.result?.result?.value);
      }
      ws.close();
    }
  };
  ws.onerror = (e) => reject(new Error('ws error'));
});
console.log(typeof result === 'object' ? JSON.stringify(result, null, 1) : result);
