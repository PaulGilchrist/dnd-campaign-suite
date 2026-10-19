// @maintained-by-ai
// MA-0427: the block-save transport must carry authored secondary damage
// (monsters.json brazen-gorgon actions[2] damage_dice_secondary "3d8" Fire)
// from the save chip through buildSaveOptions + buildAbilitySaveRollContext
// to saveProcessing. Rows without a secondary keep every secondary field null.
//
// MA-0551: Dao Earth Burst — composite attack+save row whose save_effect
// Failure clause carries its own dice ("Failure: 10 (3d6) Thunder damage.").
// The attack chip context carries NO saveDc; the SAVE chip adjudicates the
// save_effect secondary dice (3d6 Thunder) with dc_success:'none'
// zero-on-success. Pure-save twins stay byte-identical.
//
// MA-0560: Death Dog Bite — rider-only composite (save_leg gates a CONDITION
// rider only, no damage pool anywhere in the save leg): the DC chip arms NO
// damage formula; the fixed 1d4 + 2 primary pays FULL on the attack chip
// both save outcomes; the save adjudicates the Poisoned rider alone. The
// (1d10) HP-max ladder is advisory (§70 readers-only, no producer) and must
// never enter the damage transport.
//
// CANONICAL OWNER of the save-transport bytes + composite-fork predicate
// truth tables (cited by ma1329/ma1427/ma1563/ma1071/ma1000/ma1971/
// giant-snake/tarrasque lanes). Full exact toEqual per transport case —
// never toMatchObject: the absent-vs-null byte of secondaryCondition is
// itself transported identity. Zero-mock lane (pure DI builder calls;
// getRuntimeValue never fires — no row here carries save_hp_max_reduce),
// no timers, no re-implemented transport in the test body (§710) — every
// expected byte is hand-authored. Consumer math (half/zero/applyDamage,
// condition landing, roll popups, chip plans) stays with its own owners.
import { describe, it, expect } from 'vitest';
import { buildSaveOptions, buildAbilitySaveRollContext, isCompositeAttackSaveRow, saveLegCarriesSecondaryDamage, saveLegIsConditionRider } from './MonsterCardModal.jsx';

// MA-0551: Dao Earth Burst — composite attack+save row whose save_effect
// Failure clause carries its own dice ("Failure: 10 (3d6) Thunder damage.").
const daoRow = {
    name: 'Earth Burst',
    description: 'Ranged Attack Roll: +10, range 120 ft. <strong>Hit:</strong> 15 (2d8 + 6) Bludgeoning damage. Hit or Miss: Earth explodes from the target\'s space, creating the following effect. Dexterity Saving Throw: DC 16, each creature in a 10-foot <strong>Emanation</strong> originating from and including the target. <strong>Failure:</strong> 10 (3d6) Thunder damage.',
    attack_bonus: 10,
    range: '120 ft.',
    save_dc: 16,
    save_type: 'Dexterity',
    range_save: '10-foot Emanation originating from and including the target',
    save_effect: 'Failure: 10 (3d6) Thunder damage.',
    dc_success: 'none',
    damage_dice_primary: '2d8 + 6',
    damage_type_primary: 'Bludgeoning',
    damage_dice_secondary: '3d6',
    damage_type_secondary: 'Thunder',
};

const brazenRow = {
    name: 'Smelting Charge',
    description: 'The gorgon moves up to its Speed without provoking Opportunity Attacks...',
    save_dc: 16,
    save_type: 'Dexterity',
    recharge: '5-6',
    save_effect: 'The target is pulled into the gorgon\'s space and has the Grappled condition (escape DC 14); if the gorgon already has a creature Grappled, the target has the Prone condition instead. Until the grapple ends, the target has the Restrained condition.',
    damage_dice_primary: '2d8 + 4',
    damage_type_primary: 'Piercing',
    damage_dice_secondary: '3d8',
    damage_type_secondary: 'Fire',
};

const singleDamageRow = {
    name: 'Frightful Presence',
    description: 'Each creature must succeed on a WIS saving throw or be frightened.',
    save_dc: 15,
    save_type: 'Wisdom',
    save_effect: 'frightened until the end of its next turn',
    damage_dice_primary: null,
    damage_type_primary: null,
};

