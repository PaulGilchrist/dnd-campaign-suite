// @maintained-by-ai
// Single owner of the loud `.mc-no-target-refusal` lane (MA-0049 save-chip
// precedent, TA-1116 attack-chip parity, 2026-11-18 sheet-attack improve).
// The two builders were lifted out of MonsterCardHelpers.js — the chip
// default copy stays byte-identical (pinned by MonsterCardHelpers.usage
// .test.js via the re-export) — and the predicate + composite refusal front
// the PC sheet lane: a weapon ATTACK row pressed while the character's
// combatSummary row carries NO targetName refuses LOUD with ZERO roll, ZERO
// dice popup and NOTHING spent (it never reaches the roll-time consumes:
// Sanctuary end, action-slot charge, _attackActionTakenRound stamps, …).
// Scope law: only the attack-roll lane is gated. A press that already
// carries an explicit ctx.targetName (monster chips, OA marked-movers,
// Glorious Defense counterattack, automation riders, spell-cast lane) never
// consults the board, and with NO board at all (out-of-combat roll) the
// gate stays inert. Check/save/damage rolls are untouched.
const SHEET_ARM_HINT = 'Arm a target with the Target select on the initiative card';

export function buildNoTargetRefusalPopup({ monsterName, actionName, rollNoun = 'save', armHint }) {
    const isSave = rollNoun !== 'attack';
    const aoeNote = isSave ? ' (AoE rows pick their own area targets)' : '';
    const hint = armHint || 'Arm a target with the Target select at the top of this card (or on the initiative card)';
    return `<div class="mc-no-target-refusal"><h3>No Target</h3><p>${monsterName} cannot use ${actionName} — no target is armed on ${monsterName}'s initiative card. ${hint}${aoeNote}. No ${isSave ? 'save' : 'attack'} rolled, nothing spent.</p></div>`;
}

export function buildNoTargetRefusalLog({ monsterName, actionName, rollNoun = 'save' }) {
    const slug = String(actionName || 'action').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return {
        type: 'automation',
        automationType: `${slug}_refused`,
        characterName: monsterName,
        abilityName: actionName,
        description: `${monsterName} ${actionName} refused (no target) — no armed target on the initiative card, no self-resolve. Zero spend, ${rollNoun === 'attack' ? 'no attack rolled' : 'no save prompt'}.`,
        timestamp: Date.now(),
    };
}

/**
 * Board truth for an attack press: refuses ONLY when the attacker has a row
 * on the initiative board and that row carries no armed targetName. An
 * explicit targetName on the press (chip/OA/automation lanes) or the absence
 * of a board (out-of-combat roll) keeps the roll lane byte-identical.
 */
export function isUnarmedAttackPress({ combatSummary, attackerName, explicitTargetName }) {
    if (explicitTargetName) return false;
    const creatures = combatSummary?.creatures;
    if (!creatures?.length || !attackerName) return false;
    const row = creatures.find(c => c.name === attackerName)
        || creatures.find(c => c.name.startsWith(`${attackerName} `));
    return !!row && !row.targetName;
}

/**
 * Loud refusal seam shared by the sheet weapon-row handler and the
 * createLogAndShow attack lane: sets the `.mc-no-target-refusal` popup
 * (names the character + weapon, points at the initiative card's Target
 * select) and writes the `<weapon-slug>_refused` zero-spend log row via the
 * caller's log lane. Returns true when the press was refused.
 */
export function refuseUnarmedAttackPress({ combatSummary, attackerName, explicitTargetName, actionName, setPopupHtml, log }) {
    if (!isUnarmedAttackPress({ combatSummary, attackerName, explicitTargetName })) return false;
    setPopupHtml(buildNoTargetRefusalPopup({ monsterName: attackerName, actionName, rollNoun: 'attack', armHint: SHEET_ARM_HINT }));
    log(buildNoTargetRefusalLog({ monsterName: attackerName, actionName, rollNoun: 'attack' }));
    return true;
}
