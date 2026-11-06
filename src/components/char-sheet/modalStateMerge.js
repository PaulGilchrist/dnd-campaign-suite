// @maintained-by-ai
/**
 * Merge the two char-sheet modal-state channels:
 * - modalState — the attack/feature lane's own modal state (owned by
 *   useCharActionModals; written by the damage pipeline, e.g. the
 *   Devious Strikes chooser opened via setAttackRiderModal).
 * - spellModalState — the shared parent mirror (CharSheet's
 *   charActionsModalState) written by the spell lane (CharSpells) AND by
 *   every forwarded update of the CharActions wrapper setter (which modal
 *   closes route through).
 *
 * Spell-channel payloads win collisions (pinned by
 * CharActionModals.rendering.test.jsx) because spell-lane modals live ONLY
 * in the parent mirror. But the parent mirror is update-REPLACED with the
 * last forwarded delta, so a close forwarded as { attackRiderModal: null }
 * (e.g. closing the Devious Strikes chooser after cycle 1) lingers there
 * and used to veto the NEXT cycle's open — the pipeline-side setter writes
 * modalState only. A jammed chooser leaves the attack pipeline paused at
 * cunningStrike: ✓ HIT deals zero damage with zero feedback and the sneak
 * latch is never consumed (bug-sheet-nick-mastery-hit-drops-damage-stage).
 *
 * Law: a null (close) in the spell channel may never suppress a LIVE open
 * in the attack channel. Closes still land because close paths write BOTH
 * channels through the CharActions wrapper setter.
 */
export function mergeModalStates(modalState, spellModalState) {
    const result = { ...modalState, ...spellModalState };
    for (const [key, localValue] of Object.entries(modalState)) {
        if (localValue != null && result[key] == null) result[key] = localValue;
    }
    return result;
}
