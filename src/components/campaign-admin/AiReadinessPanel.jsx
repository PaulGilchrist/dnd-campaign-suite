/**
 * Deferred plan B — AI readiness panel (Admin, localhost-only surface).
 *
 * An ASSISTANT, not a wizard: ambient status chips with manual "run a check"
 * buttons, never gates. The app NEVER contacts a model without a click —
 * mount renders idle chips and fires zero fetches (unit-pinned). Every check
 * reuses an existing lane:
 *   ① Endpoint reachable — POST /api/ai/models (fetchAiModels, server-bounded
 *      probe, localhost-gated) with the SAVED aiConfig (not the unsaved form).
 *   ② Model listed — derived from ①'s response + the saved model id; zero
 *      extra traffic.
 *   ③ Test ruling — POST /ai/referee via askAiReferee with a canned question.
 *      The referee route returns a schema-validated PROPOSAL and applies
 *      nothing (server design); the panel only displays the reply — an
 *      inherently dry-run round-trip. It must never route through
 *      AiAskConsole, which auto-applies atomic rulings in autopilot mode.
 * Honest failure faces reuse the ai-badge visual language and the plain-
 * English bounded-tail law of applyFailureCopy.js, plus static recipe links
 * (users-guide §9) for the three local server families.
 */
import React from 'react'
import { fetchAiModels, askAiReferee } from '../../services/ai/aiClient.js'
import { applyFailureDetail } from '../../services/ai/applyFailureCopy.js'

// A rules question with an unambiguous atomic answer — exercises the whole
// funnel (transport → prompt → constrained decode → schema validation).
export const TEST_QUESTION = 'Goblin 1 (melee, +4 to hit) is within 5 ft of the fighter and has its Action available. Propose one attack as a dice ruling.'

const RECIPES = [
    {
        id: 'omlx',
        label: 'oMLX (OpenAI-compatible)',
        body: 'Start the server with your downloaded model — e.g. `mlx_lm.server` / oMLX on http://localhost:8000/v1 — then set Provider = OpenAI-compatible and paste the exact model id from its model list.',
    },
    {
        id: 'lmstudio',
        label: 'LM Studio (OpenAI-compatible)',
        body: 'In LM Studio: Developer → Start Server. The default endpoint is http://localhost:1234/v1 with Provider = OpenAI-compatible.',
    },
    {
        id: 'ollama',
        label: 'Ollama (native API)',
        body: 'Run `ollama serve` (default http://localhost:11434) and pull a model (`ollama pull llama3.2`). Choose Provider = Ollama (native API) and the exact model name, e.g. llama3.2.',
    },
]

const Badge = ({ status }) => {
    if (status === 'ok') return <span className="ai-badge ai-badge--on"><i className="fas fa-circle-check"></i> pass</span>
    if (status === 'fail') return <span className="ai-badge ai-badge--down"><i className="fas fa-circle-xmark"></i> fail</span>
    if (status === 'checking') return <span className="ai-badge ai-badge--off">checking…</span>
    return <span className="ai-badge ai-badge--off">not checked</span>
}

// Chip ② derivation (status + honest hint), hoisted pure helpers so the
// component body stays under the complexity ceiling.
function listStatusFor(endpoint, model) {
    if (endpoint.status !== 'ok') return endpoint.status
    if (!model) return 'idle'
    return endpoint.models.includes(model) ? 'ok' : 'fail'
}
function listHintFor(endpoint, model) {
    if (!model) return 'Set the exact model id in the config row first.'
    if (endpoint.status !== 'ok') return 'Passes when the model list from check ① includes your configured model.'
    if (endpoint.models.includes(model)) return `“${model}” is on the endpoint.`
    return `Endpoint answered, but “${model}” is not in its list — pick one of the ids it offers.`
}

function Chip({ n, label, hint, status, onRun, runLabel }) {
    return (
        <div className="ai-readiness-chip">
            <span className="ai-readiness-chip-head">
                <b>{n}. {label}</b> <Badge status={status} />
            </span>
            <em className="ai-readiness-chip-hint">{hint}</em>
            {onRun && (
                <button type="button" className="ct-btn" disabled={status === 'checking'} onClick={onRun}>
                    {runLabel}
                </button>
            )}
        </div>
    )
}

