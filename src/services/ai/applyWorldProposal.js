/**
 * Level 5 Phase 3 (plan §9.4) — confirmed world-keeper proposal apply.
 *
 * The referee console calls this ONLY after a human confirm. Confirmed
 * payloads ride the SAME lanes the GM's own actions ride:
 *  - recap / rumor / event / npc_dialogue → campaign log entry (the log
 *    IS the record of the fiction; mutates nothing else)
 *  - quest_draft → the normal quests CRUD lane (loadQuests → append →
 *    saveQuests, exactly what the Quest Manager does), stamped as
 *    AI-drafted so provenance is visible in the ledger
 * Nothing here runs unconfirmed; every outcome is audit-logged.
 */
import { addEntry } from '../ui/logService.js'
import { loadQuests, saveQuests } from '../campaign/questsService.js'
import utils from '../ui/utils.js'

function audit(campaignName, proposal, outcome, detail) {
    return addEntry(campaignName, {
        type: 'ai_world_applied',
        name: 'AI world keeper',
        description: `AI world keeper ${outcome}: ${proposal.kind} — ${String(detail).slice(0, 220)}`,
    }).catch((e) => { console.error('[applyWorldProposal:audit]', e) })
}

async function addQuestDraft(campaignName, proposal) {
    const quests = await loadQuests(campaignName)
    const quest = {
        // Every Quests CRUD consumer keys rows by id (list key, DELETE route,
        // edit-map match) — stamp one exactly like the manual create lane
        // (Quests.jsx handleSave) or the row is undeletable and collides.
        id: utils.safeUuid(),
        name: proposal.name,
        status: 'active',
        description: proposal.description,
        rewards: proposal.rewards || '',
        notes: 'AI-drafted — confirmed by the referee',
    }
    await saveQuests(campaignName, [...(quests || []), quest])
    return { applied: true, detail: `quest '${proposal.name}' added to the ledger (AI-drafted)` }
}

function narrativeApply(campaignName, proposal) {
    const who = proposal.kind === 'npc_dialogue' ? `${proposal.npcName}: ` : ''
    return { applied: true, detail: `${who}${String(proposal.text || '').slice(0, 400)}` }
}

const KIND_APPLY = {
    quest_draft: addQuestDraft,
    recap: narrativeApply,
    rumor: narrativeApply,
    event: narrativeApply,
    npc_dialogue: narrativeApply,
}

/**
 * @param {{ campaignName: string, proposal: object }} args
 * @returns {Promise<{applied:boolean, detail:string}>}
 */
export async function applyWorldProposal({ campaignName, proposal }) {
    if (!proposal || !proposal.kind || proposal.kind === 'needs_human') {
        return { applied: false, detail: proposal?.text || 'no proposal to apply' }
    }
    const apply = KIND_APPLY[proposal.kind]
    let result
    if (!apply) {
        result = { applied: false, detail: `unknown kind '${proposal.kind}' — refused` }
    } else {
        try {
            result = await apply(campaignName, proposal)
        } catch (e) {
            console.error('[applyWorldProposal]', e)
            result = { applied: false, detail: `apply failed: ${String(e.message || e).slice(0, 160)}` }
        }
    }
    if (result.applied && proposal.kind !== 'quest_draft') {
        await addEntry(campaignName, {
            type: 'narrative',
            name: proposal.kind === 'npc_dialogue' ? proposal.npcName : 'World keeper',
            description: result.detail,
        }).catch((e) => { console.error('[applyWorldProposal:log]', e) })
    }
    await audit(campaignName, proposal, result.applied ? 'applied' : 'refused', result.detail)
    return result
}
