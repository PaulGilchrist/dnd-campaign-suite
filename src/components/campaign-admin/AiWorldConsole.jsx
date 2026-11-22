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
import { incompleteLedgerCopy } from '../../services/ai/incompleteLedgerCopy.js'
import { loadNPCs } from '../../services/npcs/npcsService.js'
import { loadSettlements } from '../../services/campaign/settlementsService.js'
import { loadFactions } from '../../services/campaign/factionsService.js'
import { loadQuests } from '../../services/campaign/questsService.js'
import './AiWorldConsole.css'

// 2026-11-22 — Lane labels for the partial-failure face. Order is index-bound
// to the Promise.allSettled array below and to the ledgerNameList keys.
// 2026-11-22 (OOO) — ONE all-lowercase label style: the pill embeds these
// mid-sentence, so a Title-case lane read as a casing mix.
const LEDGER_LANES = [
    { key: 'npcs', label: 'npcs' },
    { key: 'settlements', label: 'settlements' },
    { key: 'factions', label: 'factions' },
    { key: 'quests', label: 'quests' },
]

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
        // MMM 2026-11-21 — restart from "not scrutinized yet" for every fresh
        // card: without this reset a second quest card would briefly wear the
        // previous card's verdict while its own fetch is still in flight.
        setLedgerNames(null)
        // Backlog 2026-11-22 (ledger partial-failure) — the ledger is either
        // KNOWN or UNREADABLE per lane, never silently-empty: a REJECTED lane's
        // [] would ground names against a partial ledger (a false all-clear, or
        // an unknown-name advisory with no hint the roster never loaded). Name
        // the failed lanes in `unreadable` so the card wears the incomplete
        // face instead of a verdict.
        Promise.allSettled([loadNPCs(campaignName), loadSettlements(campaignName), loadFactions(campaignName), loadQuests(campaignName)]).then((settled) => {
            if (cancelled) return
            const laneNames = (i) => settled[i].status === 'fulfilled' ? ledgerNameList(settled[i].value, LEDGER_LANES[i].key) : []
            setLedgerNames({
                npcNames: laneNames(0),
                settlementNames: laneNames(1),
                factionNames: laneNames(2),
                // 2026-11-13 AD — quest titles ground cross-references the same
                // way factions do (loadQuests unwraps to a bare array, which
                // ledgerNameList already tolerates).
                questNames: laneNames(3),
                // label === key (all-lowercase style): the raw lane names ride
                // the state and the pure fn builds the pill copy from them.
                unreadable: LEDGER_LANES.filter((_, i) => settled[i].status !== 'fulfilled').map(lane => lane.label),
            })
        })
        return () => { cancelled = true }
    }, [proposal, campaignName])

    const ask = async () => {
        setAsking(true); setResult(null); setProposal(null); setApplied(false); setLedgerNames(null)
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

// MMM 2026-11-21 + Backlog 2026-11-22 — the quest card's ledger-scrutiny face:
// exactly one of pending / incomplete / verdict can legitimately show. While
// the fetch is in flight (ledgerNames === null) the card is NOT scrutiny-clean,
// it is un-checked — say so quietly so the advisory's late arrival is never
// misread as an all-clear. If any lane came back UNREADABLE, no verdict is
// honest against a partial ledger: the incomplete face replaces advisory AND
// all-clear silence alike. The settled verdicts (advisory or incomplete reason)
// keep riding the applied receipt (name-scrutiny law); only the in-flight
// "Checking…" pill retires once the card is terminal. Purely informational —
// the action row never gates.
function ledgerFace(proposal, ledgerNames, applied) {
    if (proposal.kind !== 'quest_draft') return 'none'
    if (ledgerNames === null) return applied ? 'none' : 'pending'
    if (ledgerNames.unreadable.length > 0) return 'incomplete'
    return 'verdict'
}

function WorldProposalCard({ proposal, ledgerNames, applied, onAct, onDismiss }) {
    const body = proposal.kind === 'quest_draft'
        ? `${proposal.name} — ${proposal.description}${proposal.rewards ? ` (rewards: ${proposal.rewards})` : ''}`
        : `${proposal.kind === 'npc_dialogue' ? `${proposal.npcName}: ` : ''}${proposal.text}`
    const unknownNames = findUnknownLedgerNames(proposal, ledgerNames)
    const face = ledgerFace(proposal, ledgerNames, applied)
    const unreadableLanes = (ledgerNames && ledgerNames.unreadable) || []
    return (
        <div className="ai-world-card">
            <div className="ai-world-head">
                <b>{proposal.kind.replace('_', ' ')}</b>
                {typeof proposal.confidence === 'number' && <em className="ai-confidence">confidence {(proposal.confidence * 100).toFixed(0)}%</em>}
            </div>
            <p className="ai-world-body">{body}</p>
            {face === 'pending' && (
                <div className="ai-world-pending" role="status">
                    <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    Checking ledger names…
                </div>
            )}
            {face === 'incomplete' && (
                <div className="ai-world-pending ai-world-pending--incomplete" role="status">
                    <i className="fas fa-triangle-exclamation" aria-hidden="true"></i>
                    {incompleteLedgerCopy(unreadableLanes)}
                </div>
            )}
            {face === 'verdict' && unknownNames.length > 0 && (
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
