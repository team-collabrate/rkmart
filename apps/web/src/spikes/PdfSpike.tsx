import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import pdfMake from 'pdfmake/build/pdfmake'
import { buildDailyBillsDoc } from '../lib/pdf/dailyBillsDoc'
import { ensurePdfFonts } from '../lib/pdf/fonts'
import { sampleBills, sampleCompany } from './sampleBills'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

interface Result {
  pages: number
  kb: number
  ms: number
  url: string
}

/**
 * Stage 0 spike: can pdfmake make the half-A4 GST bills with correct Tamil in the browser?
 * The PDF is rendered back to canvases with pdf.js so we can look at the real output.
 */
export default function PdfSpike() {
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const holder = useRef<HTMLDivElement>(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      await ensurePdfFonts()
      const started = performance.now()
      const doc = buildDailyBillsDoc(sampleCompany, sampleBills)
      const blob: Blob = await pdfMake.createPdf(doc).getBlob()
      const ms = Math.round(performance.now() - started)

      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })
        .promise
      const target = holder.current
      if (target) target.replaceChildren()
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n)
        const scale = Number(new URLSearchParams(location.search).get('scale')) || 1.4
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.cssText = 'border:1px solid #000;max-width:100%;height:auto;background:#fff'
        canvas.setAttribute('data-page', String(n))
        target?.appendChild(canvas)
        await page.render({ canvas, viewport }).promise
      }
      setResult({
        pages: pdf.numPages,
        kb: Math.round(blob.size / 1024),
        ms,
        url: URL.createObjectURL(blob),
      })
      document.title = `pdf-spike-done-${pdf.numPages}`
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      document.title = 'pdf-spike-error'
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (new URLSearchParams(location.search).get('auto') === '1') void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section style={{ padding: 16 }}>
      <h2>Tamil PDF spike</h2>
      <p>5 sample GST bills, 2 per A4 page, English and Tamil.</p>
      <button
        onClick={() => void run()}
        disabled={busy}
        style={{ padding: '8px 16px', border: '2px solid #000', borderRadius: 8, fontWeight: 600 }}
      >
        {busy ? 'Working…' : 'Generate PDF'}
      </button>
      {error && (
        <p role="alert" style={{ color: '#b00020' }}>
          Error: {error}
        </p>
      )}
      {result && (
        <p id="pdf-result">
          {result.pages} pages · {result.kb} KB · {result.ms} ms ·{' '}
          <a href={result.url} download="rk-bills-sample.pdf">
            Download
          </a>
        </p>
      )}
      <div ref={holder} style={{ display: 'grid', gap: 16, marginTop: 16 }} />
    </section>
  )
}
