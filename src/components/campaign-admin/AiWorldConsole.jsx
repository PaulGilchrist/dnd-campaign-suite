/**
 * L5 §9.4 — World keeper console (Admin view, beside the AI referee ask
 * box). The referee asks for campaign-consistent content — recap, rumor,
 * downtime event, NPC dialogue, quest draft — grounded in the campaign
 * ledger (enforced server-side). Nothing writes until the referee acts on
 * the card: Log it → narrative log entry; Add quest → the normal quests
 * CRUD lane. The card waits indefinitely (no clock decides content).
 */
import React from 'react'
import { askWorldKeeper } from '../../services/ai/aiClient.js'
import { applyWorldProposal } from '../../services/ai/applyWorldProposal.js'
import './AiWorldConsole.css'

const KINDS = [
    { value: 'recap', label: 'Session recap' },
    { value: 'rumor', label: 'Rumor' },
    { value: 'event', label: 'Downtime event' },
    { value: 'npc_dialogue', label: 'NPC dialogue' },
    { value: 'quest_draft', label: 'Quest draft' },
]

export default function AiWorldConsole({ campaignName }) {
    const [kind, setKind] = React.useState('recap')
    const [focus, setFocus] = React.useState('')
    const [proposal, setProposal] = React.useState(null)
    const [result, setResult] = React.useState(null)
    const [asking, setAsking] = React.useState(false)

    const ask = async () => {
        setAsking(true); setResult(null); setProposal(null)
        const res = await askWorldKeeper({ campaignName, kind, focus: focus.trim() || null })
        setAsking(false)
        if (!res.ok && res.code !== 'AI_NEEDS_HUMAN') { setResult({ applied: false, detail: res.error || res.code || 'AI unavailable' }); return }
        setProposal(res.proposal)
    }

    const act = async () => {
        const r = await applyWorldProposal({ campaignName, proposal })
        setResult(r)
        setProposal(null)
    }

    return (
        <div className="ai-world-console">
            <h4><i className="fas fa-globe"></i> World keeper</h4>
            <div className="ai-world-row">
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                    {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
                <input type="text" placeholder="optional focus… e.g. 'the faction tension in Bravor'" value={focus} onChange={(e) => setFocus(e.target.value)} />
                <button className="ct-btn ct-btn-primary" disabled={asking} onClick={ask}>
                    <i className={`fas ${asking ? 'fa-spinner' : 'fa-feather'}`}></i> {asking ? 'Writing…' : 'Generate'}
                </button>
            </div>
            {proposal && <WorldProposalCard proposal={proposal} onAct={act} onDismiss={() => setProposal(null)} />}
            {result && (
                <div className={`ai-notice ${result.applied ? 'ai-notice--ok' : 'ai-notice--refused'}`} role="status">
                    {result.applied ? 'Applied: ' : 'Not applied: '}{result.detail}
                </div>
            )}
        </div>
    )
}

function WorldProposalCard({ proposal, onAct, onDismiss }) {
    const body = proposal.kind === 'quest_draft'
        ? `${proposal.name} — ${proposal.description}${proposal.rewards ? ` (rewards: ${proposal.rewards})` : ''}`
        : `${proposal.kind === 'npc_dialogue' ? `${proposal.npcName}: ` : ''}${proposal.text}`
    return (
        <div className="ai-world-card">
            <div className="ai-world-head">
                <b>{proposal.kind.replace('_', ' ')}</b>
                {typeof proposal.confidence === 'number' && <em className="ai-confidence">confidence {(proposal.confidence * 100).toFixed(0)}%</em>}
            </div>
            <p className="ai-world-body">{body}</p>
            <div className="ai-world-actions">
                {proposal.kind !== 'needs_human' && (
                    <button className="ct-btn ct-btn-primary" onClick={onAct}>
                        <i className="fas fa-plus-circle"></i> {proposal.kind === 'quest_draft' ? 'Add quest to ledger' : 'Log it'}
                    </button>
                )}
                <button className="ct-btn" onClick={onDismiss}>Dismiss</button>
            </div>
        </div>
    )
}