// MA-0560: Death Dog Bite — composite attack+save row whose save_effect gates
// a CONDITION rider only (no damage anywhere in the save leg). MA-0551
// composite fork extension: composites whose save leg DOES carry damage
// (Salamander/Marilith save-effect dice, Dao secondary) and pure-save rows
// stay byte-identical.
const deathDogBite = {
    name: 'Bite',
    description: 'Melee Attack Roll: +4, reach 5 ft. <strong>Hit:</strong> 4 (1d4 + 2) Piercing damage. If the target is a creature, it is subjected to the following effect. Constitution Saving Throw: DC 12. First Failure: The target has the <strong>Poisoned</strong> condition. While Poisoned, the target\'s Hit Point maximum doesn\'t return to normal when finishing a Long Rest, and it repeats the save every 24 hours that elapse, ending the effect on itself on a success. Subsequent Failures: The Poisoned target\'s Hit Point maximum decreases by 5 (1d10).',
    attack_bonus: 4,
    reach: '5 ft.',
    save_dc: 12,
    save_type: 'Constitution',
    save_effect: 'First Failure: The target has the Poisoned condition. While Poisoned, the target\'s Hit Point maximum doesn\'t return to normal when finishing a Long Rest, and it repeats the save every 24 hours that elapse, ending the effect on itself on a success. Subsequent Failures: The Poisoned target\'s Hit Point maximum decreases by 5 (1d10).',
    damage_dice_primary: '1d4 + 2',
    damage_type_primary: 'Piercing',
};

// Banishing-claw style: secondary rides the HIT clause, save gates a
// condition only — the secondary must keep riding the attack chip (MA-0298).
const banishingClawRow = {
    name: 'Banishing Claw', attack_bonus: 9, save_dc: 17, save_type: 'Charisma',
    save_effect: 'Failure: The target is trapped in a demiplane.',
    damage_dice_secondary: '3d12',
};

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Slashing'];

// Byte-inert clause arms shared by every save-context case here: NO row in
// this lane may arm any structured/parser producer (Death Dog's "repeats the
// save every 24 hours" prose fabricates no repeatSave key; its (1d10) ladder
// arms no damage; no save_hp_max_reduce key means saveRiderAttackDamage
// never touches the runtime store).
const inertClauseArms = {
    saveVariant: null,
    _characters: [],
    isSpellDamage: false,
    consumeMemoriesClause: false,
    monsterAbilityUse: undefined,
    conditionDurationNote: null,
    successImmunity: null,
    repeatSave: null,
    stagedPetrify: null,
    concentrationDisadvantage: null,
    speedHalf: null,
    subtractDebuff: null,
    demiplaneTransport: null,
    dreamPlaneBanishment: null,
    acPenaltyClause: null,
    speedZeroClause: null,
    slowedClauses: null,
    tempHpGrant: null,
    exhaustionLevel: null,
    animalSpiritVariant: null,
    animalSpiritFortifyHp: null,
    hpThresholdKill: null,
    infernalWound: null,
    saveMargin: null,
    saveHpMaxReduce: null,
    saveAttackerRecover: null,
    saveTargetEffect: null,
    saveRiderAttackDamage: null,
    eyeRay: null,
};

