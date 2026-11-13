/**
 * Diagnose HMR WebSocket framing: direct dev server vs platform preview gateway.
 * Prints the first frames received on each connection so we can see exactly
 * what the browser's JSON.parse(event.data) would receive.
 */
export {}

type ProbeResult = { label: string; status: string; frames: { kind: string; text?: string }[] }

const TARGETS: { label: string; url: string }[] = [
  { label: "direct  ", url: "ws://localhost:3000/_next/webpack-hmr?id=diag" },
  {
    label: "preview ",
    url: "wss://preview-chat-692216d1-a0d3-437b-ae39-abd9164058bf.space-z.ai/_next/webpack-hmr?id=diag",
  },
]

function probe(target: { label: string; url: string }, timeoutMs = 8000) {
  return new Promise<ProbeResult>((resolve) => {
    const frames: { kind: string; text?: string }[] = []
    let settled = false
    const finish = (status: string) => {
      if (settled) return
      settled = true
      resolve({ label: target.label, status, frames })
    }
    const timer = setTimeout(() => finish("timeout"), timeoutMs)
    let ws: WebSocket
    try {
      ws = new WebSocket(target.url)
    } catch (e) {
      clearTimeout(timer)
      return finish("constructor-error: " + (e instanceof Error ? e.message : String(e)))
    }
    ws.onopen = () => frames.push({ kind: "OPEN" })
    ws.onmessage = (event) => {
      frames.push({ kind: "MSG", text: String(event.data).slice(0, 200) })
      if (frames.length >= 3) {
        clearTimeout(timer)
        ws.close()
        finish("ok")
      }
    }
    ws.onerror = (e: unknown) => {
      clearTimeout(timer)
      const msg = e instanceof Error ? e.message : String(e)
      finish("ws-error: " + msg)
    }
    ws.onclose = (e) => {
      clearTimeout(timer)
      finish(`closed code=${e.code} reason=${e.reason}`)
    }
  })
}

for (const t of TARGETS) {
  const r = await probe(t)
  console.log(`\n=== ${r.label} ${t.url}`)
  console.log(`    result: ${r.status}`)
  for (const f of r.frames) {
    console.log(`    ${f.kind}  ${f.text ?? ""}`)
  }
}
process.exit(0)
