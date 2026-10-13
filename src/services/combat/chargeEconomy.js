/**
 * Level 5 (L5-002) — persistence wrapper for economy charging (plan §7.2/§7.3).
 *
 * Bridges the pure turnState math to the runtime store, mirroring the
 * applyTurnStateTransition persistence pattern in navigationHandlers
 * (cloneDeep + setRuntimeValue('campaign','turnState')) so charges ride the
 * same SSE broadcast as turn transitions.
 *
 * Off-switches: enforcement off ⇒ every function is a zero-write no-op —
 * the L1–4 guarantee. actionEconomy gates slot charges; movementBudget
 * gates movement charges; enforcement.referee/off-mode refunds allowed.
 */
import { cloneDeep } from 'lodash'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { spend, refund, spendMovement } from './turnState.js'
import { isChargeableBucket } from './automation/classifyBucket.js'

function enforcementFlag(flag) {
    const enforcement = getRuntimeValue('campaign', 'enforcement')
    return !!(enforcement && enforcement.mode === 'on' && enforcement[flag])
}

function persist(next, campaignName) {
    setRuntimeValue('campaign', 'turnState', next, campaignName)
}

/**
 * Charge one economy slot for a creature. Returns true when the slot was
 * charged. Refuses (false) when enforcement/economy is off, the bucket is
 * free, or the budget is exhausted (race backstop — the caller gated first).
 */
export function chargeSlot({ creatureName, bucket, campaignName }) {
    if (!creatureName || !campaignName) return false
    if (!enforcementFlag('actionEconomy')) return false
    if (!isChargeableBucket(bucket)) return true // free actions "succeed" without writing
    const ts = cloneDeep(getRuntimeValue('campaign', 'turnState') || {})
    const res = spend(ts, creatureName, bucket)
    if (!res.ok) return false
    persist(res.turnState, campaignName)
    return true
}

/** Un-charge one economy slot (modal cancel / referee correction). */
export function refundSlot({ creatureName, bucket, campaignName }) {
    if (!creatureName || !campaignName) return false
    if (!enforcementFlag('actionEconomy')) return false
    if (!isChargeableBucket(bucket)) return true
    const ts = cloneDeep(getRuntimeValue('campaign', 'turnState') || {})
    const res = refund(ts, creatureName, bucket)
    if (!res.ok) return false
    persist(res.turnState, campaignName)
    return true
}

/** Charge movement feet on drop. Returns feet actually charged (may be 0). */
export function chargeMovement({ creatureName, feet, campaignName }) {
    if (!creatureName || !campaignName) return 0
    if (!enforcementFlag('movementBudget')) return 0
    const ts = cloneDeep(getRuntimeValue('campaign', 'turnState') || {})
    const res = spendMovement(ts, creatureName, feet)
    if (!res.ok || res.feetCharged === 0) return 0
    persist(res.turnState, campaignName)
    return res.feetCharged
}
