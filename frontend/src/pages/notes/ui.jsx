export const inputCls = 'w-full rounded-lg border border-border px-3 py-2 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30'

export function Field({ def, value, onChange, disabled }) {
  const v = value ?? ''
  if (def.type === 'bool') {
    return (
      <label className="flex items-center gap-3 py-2 text-sm cursor-pointer">
        <input type="checkbox" className="h-5 w-5" checked={!!value} disabled={disabled}
          onChange={(e) => onChange(def.key, e.target.checked)} />
        <span>{def.label}</span>
      </label>
    )
  }
  return (
    <label className="block text-sm">
      <span className="block mb-1 text-heading font-medium">{def.label}</span>
      {def.type === 'area' ? (
        <textarea className={inputCls} rows={def.rows || 3} value={v} disabled={disabled}
          onChange={(e) => onChange(def.key, e.target.value)} />
      ) : def.type === 'select' ? (
        <select className={inputCls} value={v} disabled={disabled} onChange={(e) => onChange(def.key, e.target.value)}>
          <option value="">Choose</option>
          {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={def.type === 'date' ? 'date' : 'text'} className={inputCls} value={v} disabled={disabled}
          onChange={(e) => onChange(def.key, e.target.value)} />
      )}
    </label>
  )
}

export function errText(e) {
  const d = e?.response?.data?.detail
  if (d && typeof d === 'object') return d.message || d.code || 'Request refused'
  return typeof d === 'string' ? d : (e?.message || 'Something went wrong')
}
