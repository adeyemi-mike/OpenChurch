export {}
/**
 * Probe the Next.js dev HMR WebSocket endpoint (/​_next/webpack-hmr)
 * and print RAW message frames, so we can see whether any hop
 * (platform preview gateway) re-frames JSON as SSE `data: {...}`.
 *
 * Usage: bun scripts/ws-probe.ts <wsUrl> [seconds]
 */
const url = process.argv[2] ?? "ws://localhost:3000/_next/webpack-hmr";
const seconds = Number(process.argv[3] ?? 6);

const ws = new WebSocket(url);
let count = 0;
ws.onopen = () => console.log(`[open] ${url}`);
ws.onmessage = (ev) => {
  count++;
  const raw = typeof ev.data === "string" ? ev.data : `<binary ${ev.data?.byteLength ?? "?"} bytes>`;
  const preview = raw.length > 160 ? raw.slice(0, 160) + "…" : raw;
  console.log(`[msg ${count}] ${JSON.stringify(preview)}`);
};
ws.onerror = (e) => console.log("[error]", (e as ErrorEvent)?.message ?? e);
ws.onclose = (e) => console.log(`[close] code=${e.code} reason=${e.reason}`);
setTimeout(() => {
  console.log(`done after ${seconds}s, ${count} messages`);
  process.exit(0);
}, seconds * 1000);
