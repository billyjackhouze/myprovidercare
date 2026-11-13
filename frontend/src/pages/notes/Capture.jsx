import { useEffect, useRef, useState } from 'react'

// Evidence the device reports with every clock tap. The server keeps its own clock.
export function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({})
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy_m: p.coords.accuracy }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    )
  })
}

export async function sha256Hex(blob) {
  const buf = await blob.arrayBuffer()
  const d = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function buildCapture() {
  const pos = await getPosition()
  return {
    mutation_id: crypto.randomUUID(),
    device_clock_at: new Date().toISOString(),
    device_elapsed_ms: Math.round(performance.now()),
    ...pos,
  }
}

// Finger / mouse signature. onDone receives a PNG blob.
export function SignaturePad({ onDone, onCancel, title = 'Sign with your finger' }) {
  const ref = useRef(null)
  const drawing = useRef(false)
  const [inked, setInked] = useState(false)

  const pt = (e) => {
    const r = ref.current.getBoundingClientRect()
    const t = e.touches ? e.touches[0] : e
    return [(t.clientX - r.left) * (ref.current.width / r.width), (t.clientY - r.top) * (ref.current.height / r.height)]
  }
  const down = (e) => { e.preventDefault(); drawing.current = true; const c = ref.current.getContext('2d'); const [x, y] = pt(e); c.beginPath(); c.moveTo(x, y) }
  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const c = ref.current.getContext('2d'); const [x, y] = pt(e)
    c.lineWidth = 3; c.lineCap = 'round'; c.strokeStyle = '#1B2D4E'; c.lineTo(x, y); c.stroke(); setInked(true)
  }
  const up = () => { drawing.current = false }
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); setInked(false) }
  const done = () => ref.current.toBlob((b) => onDone(b), 'image/png')

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{title}</p>
      <canvas ref={ref} width={640} height={240}
        className="w-full bg-white border border-border rounded-lg touch-none"
        onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
        onTouchStart={down} onTouchMove={move} onTouchEnd={up} />
      <div className="flex gap-2">
        <button type="button" onClick={clear} className="px-3 py-2 rounded-lg border border-border text-sm">Clear</button>
        {onCancel && <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg border border-border text-sm">Cancel</button>}
        <button type="button" disabled={!inked} onClick={done}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-40">Accept signature</button>
      </div>
    </div>
  )
}

// Live camera only (no file picker): the photo ends the contact. onDone gets { blob, hash }.
export function CameraCapture({ onDone, onCancel }) {
  const video = useRef(null)
  const stream = useRef(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let live = true
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => { if (!live) { s.getTracks().forEach((t) => t.stop()); return } stream.current = s; video.current.srcObject = s; video.current.play() })
      .catch(() => setErr('The camera is not available. Allow camera access to end the contact.'))
    return () => { live = false; stream.current?.getTracks().forEach((t) => t.stop()) }
  }, [])

  const snap = () => {
    const v = video.current
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    c.toBlob(async (blob) => { onDone({ blob, hash: await sha256Hex(blob) }) }, 'image/jpeg', 0.85)
  }

  return (
    <div className="space-y-3">
      {err ? <p className="text-sm text-danger">{err}</p>
        : <video ref={video} playsInline muted className="w-full rounded-lg bg-black" />}
      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg border border-border text-sm">Cancel</button>}
        <button type="button" disabled={!!err} onClick={snap}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-40">Take photo and end contact</button>
      </div>
    </div>
  )
}
