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
import { findUnknownLedgerNames, ledgerNameList } from '../../services/ai/proposalNameAudit.js'
import { loadNPCs } from '../../services/npcs/npcsService.js'
import { loadSettlements } from '../../services/campaign/settlementsService.js'
import { loadFactions } from '../../services/campaign/factionsService.js'
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
    // Backlog 2026-11-01 (AV) — applied-state copy: after a SUCCESSFUL apply
    // the card stays mounted as a receipt with its action row swapped for an
    // Applied badge, so the referee sees exactly what was committed and the
    // same apply cannot be re-fired. Failed applies keep the old behaviour
    // (card clears, honest refusal notice only) — never a premature badge.
    const [applied, setApplied] = React.useState(false)
    // Backlog 2026-11-01 — client-side quest_draft accept-scrutiny: the
    // ledgers are fetched when a quest card surfaces so the referee gets a
    // non-blocking "check spelling" advisory BEFORE applying. Failure to
    // load simply leaves the card un-adorned (nothing here blocks anything).
    const [ledgerNames, setLedgerNames] = React.useState(null)

    React.useEffect(() => {
        if (!proposal || proposal.kind !== 'quest_draft') return undefined
        let cancelled = false
        Promise.allSettled([loadNPCs(campaignName), loadSettlements(campaignName), loadFactions(campaignName)]).then(([npcs, settlements, factions]) => {
            if (cancelled) return
            setLedgerNames({
                npcNames: npcs.status === 'fulfilled' ? ledgerNameList(npcs.value, 'npcs') : [],
                settlementNames: settlements.status === 'fulfilled' ? ledgerNameList(settlements.value, 'settlements') : [],
                factionNames: factions.status === 'fulfilled' ? ledgerNameList(factions.value, 'factions') : [],
            })
        })
        return () => { cancelled = true }
    }, [proposal, campaignName])

    const ask = async () => {
        setAsking(true); setResult(null); setProposal(null); setApplied(false)
        let res
        try {
            res = await askWorldKeeper({ campaignName, kind, focus: focus.trim() || null })
        } catch (e) { // transport death (offline/API down) — never strand the button mid-spin
            console.error('[aiWorldConsole:ask]', e)
            setAsking(false); setResult({ applied: false, detail: 'AI request failed — check the API server.' }); return
        }
        setAsking(false)
        if (!res.ok && res.code !== 'AI_NEEDS_HUMAN') { setResult({ applied: false, detail: res.error || res.code || 'AI unavailable' }); return }
        setProposal(res.proposal)
    }

    const act = async () => {
        const r = await applyWorldProposal({ campaignName, proposal })
        setResult(r)
        if (r.applied) { setApplied(true); return } // receipt stays mounted, actions become the badge
        setProposal(null) // refused/failed: unchanged — clear the card, notice carries the reason
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
            {proposal && <WorldProposalCard proposal={proposal} ledgerNames={ledgerNames} applied={applied} onAct={act} onDismiss={() => setProposal(null)} />}
            {result && (
                <div className={`ai-notice ${result.applied ? 'ai-notice--ok' : 'ai-notice--refused'}`} role="status">
                    {result.applied ? 'Applied: ' : 'Not applied: '}{result.detail}
                </div>
            )}
        </div>
    )
}

// Short name for the applied receipt badge: quest cards name their ledger
// row, narrative cards name their kind (the body already carries the text).
function appliedLabel(proposal) {
    return proposal.kind === 'quest_draft' ? `quest '${proposal.name}'` : proposal.kind.replace('_', ' ')
}

function WorldProposalCard({ proposal, ledgerNames, applied, onAct, onDismiss }) {
    const body = proposal.kind === 'quest_draft'
        ? `${proposal.name} — ${proposal.description}${proposal.rewards ? ` (rewards: ${proposal.rewards})` : ''}`
        : `${proposal.kind === 'npc_dialogue' ? `${proposal.npcName}: ` : ''}${proposal.text}`
    const unknownNames = findUnknownLedgerNames(proposal, ledgerNames)
    return (
        <div className="ai-world-card">
            <div className="ai-world-head">
                <b>{proposal.kind.replace('_', ' ')}</b>
                {typeof proposal.confidence === 'number' && <em className="ai-confidence">confidence {(proposal.confidence * 100).toFixed(0)}%</em>}
            </div>
            <p className="ai-world-body">{body}</p>
            {unknownNames.length > 0 && (
                <div className="ai-world-advisory" role="status">
                    <i className="fas fa-triangle-exclamation" aria-hidden="true"></i>
                    names not in the ledger — check spelling: {unknownNames.join(', ')}
                </div>
            )}
            <div className="ai-world-actions">
                {applied ? (
                    /* Applied receipt — reuses the .ai-badge pill + green (AiRefereeSection.css).
                       No Dismiss either: the card is a terminal record until the next ask. */
                    <span className="ai-badge ai-badge--on">
                        <i className="fas fa-circle-check" aria-hidden="true"></i>
                        {` Applied: ${appliedLabel(proposal)}`}
                    </span>
                ) : (
                    <>
                        {proposal.kind !== 'needs_human' && (
                            <button className="ct-btn ct-btn-primary" onClick={onAct}>
                                <i className="fas fa-plus-circle"></i> {proposal.kind === 'quest_draft' ? 'Add quest to ledger' : 'Log it'}
                            </button>
                        )}
                        <button className="ct-btn" onClick={onDismiss}>Dismiss</button>
                    </>
                )}
            </div>
        </div>
    )
}
