// @maintained-by-ai
// LANE: ephemeral GM effect-adder open-modal flag (backlog EP 2026-11-08
// combat-ui-effectAdderTarget orphans). The flag rides the shared campaign
// change-data store (AGENTS-sanctioned combat-UI state) but must EVICT on
// every close, never POST null: a POSTed null persisted a ghost key in
// change-data (live-probed pre-fix: Cancel left `key: null`, a view-switch
// while open left `{name…}`) that rehydrated on every client + campaign
// re-select until the next full clear. Mirrors the savePrompt drain-to-evict
// lane — deleteRuntimeKey → server DELETE + null echo; its has() guard makes
// the cancel/apply double-sweep idempotent (no honest-404 churn).
import { useCallback, useEffect } from 'react'
import { deleteRuntimeKey } from '../../hooks/runtime/useRuntimeState.js'
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js'

const EFFECT_ADDER_TARGET_KEY = 'combat-ui-effectAdderTarget'

/**
 * @param {string} campaignName
 * @returns {[*, function, function]} [target, openTarget, closeTarget] —
 *   openTarget(creature) writes the synced flag; closeTarget(null) evicts the
 *   key (DELETE lane). Leaving the tracker view while the modal is still
 *   rendered (view-switch / campaign switch — Initiative owns the only render
 *   of EffectAdder) also evicts on detach, so the flag never orphans.
 */
export function useEffectAdderTarget(campaignName) {
    const [target, setTarget] = useSyncedState('campaign', EFFECT_ADDER_TARGET_KEY, null, campaignName)

    const closeTarget = useCallback((value) => {
        if (value == null) {
            deleteRuntimeKey('campaign', EFFECT_ADDER_TARGET_KEY, campaignName)
        } else {
            setTarget(value)
        }
    }, [campaignName, setTarget])

    useEffect(() => () => {
        deleteRuntimeKey('campaign', EFFECT_ADDER_TARGET_KEY, campaignName)
    }, [campaignName])

    return [target, setTarget, closeTarget]
}
