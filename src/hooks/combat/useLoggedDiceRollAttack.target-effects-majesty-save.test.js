// @maintained-by-ai: 2026-10-14
// createLogAndShow — campaign.targetEffects SAVE-FLANK seam.
// Owns how the targetEffects list survives or is consumed when an attack roll
// resolves, including the Unbreakable Majesty save outcome (2024 Oath of the
// Crown, public/data/2024/classes.json: "whenever any creature hits you ... the
// attacker must succeed on a Charisma saving throw ... or the attack misses
// instead"): a failed save revokes the hit, so hit-consumed tes (vex,
// distracting_strike_advantage) live on, while the attacker's one-shot sap
// (disadvantage_next_attack) is consumed by the roll hit OR miss (CLA-158).
// Twin seam (useLoggedDiceRollAttack.target-effects-majesty.test.js): the
// attack-side majesty trigger / DC / mark / dispatch and its save prompt.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
    DEBUG_FORCE_CRIT: false,
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    findCreatureByName: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    addStorageChangeListener: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
    clearHuntersMarkConcentration: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(),
    getUnbreakableMajestySaveDc: vi.fn(),
    hasAttackerTriggeredMajesty: vi.fn(),
    markAttackerTriggeredMajesty: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getBaitAndSwitchAcBonus: vi.fn(() => 0),
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    getSlowAcPenalty: vi.fn(() => 0),
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(() => 0),
    getShieldOfFaithAcBonus: vi.fn(() => 0),
    getWardingBondAcBonus: vi.fn(() => 0),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

import { rollD20 } from '../../services/dice/diceRoller.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    isUnbreakableMajestyActive,
    getUnbreakableMajestySaveDc,
    hasAttackerTriggeredMajesty,
    markAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';
import { dispatchUnbreakableMajestySave } from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';

const MAJESTY_PROMPT_ID = 'majesty-test-guid-1234'; // `majesty-${utils.guid()}`