describe('MA-0427 save transport — secondary damage fields', () => {
    const saveOptionsCases = [
        {
            name: 'brazen gorgon — secondary formula/type/name ride the transport',
            row: brazenRow,
            expected: {
                saveDc: 16, saveType: 'dex', dcSuccess: 'half', stagedPetrify: null,
                saveConditions: ['grappled', 'prone', 'restrained'],
                soulTomeTrap: null, repeatSave: null, infernalWound: null,
                autoDamageSecondaryFormula: '3d8', autoDamageSecondaryName: 'Smelting Charge', autoDamageSecondaryDamageType: 'Fire',
                secondaryCondition: null, saveMargin: null,
            },
        },
        {
            name: 'single-damage row — every secondary field stays null (no secondaryCondition key)',
            row: singleDamageRow,
            expected: {
                saveDc: 15, saveType: 'wis', dcSuccess: 'half', stagedPetrify: null,
                saveConditions: ['frightened'],
                soulTomeTrap: null, repeatSave: null, infernalWound: null,
                autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null,
                saveMargin: null,
            },
        },
        {
            name: 'MA-0551 dao composite — saveDc/saveType/dc_success:\'none\' keep the save affordance armed',
            row: daoRow,
            expected: {
                saveDc: 16, saveType: 'dex', dcSuccess: 'none', stagedPetrify: null,
                saveConditions: [],
                soulTomeTrap: null, repeatSave: null, infernalWound: null,
                autoDamageSecondaryFormula: '3d6', autoDamageSecondaryName: 'Earth Burst', autoDamageSecondaryDamageType: 'Thunder',
                secondaryCondition: null, saveMargin: null,
            },
        },
        {
            name: 'MA-0560 death dog — save affordance armed, the (1d10) ladder never enters the transport',
            row: deathDogBite,
            expected: {
                saveDc: 12, saveType: 'con', dcSuccess: 'half', stagedPetrify: null,
                saveConditions: ['poisoned'],
                soulTomeTrap: null, repeatSave: null, infernalWound: null,
                autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null,
                saveMargin: null,
            },
        },
    ];
    it.each(saveOptionsCases)('buildSaveOptions $name', ({ row, expected }) => {
        expect(buildSaveOptions(row)).toEqual(expected);
    });

    const saveContextCases = [
        {
            name: 'threads secondary onto the block-save context alongside primary',
            input: {
                monsterName: 'Brazen Gorgon 1',
                target: { name: 'HexWarlock', type: 'player' },
                spellName: null,
                action: brazenRow,
                saveType: 'DEX',
                dcSuccess: 'half',
                saveDamageFormula: '2d8 + 4',
                saveConditions: ['grappled', 'prone', 'restrained'],
                usesGate: null,
                prerequisite: null,
                getDamageTypesForAction,
            },
            expected: {
                attackerName: 'Brazen Gorgon 1', targetName: 'HexWarlock', actionName: 'Smelting Charge', spellName: null,
                saveDc: 16, saveType: 'DEX', dcSuccess: 'half',
                autoDamageFormula: '2d8 + 4', autoDamageDamageType: 'Piercing',
                autoDamageSecondaryFormula: '3d8', autoDamageSecondaryName: 'Smelting Charge', autoDamageSecondaryDamageType: 'Fire',
                secondaryCondition: null,
                autoDamageName: 'Smelting Charge', saveConditions: ['grappled', 'prone', 'restrained'],
                ...inertClauseArms,
            },
        },
        {
            name: 'single-damage save rows keep secondary and formula null',
            input: {
                monsterName: 'Ancient Green Dragon',
                target: { name: 'HexWarlock', type: 'player' },
                spellName: null,
                action: singleDamageRow,
                saveType: 'WIS',
                dcSuccess: 'half',
                saveDamageFormula: null,
                saveConditions: ['frightened'],
                usesGate: null,
                prerequisite: null,
                getDamageTypesForAction,
            },
            expected: {
                attackerName: 'Ancient Green Dragon', targetName: 'HexWarlock', actionName: 'Frightful Presence', spellName: null,
                saveDc: 15, saveType: 'WIS', dcSuccess: 'half',
                autoDamageFormula: null, autoDamageDamageType: null,
                autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null,
                autoDamageName: 'Frightful Presence', saveConditions: ['frightened'],
                ...inertClauseArms,
            },
        },
        {
            name: 'MA-0551 — save leg pays 3d6 Thunder full-on-fail, secondary promoted so it rolls exactly once',
            input: {
                monsterName: 'Dao 1',
                target: { name: 'Bandit 1', type: 'npc' },
                spellName: null,
                action: daoRow,
                saveType: 'DEX',
                dcSuccess: 'none',
                saveDamageFormula: '2d8 + 6',
                saveConditions: [],
                usesGate: null,
                prerequisite: null,
                getDamageTypesForAction,
            },
            expected: {
                attackerName: 'Dao 1', targetName: 'Bandit 1', actionName: 'Earth Burst', spellName: null,
                saveDc: 16, saveType: 'DEX', dcSuccess: 'none',
                // save leg rides the secondary dice, NOT the fixed attack primary
                autoDamageFormula: '3d6', autoDamageDamageType: 'Thunder',
                autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null,
                autoDamageName: 'Earth Burst', saveConditions: [],
                ...inertClauseArms,
            },
        },
        {
            name: 'MA-0560 — rider leg arms NO damage (zero on save success), rider keys stay armed',
            input: {
                monsterName: 'Death Dog 1',
                target: { name: 'Bandit 1', type: 'npc' },
                spellName: null,
                action: deathDogBite,
                saveType: 'CON',
                dcSuccess: 'half',
                saveDamageFormula: null, // ActionSaveRoll forks the formula to null
                saveConditions: ['poisoned'],
                usesGate: null,
                prerequisite: null,
                getDamageTypesForAction,
            },
            expected: {
                attackerName: 'Death Dog 1', targetName: 'Bandit 1', actionName: 'Bite', spellName: null,
                saveDc: 12, saveType: 'CON', dcSuccess: 'half',
                autoDamageFormula: null, autoDamageDamageType: null,
                autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null,
                autoDamageName: 'Bite', saveConditions: ['poisoned'],
                ...inertClauseArms,
            },
        },
    ];
    it.each(saveContextCases)('buildAbilitySaveRollContext $name', ({ input, expected }) => {
        expect(buildAbilitySaveRollContext(input)).toEqual(expected);
    });
});

