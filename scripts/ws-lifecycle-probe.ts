export {}
/**
 * Hold an HMR WebSocket through the platform gateway ACROSS an upstream
 * restart, printing every frame received. This reproduces the user's
 * timeline: tab open -> sandbox recycled -> dev server comes back.
 *
 * Usage: bun scripts/ws-lifecycle-probe.ts <wssUrl> <totalSeconds>
 * Then kill/restart the dev server while it runs.
 */
const url = process.argv[2] ?? "ws://localhost:3000/_next/webpack-hmr";
const seconds = Number(process.argv[3] ?? 40);

const ws = new WebSocket(url);
let n = 0;
ws.onopen = () => console.log(`[open] ${new Date().toISOString()}`);
ws.onmessage = (ev) => {
  n++;
  const raw = typeof ev.data === "string" ? ev.data : `<binary ${ev.data?.byteLength ?? "?"}B>`;
  console.log(`[${new Date().toISOString()}] msg ${n}: ${JSON.stringify(raw.slice(0, 200))}`);
};
ws.onerror = (e) => console.log(`[error] ${(e as ErrorEvent)?.message ?? e}`);
ws.onclose = (e) => console.log(`[close] code=${e.code} reason=${JSON.stringify(e.reason)} at ${new Date().toISOString()}`);
setTimeout(() => {
  console.log(`done, ${n} messages total`);
  process.exit(0);
}, seconds * 1000);