export default function AiReadinessPanel({ campaignName, aiConfig }) {
    const [endpoint, setEndpoint] = React.useState({ status: 'idle', models: null, error: null })
    const [ruling, setRuling] = React.useState({ status: 'idle', info: null, error: null })

    // Any config change invalidates every verdict — chips reset (event-driven,
    // no timers; nothing re-checks until the GM clicks again).
    const cfgKey = `${aiConfig?.mode}|${aiConfig?.provider}|${aiConfig?.endpoint}|${aiConfig?.model}`
    React.useEffect(() => {
        setEndpoint({ status: 'idle', models: null, error: null })
        setRuling({ status: 'idle', info: null, error: null })
    }, [cfgKey])

    const runEndpoint = async () => {
        setEndpoint(s => ({ ...s, status: 'checking' }))
        const r = await fetchAiModels({ endpoint: aiConfig.endpoint, provider: aiConfig.provider })
        if (r.ok) setEndpoint({ status: 'ok', models: r.models, error: null })
        else setEndpoint({ status: 'fail', models: null, error: r.error })
    }

    const runRuling = async () => {
        setRuling(s => ({ ...s, status: 'checking' }))
        const res = await askAiReferee({ campaignName, action: TEST_QUESTION, characterName: '' })
        if (res.ok) {
            // ok:true ⇒ the model REPLIED and the server's schema validation
            // accepted it. A needs_human ANSWER (type) is a legitimate,
            // healthy judgement deferral — green.
            setRuling({ status: 'ok', info: `Model answered: ${res.ruling?.type || 'ruling'}${res.ruling?.expression ? ` — ${res.ruling.expression}` : ''}. Displayed only — nothing was applied.`, error: null })
        } else if (res.code === 'AI_NEEDS_HUMAN') {
            // ok:false + needs_human is the fail-CLOSED fallback — the model
            // was unreachable or answered invalid twice. Honest red: the
            // table would fall back to manual mid-session too.
            setRuling({ status: 'fail', info: null, error: `No usable ruling — the model was unreachable or answered invalidly. ${String(res.ruling?.text || '').slice(0, 140)}` })
        } else {
            setRuling({ status: 'fail', info: null, error: applyFailureDetail(res.error || res.code || 'AI unavailable') })
        }
    }

    // Chip ② is derived from ①'s last answer + the saved model id — its own
    // pure helpers keep the panel under the eslint complexity ceiling.
    const model = aiConfig?.model || ''
    const listStatus = listStatusFor(endpoint, model)
    const listHint = listHintFor(endpoint, model)

    const failed = endpoint.status === 'fail' || ruling.status === 'fail'
    return (
        <div className="ai-readiness" aria-label="AI readiness checks">
            <p className="ai-readiness-intro">
                Optional pre-flight checks — nothing runs until you click, and the game works fine without them.
            </p>
            <div className="ai-readiness-chips">
                <Chip n={1} label="Endpoint reachable" status={endpoint.status}
                    hint={endpoint.status === 'fail' ? endpoint.error : 'Asks the endpoint for its model list through the server (bounded 5 s probe).'}
                    onRun={runEndpoint} runLabel="Run a check" />
                <Chip n={2} label="Model listed" status={listStatus} hint={listHint} />
                <Chip n={3} label="Test ruling" status={ruling.status}
                    hint={ruling.status === 'fail' ? ruling.error : (ruling.info || 'One canned referee question, answered by the real prompt + schema funnel. The reply is displayed — nothing is applied.')}
                    onRun={runRuling} runLabel="Ask test ruling" />
            </div>
            {failed && (
                <details className="ai-readiness-recipes">
                    <summary>How to start a local model server</summary>
                    {RECIPES.map(r => (
                        <details key={r.id}>
                            <summary>{r.label}</summary>
                            <p>{r.body}</p>
                        </details>
                    ))}
                </details>
            )}
        </div>
    )
}
