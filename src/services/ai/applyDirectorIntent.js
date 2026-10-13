/**
 * Level 5 Phase 3 (plan §9.3) — confirmed director-intent apply.
 *
 * The referee console (Initiative panel) calls this ONLY after a human
 * confirm in suggest mode; autopilot auto-applies the harmless subset.
 * Every confirmed intent walks the SAME lanes the GM's own clicks walk:
 *  - attack/cast → the existing target-anchor stamp (handleTargetChange →
 *    setTarget + combatSummary sync). Selecting a target is what the AI
 *    decided; the dice, hit and damage then resolve on the monster's own
 *    card lane — the model never rolls and this never fabricates results.
 *  - utility     → same stamp when a target came with it; the card lane runs
 *    the action.
 *  - move        → ADVISORY ONLY: the token lane is drag-based (with its own
 *    movement-budget enforcement), so the panel surfaces "move up to X ft."
 *    and the GM drags. Programmatic token pathing is §16 parked.
 *  - pass/talk   → plain campaign log entries (mutate nothing).
 * Nothing here runs unconfirmed in suggest mode; every outcome is logged.
 */
import { addEntry } from '../ui/logService.js'

function audit(campaignName, intent, outcome, detail) {
    return addEntry(campaignName, {
        type: 'ai_director_applied',
        name: 'AI director',
        characterName: intent.creatureName,
        description: `AI director ${outcome}: ${intent.intent} — ${String(detail).slice(0, 220)}`,
    }).catch((e) => { console.error('[applyDirectorIntent:audit]', e) })
}

function stamp(who, intent, onStampTarget) {
    if (!onStampTarget) {
        return { applied: false, detail: 'no target lane available here — select the target on the card' }
    }
    onStampTarget(who, intent.targetName)
    return { applied: true, detail: `${intent.actionName} → ${intent.targetName}: target set. Run it on ${who}'s card — the engine rolls, not the AI.` }
}

const INTENT_APPLY = {
    attack: stamp,
    cast: stamp,
    utility: (who, intent, onStampTarget) => intent.targetName
        ? stamp(who, intent, onStampTarget)
        : { applied: true, detail: `${who} — ${intent.actionName} (self/no target): run it on ${who}'s card` },
    move: (who, intent) => ({
        applied: false,
        advisory: true,
        detail: `${who} intends to move ${intent.feet} ft.${intent.direction ? ` (${intent.direction})` : ''} — drag the token on the map (movement budget enforces the cap).`,
    }),
    pass: (who) => ({ applied: true, detail: `${who} passes — logged.` }),
    talk: (who, intent) => ({ applied: true, detail: `${who}: "${String(intent.text || '').slice(0, 180)}"` }),
}

/**
 * @param {{ campaignName: string, intent: object, onStampTarget?: Function }} args
 *   onStampTarget(creatureName, targetName) — the existing handleTargetChange lane.
 * @returns {Promise<{applied:boolean, advisory?:boolean, detail:string}>}
 */
export async function applyDirectorIntent({ campaignName, intent, onStampTarget }) {
    if (!intent || !intent.intent || intent.intent === 'needs_human') {
        return { applied: false, detail: intent?.text || 'no intent to apply' }
    }
    const apply = INTENT_APPLY[intent.intent]
    let result
    if (!apply) {
        result = { applied: false, detail: `unknown intent '${intent.intent}' — refused` }
    } else {
        try {
            result = apply(intent.creatureName || 'the NPC', intent, onStampTarget)
        } catch (e) {
            console.error('[applyDirectorIntent]', e)
            result = { applied: false, detail: `apply failed: ${String(e.message || e).slice(0, 160)}` }
        }
    }
    await audit(campaignName, intent, result.applied ? 'confirmed' : (result.advisory ? 'advisory' : 'refused'), result.detail)
    return result
}

/** Auto-safe in autopilot: writes at most a target stamp or a log entry (move is advisory-only). */
export function isAutoSafeIntent(intent) {
    return !!intent && ['attack', 'cast', 'pass', 'talk', 'utility', 'move'].includes(intent.intent)
}
