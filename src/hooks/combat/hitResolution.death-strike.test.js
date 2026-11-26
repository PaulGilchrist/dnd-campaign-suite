// @maintained-by-ai 2026-11-14
// Regression: Death Strike (both rulesets classes.json → Rogue → Assassin → lv17,
// automation type 'attack_rider' + trigger 'first_round_sneak_attack_hit' +
// damageDoubled) was stored on ANY lv17+ character whose round-1 sneak-attack
// hit — no feature/subclass gate at all. A live lv20 Arcane Trickster (whose
// sheet shows NO Death Strike row) byte-granted the te row
// {target, source:'Death Strike', effect:'death_strike', saveType:'CON',
// saveDc:15, saveAbility:'DEX', damageDoubled:true} and every later damage leg
// queued its CON DC15 prompt. maybeStoreDeathStrike (hitResolution.js) must
// consult the character's DERIVED automation (the same collectAutomationFrom-
// Features buckets that feed the sheet rows) before storing anything.
// Producer/gate seam only: the save-face consumer lane (CON prompt → delta leg
// → te consumption) lives in useLoggedDiceRollDamage.death-strike.test.js and
// per-target re-arm breadth in handlers/handlePlainDamage.deathStrike.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { resolveHit } from './hitResolution.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        DEBUG_FORCE_CRIT: false,
        getName: (n) => n || 'Unknown',
        guid: () => 'test-guid',
    },
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    hasAttackerTriggeredMajesty: vi.fn(() => false),
    markAttackerTriggeredMajesty: vi.fn(),
    getUnbreakableMajestySaveDc: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    dispatchUnbreakableMajestySave: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(() => false),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ creatures: [{ name: 'EvasiveFighter' }] })),
    getTargetFromAttacker: vi.fn(() => null),
}));

const characterName = 'EvasiveFighter';
const campaignName = 'test-campaign';
const AC = 19;
const BONUS = 9;

// Authored automation envelope as collectAutomationFromFeatures routes the
// Assassin lv17 Death Strike row (trigger ⇒ passives bucket, attack.js envelope
// carries damageDoubled through).
const DEATH_STRIKE_RIDER = {
    type: 'attack_rider',
    name: 'Death Strike',
    trigger: 'first_round_sneak_attack_hit',
    damageDoubled: true,
    saveType: 'CON',
    saveDc: 'ability',
    saveAbility: 'DEX',
    casting_time: 'passive',
    hasAutomation: true,
};

function makePlayerStats(automationPassives) {
    return {
        name: characterName,
        level: 20,
        rules: '2024',
        proficiency: 6, // lv20 → PB +6 (live saveDc 15 = 8 + DEX +1 + PB +6)
        abilities: [
            { name: 'Dexterity', bonus: 1 },
            { name: 'Constitution', bonus: 2 },
        ],
        automation: { passives: automationPassives, actions: [], bonusActions: [], reactions: [], specialActions: [] },
    };
}

function callResolveHit(playerStats, { effectiveD20Roll = 13 } = {}) { // 13 + 9 = 22 ≥ AC 19 → hit
    return resolveHit({
        characterName,
        campaignName,
        context: {
            rollType: 'attack',
            attackerName: characterName,
            targetName: 'ElderPaladin',
            effectiveBonus: BONUS,
            bonus: BONUS,
            isWeaponAttack: true,
            sneakAttackDice: 10,
            playerStats,
        },
        bonus: BONUS,
        effectiveD20Roll,
        target: { name: 'ElderPaladin', ac: AC, type: 'player' },
        combatSummary: null,
        characters: [{ name: 'ElderPaladin', computedStats: { armorClass: AC } }],
        logEntry: vi.fn(),
    });
}

const storedTeRows = () => setRuntimeValue.mock.calls
    .filter(c => c[0] === 'campaign' && c[1] === 'targetEffects')
    .map(c => c[2]);

describe('resolveHit — Death Strike feature gate (Assassin lv17 only)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        getCurrentCombatRound.mockReturnValue(1);
        getCombatContext.mockResolvedValue({ creatures: [{ name: characterName }] });
    });

    it('lv20 ARCANE TRICKSTER (no Death Strike in derived automation): round-1 sneak hit stores NO death_strike te', async () => {
        // The trickster's own rider rows (nothing attack_rider-shaped with
        // damageDoubled + first_round_sneak_attack_hit) — the exact live face
        // that used to grant the te byte-identical to the Assassin's.
        const trickster = makePlayerStats([
            { type: 'passive_rule', name: 'Stroke of Luck', effect: 'stroke_of_luck' },
            { type: 'attack_rider', name: 'Devious Strikes', trigger: 'after_hit', damageDoubled: false },
        ]);

        const result = await callResolveHit(trickster);

        expect(result.hit).toBe(true); // the sneak hit landed — only the feature gate can block the te
        expect(storedTeRows()).toHaveLength(0);
    });

    it('ASSASSIN lv20 (Death Strike rider present): round-1 sneak hit stores the te with the DC built from the attacker\'s own DEX + PB', async () => {
        const assassin = makePlayerStats([DEATH_STRIKE_RIDER]);

        const result = await callResolveHit(assassin);

        expect(result.hit).toBe(true);
        expect(storedTeRows()).toEqual([[{
            target: 'ElderPaladin',
            source: 'Death Strike',
            effect: 'death_strike',
            saveType: 'CON',
            saveDc: 15, // 8 + DEX +1 + PB +6
            saveAbility: 'DEX',
            damageDoubled: true,
        }]]);
    });

    const featureHolder = () => makePlayerStats([DEATH_STRIKE_RIDER]);
    const noAutomation = { name: characterName, level: 20, proficiency: 6, abilities: [{ name: 'Dexterity', bonus: 1 }] };

    // Every gate blocks the SAME store path; one parameterized case each.
    // expectHit is the negative control: the attack really landed (or really
    // missed for MISS) so a green test proves the GATE blocked the store,
    // not some incidental harness failure.
    it.each([
        {
            gate: 'round 2 (first-round-only trigger)',
            playerStats: featureHolder(),
            expectHit: true,
            setup: () => getCurrentCombatRound.mockReturnValue(2),
        },
        {
            gate: 'attacker hasActed',
            playerStats: featureHolder(),
            expectHit: true,
            setup: () => getCombatContext.mockResolvedValue({ creatures: [{ name: characterName, hasActed: true }] }),
        },
        { gate: 'MISS', playerStats: featureHolder(), expectHit: false }, // 5 + 9 = 14 < AC 19
        {
            gate: 'missing playerStats automation (monster/non-sheet lane)',
            playerStats: noAutomation,
            expectHit: true,
        },
    ])('stores NO death_strike te when the $gate blocks it', async ({ playerStats, expectHit, setup }) => {
        if (setup) setup();

        const result = await callResolveHit(playerStats, { effectiveD20Roll: expectHit ? 13 : 5 });

        expect(result.hit).toBe(expectHit);
        expect(storedTeRows()).toHaveLength(0);
    });
});
