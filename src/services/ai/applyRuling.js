/**
 * Level 5 Phase 3 (L5-005, plan §9.2/§9.5) — confirmed-ruling apply.
 *
 * The referee console calls this ONLY after a human confirm (suggest mode)
 * or immediately for atomic ops in autopilot. Every apply walks the SAME
 * lanes a manual GM action walks (Principle 3):
 *  - narrative      → campaign log entry (mutates nothing)
 *  - dice           → the ENGINE rolls: server oracle when enforcement.serverDice
 *                    is on (§7.4), client diceRoller otherwise; result logged
 *  - target_effect→ the campaign targetEffects store, exactly like the GM
 *                    manual adder (createEffectAdderHandlers); unknown keys
 *                    are REFUSED (the registry is the contract)
 *  - hp_change    → the target's runtime currentHitPoints (characters);
 *                    NPCs and anything else is refused — HP of monsters is
 *                    resolved on their existing sheet/panel lanes
 *  - automation   → NEVER auto-executed in P3 (surfaced, referee runs it
 *                    on the existing automation lanes) — §16 parked
 *
 * Nothing here runs unconfirmed in suggest mode, nothing fabricates state,
 * and every outcome (applied/refused) is audit-logged as ai_ruling_applied.
 */
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../ui/logService.js'
import { rollExpression, rollAdvantage, rollDisadvantage } from '../dice/diceRoller.js'
import { getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js'
import { serverRoll } from './aiClient.js'

const D20_RE = /^1?d20([+-]\d+)?$/i

function audit(campaignName, ruling, outcome, detail) {
    return addEntry(campaignName, {
        type: 'ai_ruling_applied',
        name: 'AI referee',
        description: `AI ruling ${outcome}: ${ruling.type} — ${String(detail).slice(0, 220)}`,
        ruling,
    }).catch((e) => { console.error('[applyRuling:audit]', e) })
}

async function applyDice({ campaignName, ruling, enforcement }) {
    const mode = ruling.mode || 'normal'
    let roll
    if (enforcement?.mode === 'on' && enforcement?.serverDice) {
        roll = await serverRoll({ campaignName, expression: ruling.expression, mode, reason: 'AI referee ruling' })
    } else if (D20_RE.test(ruling.expression.trim()) && mode !== 'normal') {
        roll = mode === 'advantage' ? rollAdvantage() : rollDisadvantage()
    } else {
        roll = rollExpression(ruling.expression)
    }
    if (!roll) throw new Error(`dice roll failed for expression: ${ruling.expression}`)
    const detail = `${ruling.expression}${mode !== 'normal' ? ` (${mode})` : ''} rolled [${(roll.rolls || []).join(', ')}] → ${roll.total}${roll.roller === 'server' ? ' [server dice]' : ''}`
    await addEntry(campaignName, {
        type: 'roll',
        name: `AI referee: ${ruling.targetName || 'roll'}`,
        rolls: roll.rolls,
        total: roll.total,
        description: detail,
    }).catch((e) => { console.error('[applyRuling:roll-log]', e) })
    return { applied: true, detail }
}

async function applyTargetEffect({ campaignName, ruling }) {
    if (!getEffectDefinition(ruling.effect)) {
        return { applied: false, detail: `unknown target effect '${ruling.effect}' — not in the effect registry (refused)` }
    }
    const existing = getRuntimeValue('campaign', 'targetEffects') || []
    const filtered = existing.filter(te => !(te.target === ruling.targetName && te.effect === ruling.effect))
    const entry = { target: ruling.targetName, effect: ruling.effect, source: 'AI referee' }
    setRuntimeValue('campaign', 'targetEffects', [...filtered, entry], campaignName)
    return { applied: true, detail: `${ruling.effect} applied to ${ruling.targetName} (GM-managed duration — remove via the badge)` }
}

async function applyHpChange({ campaignName, ruling }) {
    const current = getRuntimeValue(ruling.targetName, 'currentHitPoints', campaignName)
    if (typeof current !== 'number') {
        return { applied: false, detail: `${ruling.targetName} has no runtime HP track (NPCs resolve on their existing lanes) — refused` }
    }
    const next = Math.max(0, current + ruling.amount)
    setRuntimeValue(ruling.targetName, 'currentHitPoints', next, campaignName)
    const downnote = next === 0 ? ' — at 0 HP, death saves on their sheet' : ''
    return { applied: true, detail: `${ruling.targetName}: ${current} → ${next} HP${downnote}` }
}

const APPLIERS = {
    async narrative({ ruling }) {
        return { applied: true, detail: ruling.text }
    },
    dice: applyDice,
    target_effect: applyTargetEffect,
    hp_change: applyHpChange,
    async automation({ ruling }) {
        return { applied: false, detail: `automation '${ruling.actionName}' is surfaced, not auto-run (P3 parked) — run it on the action's own lane` }
    },
    async needs_human({ ruling }) {
        return { applied: false, detail: ruling.text }
    },
}

/**
 * Apply a confirmed ruling. Returns { applied, detail } — the console shows
 * the detail and everything is audit-logged either way.
 */
export async function applyRuling({ campaignName, ruling, enforcement }) {
    if (!ruling || !ruling.type) return { applied: false, detail: 'no ruling to apply' }
    const apply = APPLIERS[ruling.type]
    if (!apply) return { applied: false, detail: `unknown ruling type '${ruling.type}' — refused` }
    let result
    try {
        result = await apply({ campaignName, ruling, enforcement })
    } catch (e) {
        console.error('[applyRuling]', e)
        result = { applied: false, detail: `apply failed: ${String(e.message || e).slice(0, 160)}` }
    }
    await audit(campaignName, ruling, result.applied ? 'applied' : 'refused', result.detail)
    return result
}

/** Atomic = safe to auto-apply in autopilot without a confirm click. */
export function isAtomicRuling(ruling) {
    return !!ruling && (ruling.type === 'narrative' || ruling.type === 'dice' || ruling.type === 'hp_change' || ruling.type === 'target_effect')
}
