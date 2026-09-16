// MA-0268: Androsphinx Roar staged resolution. RAW: the sphinx roars up to
// 3 times before a long rest and each roar is LOUDER — the Nth click must
// resolve ONLY the Nth stage's canonical legs, never the conflated union of
// all three (pre-fix every click rolled 8d10 thunder + Deafened/Frightened/
// Prone regardless of stage):
//   Stage 1 (WIS DC 18): fail → frightened 1 minute, repeat save at the end
//     of each of its turns, success ends it. ZERO damage; success zero.
//   Stage 2 (WIS DC 18): fail → deafened AND frightened 1 minute, repeat
//     saves. ZERO damage; success zero.
//   Stage 3 (CON DC 18): fail → 8d10 thunder + prone; success → half damage,
//     not prone (dc_success half).
//
// Stage state rides the MA-0020 per-day counter (monsterSpellUses, keyed
// 'Roar' per monster, persisted in the runtime store, spend at prompt-confirm
// in saveProcessing.applySaveOutcome) — stage = used + 1, so there is NO
// second counter. The 3/day gate (maxUses:3 on the row) refuses the 4th
// click before this resolver runs (monsterAbilityUses.js gate + roar_refused
// log). Per-day counters reset at dawn GM-enforced — no monster long-rest
// hook consumer exists app-wide (MA-0215 precedent).
//
// The end-of-turn re-save legs for stages 1-2 arm via the existing MA-0048
// repeat_save seam (saveProcessing arms trackFrightfulPresence on a failed
// save: frightened te + 10-round 1-minute clock + turn-END repeat save).
// Residuals (documented, CLA-325 GM-enforced family): the re-save tracker is
// the Frightful Presence te (marker label + prompt copy read "Frightful
// Presence"), and stage-2 Deafened has no auto-expiry on the repeat-save
// success (the FP clock strips Frightened only) — GM sheds Deafened manually.
import { abilitySaveMaxUses, abilitySaveUseKey } from '../../encounters/monsterAbilityUses.js';

export const STAGED_ROAR_MAX_DEFAULT = 3;

// Stage-canonical description + machine save_effect per stage (the stage
// sentences lifted verbatim from the canonical row prose). Both surfaces are
// swapped per stage because extractDamageDiceFromDescription FALLS BACK to
// parsing the description when damage_dice_primary is null — a stage 1/2
// click over the raw union description would still re-extract 8d10. Stage
// text carries ONLY its own condition words, so the conflated-union grant is
// structurally impossible once the swap lands; stage 1/2 texts carry no
// "Failure: N (dice)" pattern → the damageless-save branch always (zero
// damage honest); dc_success 'none' prints honest "No damage on successful
// save" copy.
const ROAR_STAGES = {
    1: {
        saveType: 'Wisdom',
        dcSuccess: 'none',
        damage: false,
        repeatSaveType: 'Wisdom',
        description: 'First Roar (1 of 3). The sphinx emits a magical roar. Each creature within 500 feet of the sphinx and able to hear the roar must make a saving throw. Each creature that fails a DC 18 Wisdom saving throw is frightened for 1 minute. A frightened creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. This roar deals no damage.',
        saveEffect: 'First Roar (1 of 3): Failure: frightened for 1 minute. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. Success: no effect. This effect deals no damage.',
    },
    2: {
        saveType: 'Wisdom',
        dcSuccess: 'none',
        damage: false,
        repeatSaveType: 'Wisdom',
        description: 'Second Roar (2 of 3). The sphinx emits a louder magical roar. Each creature within 500 feet of the sphinx and able to hear the roar must make a saving throw. Each creature that fails a DC 18 Wisdom saving throw is deafened and frightened for 1 minute. A frightened creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. This roar deals no damage.',
        saveEffect: 'Second Roar (2 of 3): Failure: deafened and frightened for 1 minute. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. Success: no effect. This effect deals no damage.',
    },
    3: {
        saveType: 'Constitution',
        dcSuccess: 'half',
        damage: true,
        repeatSaveType: null,
        description: 'Third Roar (3 of 3). The sphinx emits its loudest magical roar. Each creature within 500 feet of the sphinx and able to hear the roar must make a saving throw. Each creature makes a DC 18 Constitution saving throw. On a failed save, a creature takes 44 (8d10) thunder damage and is knocked prone. On a successful save, the creature takes half as much damage and isn\'t knocked prone.',
        saveEffect: 'Third Roar (3 of 3): Failure: 44 (8d10) thunder damage and knocked prone. Success: half damage and not knocked prone.',
    },
};

export function isStagedRoarAction(action) {
    return action?.staged_roar === true;
}

export function stagedRoarMaxUses(action) {
    return abilitySaveMaxUses(action) ?? STAGED_ROAR_MAX_DEFAULT;
}

// Stage number for the NEXT click, derived from the persisted per-day spend
// counter (monsterSpellUses[useKey]). Returns null for non-staged rows and
// when the counter shows the roar exhausted (the MA-0020 gate refuses that
// click before this runs — the null is a defensive guard, not the refusal).
export function roarStageNumber(action, storedUses) {
    if (!isStagedRoarAction(action)) return null;
    const maxUses = stagedRoarMaxUses(action);
    const useKey = abilitySaveUseKey(action);
    const used = Number(storedUses?.[useKey]) || 0;
    if (used >= maxUses) return null;
    return used + 1;
}

// Stage-swapped action copy: same save_dc/usage/name family, per-stage
// save_type, dc_success, damage dice/type (null on the damageless stages),
// machine save_effect and MA-0048 repeat_save object (save_type required —
// booleans silently kill the armer, MA-0147). The honest stage label
// "Roar N of 3" flows into the prompt, damage/condition/spend logs via
// context.actionName.
export function buildRoarStageAction(action, stage) {
    const mech = ROAR_STAGES[stage];
    if (!mech) return null;
    return {
        ...action,
        name: `Roar ${stage} of ${stagedRoarMaxUses(action)}`,
        description: mech.description,
        save_type: mech.saveType,
        dc_success: mech.dcSuccess,
        damage_dice_primary: mech.damage ? (action.damage_dice_primary ?? null) : null,
        damage_type_primary: mech.damage ? (action.damage_type_primary ?? 'Thunder') : null,
        save_effect: mech.saveEffect,
        repeat_save: mech.repeatSaveType ? { condition: 'frightened', save_type: mech.repeatSaveType, duration_minutes: 1 } : null,
    };
}

// Modal click seam (MonsterCardModal.handleSaveRoll, after the MA-0020 uses
// gate): returns the stage-adjusted action for this click, or null when the
// row is not staged / the stage is unresolvable (console.error on overrun so
// a bypassed gate is loud, not silent).
export function resolveRoarStageAction({ action, usesGate }) {
    if (!isStagedRoarAction(action)) return null;
    const maxUses = usesGate?.maxUses ?? stagedRoarMaxUses(action);
    const used = usesGate?.used ?? 0;
    const stage = used + 1;
    if (stage > maxUses) {
        console.error(`[roarService] MA-0268 stage overrun: ${action.name} stage ${stage} > max ${maxUses} — no stage resolution.`);
        return null;
    }
    return buildRoarStageAction(action, stage);
}