describe('createLogAndShow - target effects save flank', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks keeps implementations — re-pin so no stateful store
        // or saved return value leaks from a previous test.
        rollD20.mockReset().mockReturnValue(15); // +3 vs ac:15 → hit unless revoked
        getTargetFromAttacker.mockReset().mockReturnValue({ name: 'Goblin', ac: 15 });
        getRuntimeValue.mockReset().mockReturnValue(null);
        setRuntimeValue.mockReset();
        loadCombatSummary.mockReset().mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 15 }] });
        // An armed majesty must not leak into non-majesty tests — undefined
        // (falsy) keeps the save prompt out of those lanes.
        isUnbreakableMajestyActive.mockReset();
        hasAttackerTriggeredMajesty.mockReset();
        getUnbreakableMajestySaveDc.mockReset();
        markAttackerTriggeredMajesty.mockReset();
        dispatchUnbreakableMajestySave.mockReset();
    });

    // Stateful fake for campaign.targetEffects — getRuntimeValue reads and
    // setRuntimeValue writes the LATEST value, like the real runtime cache, so
    // the independent read/write blocks in attackPostProcessing are validated
    // against real store semantics instead of one frozen mock snapshot.
    let teStore;

    function mockTargetEffects(initial) {
        teStore = initial === null ? null : [...initial];
        getRuntimeValue.mockImplementation((name, prop) =>
            (name === 'campaign' && prop === 'targetEffects' ? teStore : null));
        setRuntimeValue.mockImplementation((name, prop, value) => {
            if (name === 'campaign' && prop === 'targetEffects') teStore = value;
            return Promise.resolve();
        });
    }

    function targetEffectWrites() {
        return setRuntimeValue.mock.calls.filter((call) => call[1] === 'targetEffects');
    }

    function roll(name, bonus, rollType, context = {}) {
        return createLogAndShow(deps)(name, bonus, rollType, context);
    }

    function armMajesty(saveDc = 15) {
        isUnbreakableMajestyActive.mockReturnValue(true);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getUnbreakableMajestySaveDc.mockReturnValue(saveDc);
    }

    // no-timers T2: the majesty save prompt waits INDEFINITELY — answer it
    // exactly as the player would, dispatching the majesty promptId until the
    // roll settles (bounded poll; never a game clock).
    async function rollAnsweringMajestySave(success) {
        let settled = false;
        const run = roll('Longsword', 3, 'attack', { targetName: 'Goblin' }).then(() => { settled = true; });
        for (let i = 0; i < 40 && !settled; i++) {
            await new Promise((r) => setTimeout(r, 5));
            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: MAJESTY_PROMPT_ID, success },
            }));
        }
        await run;
    }

    describe('hit consumption', () => {
        it('clears hit-consumed te and consumes attacker sap, preserving te not up for this hit', async () => {
            const vexGoblin = { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin', source: 'Vex' };
            const vexOrc = { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Orc', source: 'Vex' };
            const distractByOther = { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'OtherEnemy' };
            const distractBySelf = { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'TestWizard' };
            const sap = { effect: 'disadvantage_next_attack', target: 'TestWizard', source: 'Hand of Harm', duration: 'until_used' };
            const other = { effect: 'other_effect', target: 'TestWizard' };
            mockTargetEffects([vexGoblin, vexOrc, distractByOther, distractBySelf, sap, other]);

            await roll('Longsword', 3, 'attack', { targetName: 'Goblin' });

            // Quirk preserved deliberately by attackPostProcessing.clearHitConsumedEffects:
            // the vex and distracting-strike blocks filter the SAME original
            // snapshot and write independently, so the distracting write
            // resurrects the just-cleared vex(Goblin); the sap block re-reads
            // freshest and strips only its own.
            expect(targetEffectWrites().length).toBeGreaterThan(0);
            expect(teStore).toEqual([vexGoblin, vexOrc, distractBySelf, other]);
        });

        it('consumes attacker sap disadvantage even on a miss (CLA-158)', async () => {
            const sap = { effect: 'disadvantage_next_attack', target: 'TestWizard', source: 'Hand of Harm', duration: 'until_used' };
            const other = { effect: 'other_effect', target: 'TestWizard' };
            mockTargetEffects([sap, other]);
            rollD20.mockReturnValue(2); // 2 + 3 = 5 vs ac 15 → miss

            await roll('Longsword', 3, 'attack', { targetName: 'Goblin' });

            expect(targetEffectWrites()).toHaveLength(1);
            expect(teStore).toEqual([other]);
        });
    });

    describe('majesty save outcome drives consumption', () => {
        const vex = { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin', source: 'Vex' };
        const distract = { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'OtherEnemy' };
        const sap = { effect: 'disadvantage_next_attack', target: 'TestWizard', source: 'Hand of Harm' };
        const other = { effect: 'other_effect', target: 'TestWizard' };

        it('failed CHA save revokes the hit — hit-consumed te live on, sap still spent', async () => {
            armMajesty();
            mockTargetEffects([vex, distract, sap, other]);

            await rollAnsweringMajestySave(false);

            // Roll total was a hit (18 ≥ 15) yet nothing hit-consumed was
            // cleared — proof the save-fail revocation reaches this seam.
            expect(teStore).toEqual([vex, distract, other]);
        });

        it('successful CHA save resolves the hit — hit-consumed te clear as normal', async () => {
            armMajesty(17);
            mockTargetEffects([vex, distract, sap, other]);

            await rollAnsweringMajestySave(true);

            expect(dispatchUnbreakableMajestySave).toHaveBeenCalledWith(
                'test-campaign', 'Goblin', 'TestWizard', 17, MAJESTY_PROMPT_ID,
            );
            // Same-snapshot quirk applies: vex(Goblin) is resurrected by the
            // distracting write, then the sap clear strips only sap.
            expect(teStore).toEqual([vex, other]);
        });
    });

    describe('non-attack rolls never touch targetEffects', () => {
        it.each`
            rollType
            ${'check'}
            ${'save'}
            ${'initiative'}
        `('does not clear target effects when rollType is "$rollType"', async ({ rollType }) => {
            mockTargetEffects([
                { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin' },
                { effect: 'disadvantage_next_attack', target: 'TestWizard' },
            ]);

            await roll('Athletics', 5, rollType, {});

            expect(targetEffectWrites()).toHaveLength(0);
        });
    });

    describe('edge cases', () => {
        it('does not write targetEffects when the list is null or empty', async () => {
            mockTargetEffects(null);
            await roll('Longsword', 3, 'attack', { targetName: 'Goblin' });
            expect(targetEffectWrites()).toHaveLength(0);

            mockTargetEffects([]);
            await roll('Longsword', 3, 'attack', { targetName: 'Goblin' });
            expect(targetEffectWrites()).toHaveLength(0);
        });

        it('does not write targetEffects when the attack resolves no target', async () => {
            mockTargetEffects([
                { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin' },
                { effect: 'disadvantage_next_attack', target: 'TestWizard' },
            ]);
            getTargetFromAttacker.mockReturnValue(null);

            await roll('Longsword', 3, 'attack', {});

            expect(targetEffectWrites()).toHaveLength(0);
        });
    });
});
