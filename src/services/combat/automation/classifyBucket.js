/**
 * Level 1–5 (L5-002) — economy bucket taxonomy, single source (plan §7.2).
 *
 * routeAutomation INFERS buckets for display routing; this module formalizes
 * the same inference as a named classification consumed by the enforcement
 * gate (assertCanAct/bucketForAction) and every charging site — so router and
 * gate never diverge on what an action "is".
 *
 * classifyBucket(subject) → 'action' | 'bonusAction' | 'reaction' | 'free'
 *                          | 'special' | 'passive'
 * Accepts automation rows ({ automation }), automation info objects, attack
 * rows ({ type: 'Bonus Action' }), and spells ({ casting_time }).
 */
import { normalizeCastingTime } from '../../shared/castingTimeUtils.js'

export const BUCKETS = Object.freeze(['action', 'bonusAction', 'reaction', 'free', 'special', 'passive'])

/** Buckets that never charge an economy slot (mirrors turnState FREE_BUCKETS). */
export const FREE_BUCKETS = Object.freeze(['free', 'special', 'passive', 'none'])

export function isChargeableBucket(bucket) {
    return !FREE_BUCKETS.includes(bucket)
}

// Decision tables keep the classifier flat (lint complexity) and the taxonomy
// greppable in one place. Lookup order: explicit sheet lane → automation.action
// → normalized casting_time → safe default 'action'.
const ROW_BUCKET = {
    'bonus action': 'bonusAction',
    'reaction': 'reaction',
    'free interaction': 'free',
    'special action': 'special',
    'passive': 'passive',
    // §18 D3 (2024 dual-ruleset audit): the passive family appears in BOTH
    // rulesets' data (passive_rule/passive_buff/passive_immunity/save_proficiency/
    // conditional_advantage) — classify them passive instead of defaulting them
    // to 'action'. Rows never clicked (passive prose) never reach the gate, so
    // off-mode gameplay is untouched; clicked bonus_action-typed rows (feats in
    // 2024 classes/feats data) now charge the BONUS slot, not the Action slot.
    'passive rule': 'passive',
    'passive buff': 'passive',
    'passive immunity': 'passive',
    'save proficiency': 'passive',
    'conditional advantage': 'passive',
}
const ACTION_BUCKET = {
    bonus_action: 'bonusAction',
    reaction: 'reaction',
    passive: 'passive',
    none: 'free',
    free: 'free',
}
const CASTING_BUCKET = {
    '1 bonus action': 'bonusAction',
    '1 reaction': 'reaction',
    passive: 'passive',
}

export function classifyBucket(subject) {
    if (!subject || typeof subject !== 'object') return 'action'
    const auto = (subject.automation && typeof subject.automation === 'object') ? subject.automation : subject
    // §18 D3: row types arrive in both dialects — 'Bonus Action' (5e sheets),
    // 'bonus_action' (2024 Essentials data). Normalize like casting times so
    // one table serves both rulesets (never diverge on what an action "is").
    const typeKey = String(subject.type || auto.type || '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
    const byRow = ROW_BUCKET[typeKey]
    if (byRow) return byRow
    const byAction = ACTION_BUCKET[String(auto.action || '').toLowerCase()]
    if (byAction) return byAction
    const ct = normalizeCastingTime(auto.casting_time || auto.castTime || subject.casting_time || '')
    if (CASTING_BUCKET[ct]) return CASTING_BUCKET[ct]
    // Compounds the normalizer passes through ('1 bonus action (ritual)',
    // '1 reaction, when targeted'…) still classify by their leading form.
    // §18 D3 audit BUGFIX: the leading-form promise existed for bonus ONLY —
    // compound reaction casts ('1 reaction, when targeted' — counterspell/
    // hellish rebuke shapes) silently defaulted to 'action' and would have
    // charged an Action slot under enforcement.
    if (/^1?\s*bonus action/i.test(String(ct))) return 'bonusAction'
    if (/^1?\s*reaction/i.test(String(ct))) return 'reaction'
    return 'action'
}
