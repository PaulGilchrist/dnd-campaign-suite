/**
 * L5-005 §9.2 — AI status + config header row.
 */
import React from 'react'

export function AiStatusBadge({ status }) {
    if (!status) return <span className="ai-badge ai-badge--off">checking…</span>
    if (!status.configured) return <span className="ai-badge ai-badge--off">not configured</span>
    if (status.reachable?.reachable) {
        return <span className="ai-badge ai-badge--on"><i className="fas fa-plug"></i> {status.model} · {status.mode}</span>
    }
    return <span className="ai-badge ai-badge--down"><i className="fas fa-plug"></i> {status.model} · endpoint down</span>
}

export default function AiConfigRow({ aiConfig, onSave, onRemove, isLocalhost = true }) {
    const [mode, setMode] = React.useState(aiConfig?.mode || 'off')
    const [provider, setProvider] = React.useState(aiConfig?.provider || 'openai')
    const [endpoint, setEndpoint] = React.useState(aiConfig?.endpoint || defaultEndpoint('openai'))
    const [model, setModel] = React.useState(aiConfig?.model || '')
    React.useEffect(() => {
        setMode(aiConfig?.mode || 'off'); setProvider(aiConfig?.provider || 'openai')
        setEndpoint(aiConfig?.endpoint || defaultEndpoint(aiConfig?.provider || 'openai')); setModel(aiConfig?.model || '')
    }, [aiConfig])

    const changeProvider = (next) => {
        setProvider(next)
        // Only prefill when the endpoint is still a default — never clobber a custom URL.
        if (endpoint === defaultEndpoint(provider) || !endpoint) setEndpoint(defaultEndpoint(next))
    }

    return (
        <div className="ai-config-row">
            <label>
                <span>Mode</span>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="off">off</option>
                    <option value="suggest">suggest (referee confirms)</option>
                    <option value="autopilot">autopilot (atomic ops auto-apply)</option>
                </select>
            </label>
            {mode !== 'off' && (
                <>
                    <label title="API dialect. OpenAI-compatible covers oMLX, LM Studio, vLLM, llama.cpp and most local servers.">
                        <span>Provider</span>
                        <select value={provider} onChange={(e) => changeProvider(e.target.value)}>
                            <option value="openai">OpenAI-compatible (oMLX · LM Studio · vLLM…)</option>
                            <option value="ollama">Ollama (native API)</option>
                        </select>
                    </label>
                    <label title="LOCAL endpoints only — campaign data never leaves this machine">
                        <span>Endpoint</span>
                        <input type="text" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder={placeholderFor(provider)} />
                    </label>
                    <label>
                        <span>Model</span>
                        <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="exact id from the endpoint's model list" />
                    </label>
                    <ApiKeyField isLocalhost={isLocalhost} />
                </>
            )}
            <button
                className="ct-btn ct-btn-primary"
                disabled={mode === 'off' && !aiConfig}
                onClick={() => (mode === 'off' ? onRemove() : onSave({ mode, endpoint, model, provider }))}
            >
                <i className="fas fa-save"></i> {mode === 'off' ? 'Turn AI off' : 'Save AI config'}
            </button>
        </div>
    )
}

const defaultEndpoint = (provider) => (provider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:8000/v1')
const placeholderFor = (provider) => (provider === 'ollama'
    ? 'http://localhost:11434'
    : 'http://localhost:8000/v1  (oMLX) · http://localhost:1234/v1  (LM Studio)')

/**
 * The key lives on the SERVER (gitignored file via /api/ai/key), never in
 * aiConfig/change-data — player clients must never see it. The UI only ever
 * gets back a masked hint. Localhost-only, like the key route itself.
 */
function ApiKeyField({ isLocalhost }) {
    const [status, setStatus] = React.useState(null)
    const [value, setValue] = React.useState('')
    const [note, setNote] = React.useState(null)

    const refresh = React.useCallback(() => {
        if (!isLocalhost) return
        fetch('/api/ai/key').then((r) => (r.ok ? r.json() : null)).then((s) => { if (s) setStatus(s) }).catch(() => {})
    }, [isLocalhost])
    React.useEffect(refresh, [refresh])

    const save = async () => {
        const res = await fetch('/api/ai/key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: value.trim() || null }),
        })
        const data = await res.json().catch(() => ({}))
        setNote(res.ok ? (data.set ? `key saved (${data.hint})` : 'key cleared') : `refused: ${data.error || res.status}`)
        setValue('')
        setStatus(res.ok ? { set: data.set, hint: data.hint } : status)
    }

    if (!isLocalhost) return null
    return (
        <label title="Optional — stored server-side only (never sent to other players)">
            <span>API key {status?.set ? <em className="ai-key-set">set {status.hint}</em> : <em className="ai-key-none">none</em>}</span>
            <span className="ai-key-input">
                <input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="optional bearer token" autoComplete="off" />
                <button className="ct-btn" onClick={save}>{value.trim() ? 'Save key' : 'Clear key'}</button>
            </span>
            {note && <span className="ai-key-note">{note}</span>}
        </label>
    )
}
