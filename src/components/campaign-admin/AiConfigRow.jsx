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

export default function AiConfigRow({ aiConfig, onSave, onRemove }) {
    const [mode, setMode] = React.useState(aiConfig?.mode || 'off')
    const [endpoint, setEndpoint] = React.useState(aiConfig?.endpoint || 'http://localhost:11434')
    const [model, setModel] = React.useState(aiConfig?.model || '')
    React.useEffect(() => {
        setMode(aiConfig?.mode || 'off'); setEndpoint(aiConfig?.endpoint || 'http://localhost:11434'); setModel(aiConfig?.model || '')
    }, [aiConfig])

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
                    <label title="LOCAL endpoints only — campaign data never leaves this machine">
                        <span>Endpoint</span>
                        <input type="text" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="http://localhost:11434" />
                    </label>
                    <label>
                        <span>Model</span>
                        <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="llama3.1:8b" />
                    </label>
                </>
            )}
            <button
                className="ct-btn ct-btn-primary"
                disabled={mode === 'off' && !aiConfig}
                onClick={() => (mode === 'off' ? onRemove() : onSave({ mode, endpoint, model, provider: 'ollama' }))}
            >
                <i className="fas fa-save"></i> {mode === 'off' ? 'Turn AI off' : 'Save AI config'}
            </button>
        </div>
    )
}