// The attack chip never arms save adjudication on a row that also has an
// attack_bonus (MA-0551 fork); pure-save and save_dc-less rows stay
// byte-identical. The save_dc:0 false arm is cited by ma1071 (DC0 decoy).
describe('MA-0551/MA-0560 — composite-fork predicate truth tables', () => {
    it.each([
        { row: daoRow, expected: true },
        { row: brazenRow, expected: false }, // pure save
        { row: { name: 'Club', attack_bonus: 4 }, expected: false },
        { row: { name: 'Multiattack', attack_bonus: 5, save_dc: 0 }, expected: false },
        { row: deathDogBite, expected: true },
    ])('isCompositeAttackSaveRow $row.name → $expected', ({ row, expected }) => {
        expect(isCompositeAttackSaveRow(row)).toBe(expected);
    });

    it.each([
        { row: daoRow, expected: true }, // secondary dice live INSIDE save_effect
        { row: banishingClawRow, expected: false }, // hit-clause secondary rides the attack chip
        { row: brazenRow, expected: false }, // no attack_bonus — never forked
    ])('saveLegCarriesSecondaryDamage $row.name → $expected', ({ row, expected }) => {
        expect(saveLegCarriesSecondaryDamage(row)).toBe(expected);
    });

    it.each([
        { row: deathDogBite, expected: true }, // rider-only composite
        { row: daoRow, expected: false }, // MA-0551 rider carries secondary dice
        {
            // composites whose save_effect prose carries its own damage dice
            row: {
                name: 'Constrict', attack_bonus: 0, save_dc: 15, save_type: 'Strength',
                save_effect: 'Failure: 11 (2d6 + 4) Bludgeoning damage plus 7 (2d6) Fire damage. The target has the Grappled condition (escape DC 14).',
            },
            expected: false,
        },
        {
            row: {
                name: 'Constrict', attack_bonus: 0, save_dc: 17, save_type: 'Strength',
                save_effect: '15 (2d10 + 4) Bludgeoning damage. The target has the Grappled condition (escape DC 14).',
            },
            expected: false,
        },
        { row: { name: 'Constrict', save_dc: 12, save_type: 'Strength', save_effect: 'The target has the Grappled condition (escape DC 12).' }, expected: false }, // pure-save, never forked
        { row: { name: 'Club', attack_bonus: 4 }, expected: false },
    ])('saveLegIsConditionRider $row.name → $expected', ({ row, expected }) => {
        expect(saveLegIsConditionRider(row)).toBe(expected);
    });
});
