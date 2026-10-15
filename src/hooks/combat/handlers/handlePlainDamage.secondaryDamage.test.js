// @maintained-by-ai: 2026-10-14
// Lane: the autoDamageSecondary* rider on PLAIN damage — the designated owner
// of the secondary-damage contract (the hitClause lane explicitly deferred all
// redundant secondary-leg tests here). Guards rollAndApplySecondaryPlainDamage:
// secondary rolls first and applies before the primary leg, both legs share one
// damageSequenceId (secondary skipConcentration, primary carries the combined
// concentrationTotalDamage, sequence cleared after), full secondary* field
// propagation to log + popup, name fallback, crit doubling (rollExpressionDoubled),
// MA-0530 flat dice-less constants (CLA-281: flat never doubles), and the
// FT-015 Boon-of-Recovery intercept that consumes the whole hit.
// The advantage-gated rider twin lives in handlePlainDamage.secondary-advantage-gate.test.js;
// save-lane secondaries live in the handleNpcSaveDamage/handlePlayerSaveDamage files.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    parseConstant: vi.fn((formula) => /^[+-]?\d+$/.test(String(formula ?? '').replace(/\s*\[.*?\]\s*/g, '').trim()) ? parseInt(String(formula).trim(), 10) : null),
    formatDamageFormula: vi.fn((formula, rolls, isCrit) => {
        if (!isCrit) return formula;
        const parsed = formula.match(/^(\d+)?d(\d+)((?:[+-]\d+)+)?$/i);
        if (!parsed) return formula;
        const count = parsed[1] || 1;
        const sides = parsed[2];
        const modifierStr = parsed[3];
        let modifier = 0;
        if (modifierStr) {
            const segments = modifierStr.match(/([+-]\d+)/g);
            for (const seg of segments) { modifier += parseInt(seg, 10); }
        }
        const dicePart = count === 1 ? `d${sides}` : `${count}d${sides}`;
        const rollStr = rolls && rolls.length > 0 ? ` (${rolls.join(', ')})` : '';
        let result = `${dicePart}*2${rollStr}`;
        if (modifier > 0) result += `+${modifier}`;
        else if (modifier < 0) result += `${modifier}`;
        return result;
    }),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

import { rollExpression, rollExpressionDoubled } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget, clearReTriggeredSequence } from '../../../services/rules/combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

const leg = (finalDamage, newHp) => ({ finalDamage, newHp, damageReduced: false });

// Queue the secondary-leg then primary-leg apply results (secondary lands first).
function queueLegs(secondary, primary) {
    applyDamageToTarget.mockReturnValueOnce(secondary).mockReturnValueOnce(primary);
}

describe('handlePlainDamage secondary-damage rider', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'TestFighter' }, { name: 'Goblin' }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    function resetRollState() {
        rollExpression.mockReset().mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
        rollExpressionDoubled.mockReset().mockReturnValue({ total: 16, rolls: [5, 3, 7, 1], modifier: 0 });
        applyDamageToTarget.mockReset().mockReturnValue(leg(8, 5));
        clearReTriggeredSequence.mockClear();
        endInvisibilityOnHostileAction.mockClear();
        setRuntimeValue.mockClear();
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    }

    beforeEach(() => {
        getRuntimeValue.mockReset().mockReturnValue(null);
        resetRollState();
        loadCombatSummary.mockReset().mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    // Eldritch Blast + Agonizing Blast: primary 2d10+4 force, secondary 1d10 force.
    function elBlast(contextExtras = {}, overrides = {}) {
        return run({
            name: 'Eldritch Blast (Agonizing)',
            formula: '2d10+4',
            total: 14,
            rolls: [5, 9],
            modifier: 4,
            context: {
                targetName: 'Goblin',
                damageType: 'force',
                autoDamageSecondaryFormula: '1d10',
                autoDamageSecondaryName: 'Eldritch Blast',
                autoDamageSecondaryDamageType: 'force',
                ...contextExtras,
            },
            ...overrides,
        });
    }

    function run(roll) {
        return createLogDamageAndShow(deps)(roll);
    }

    const damageLog = () => deps.logEntry.mock.calls[0][0];
    const popupData = () => deps.setPopupHtml.mock.calls[0][0];

    it('secondary rolls first and applies before primary, legs share damageSequenceId, concentration carries the combined total, sequence cleared after', async () => {
        rollExpression.mockReturnValueOnce({ total: 10, rolls: [6, 4], modifier: 0 });
        queueLegs(leg(8, 5), leg(5, 8));

        await elBlast();

        expect(rollExpression).toHaveBeenCalledWith('1d10');
        expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
        const [secondary, primary] = applyDamageToTarget.mock.calls;
        expect(secondary[1]).toBe('Goblin');
        expect(secondary[2]).toBe(10);
        expect(secondary[4].skipConcentration).toBe(true);
        expect(primary[1]).toBe('Goblin');
        expect(primary[2]).toBe(14);
        expect(primary[4].concentrationTotalDamage).toBe(24); // primary 14 + secondary 10
        expect(secondary[4].damageSequenceId).toMatch(/^seq_/);
        expect(secondary[4].damageSequenceId).toBe(primary[4].damageSequenceId);
        expect(clearReTriggeredSequence).toHaveBeenCalledWith(secondary[4].damageSequenceId);
    });

    it('no secondary formula — single primary apply, log and popup omit every secondary field', async () => {
        await run({
            name: 'Longsword',
            formula: '1d8+3',
            total: 8,
            rolls: [5, 3],
            modifier: 3,
            context: { targetName: 'Goblin', damageType: 'slashing' },
        });

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        for (const d of [damageLog(), popupData()]) {
            expect(d.secondaryName).toBeUndefined();
            expect(d.secondaryFormula).toBeUndefined();
            expect(d.secondaryDamageType).toBeUndefined();
            expect(d.secondaryTotal).toBeUndefined();
            expect(d.secondaryFinalDamage).toBeUndefined();
        }
    });

    it('every secondary field lands on both log and popup; explicit autoDamageSecondaryName beats the attack name', async () => {
        rollExpression.mockReturnValueOnce({ total: 10, rolls: [6, 4], modifier: 0 });
        queueLegs(leg(8, 5), leg(5, 8));

        await elBlast({ autoDamageSecondaryName: 'Agonizing Blast' });

        for (const d of [damageLog(), popupData()]) {
            expect(d.secondaryName).toBe('Agonizing Blast');
            expect(d.secondaryFormula).toBe('1d10');
            expect(d.secondaryDamageType).toBe('force');
            expect(d.secondaryTotal).toBe(10);
            expect(d.secondaryRolls).toEqual([6, 4]);
            expect(d.secondaryFinalDamage).toBe(8);
        }
    });

    it('secondary name falls back to the attack name when autoDamageSecondaryName is absent', async () => {
        queueLegs(leg(5, 5), leg(8, 8));

        await elBlast({ autoDamageSecondaryName: undefined });

        expect(damageLog().secondaryName).toBe('Eldritch Blast (Agonizing)');
    });

    it('crit doubles the secondary dice (rollExpressionDoubled); non-crit rolls it once', async () => {
        await elBlast({ isAutoCrit: true });
        expect(rollExpressionDoubled).toHaveBeenCalledWith('1d10');
        expect(rollExpression).not.toHaveBeenCalledWith('1d10');

        resetRollState();
        await elBlast();
        expect(rollExpression).toHaveBeenCalledWith('1d10');
        expect(rollExpressionDoubled).not.toHaveBeenCalled();
    });

    it('secondary damage type flows independently of the primary type (slashing primary + fire secondary)', async () => {
        rollExpression.mockReturnValueOnce({ total: 4, rolls: [4], modifier: 0 });
        queueLegs(leg(4, 5), leg(8, 8));

        await run({
            name: 'Longsword',
            formula: '1d8+3',
            total: 8,
            rolls: [5, 3],
            modifier: 3,
            context: {
                targetName: 'Goblin',
                damageType: 'slashing',
                autoDamageSecondaryFormula: '1d6',
                autoDamageSecondaryName: 'Searing Smite',
                autoDamageSecondaryDamageType: 'fire',
            },
        });

        expect(applyDamageToTarget.mock.calls[0][3]).toEqual(['fire']);
        expect(applyDamageToTarget.mock.calls[1][3]).toEqual(['slashing']);
    });

    it('endInvisibilityOnHostileAction fires from the secondary leg alone when the primary applies zero', async () => {
        rollExpression.mockReturnValueOnce({ total: 5, rolls: [5], modifier: 0 });
        queueLegs(leg(5, 5), leg(0, 5));

        await elBlast();

        expect(endInvisibilityOnHostileAction).toHaveBeenCalledTimes(1);
        expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestFighter', 'test-campaign');
    });

    // MA-0530: flat_damage_secondary constant ("1" — Cultist Ritual Sickle) has
    // no dice: resolveSecondaryRoll resolves it dice-less via parseConstant and
    // flat NEVER doubles on crit (CLA-281 — rollExpressionDoubled returns null).
    describe('MA-0530 flat constant secondary (Ritual Sickle: 1d4+1 slashing + flat 1 Necrotic)', () => {
        function flatSickle(isCrit) {
            rollExpression.mockReset().mockReturnValue(null);
            rollExpressionDoubled.mockReset().mockReturnValue(null);
            return run({
                name: 'Ritual Sickle',
                formula: '1d4 + 1',
                total: isCrit ? 6 : 4,
                rolls: [3],
                modifier: 1,
                context: {
                    targetName: 'Goblin',
                    damageType: 'slashing',
                    isAutoCrit: isCrit,
                    autoDamageSecondaryFormula: '1',
                    autoDamageSecondaryName: 'Ritual Sickle',
                    autoDamageSecondaryDamageType: 'Necrotic',
                },
            });
        }

        it('resolves dice-less "1", applies Necrotic secondary before slashing primary, both types flow to log + popup', async () => {
            queueLegs(leg(1, 12), leg(4, 8));

            await flatSickle(false);

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            expect(applyDamageToTarget.mock.calls.map(c => [c[2], c[3][0]]))
                .toEqual([[1, 'Necrotic'], [4, 'slashing']]);
            const popup = popupData();
            expect(popup.damageType).toBe('slashing');
            expect(popup.secondaryFormula).toBe('1');
            expect(popup.secondaryDamageType).toBe('Necrotic');
            expect(popup.secondaryTotal).toBe(1);
            expect(popup.secondaryFinalDamage).toBe(1);
            const log = damageLog();
            expect(log.note).toBe('combined_damage_roll');
            expect(log.secondaryDamageType).toBe('Necrotic');
        });

        it('flat "1" stays NOT doubled on a crit (CLA-281 flat constants)', async () => {
            queueLegs(leg(1, 12), leg(6, 8));

            await flatSickle(true);

            expect(rollExpressionDoubled).toHaveBeenCalledWith('1');
            expect(applyDamageToTarget.mock.calls[0][2]).toBe(1);
        });
    });

    // FT-015: Fire Giant Flame Sword (4d6+7 slashing + 3d6 fire, monsters.json
    // verified). When the SECONDARY leg alone drops a Last Stand holder to 0,
    // checkBoonOfRecoveryLastStand rewrites HP to the floor (1 + half max) and
    // latches — the PRIMARY leg of the same hit must NOT shave it a second time.
    // Relentless Endurance / non-holders keep the byte-identical two-leg flow.
    describe('FT-015 Boon of Recovery compound-row interception', () => {
        function flameSword(contextExtras = {}) {
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Disciplined_Monk', type: 'player', currentHp: 5, maxHp: 143 }],
            });
            rollExpression.mockReturnValueOnce({ total: 10, rolls: [4, 3, 3], modifier: 0 });
            return run({
                name: 'Flame Sword',
                formula: '4d6+7',
                total: 21,
                rolls: [4, 5, 6, 6],
                modifier: 7,
                context: {
                    targetName: 'Disciplined_Monk',
                    damageType: 'slashing',
                    autoDamageSecondaryFormula: '3d6',
                    autoDamageSecondaryName: 'Flame Sword',
                    autoDamageSecondaryDamageType: 'fire',
                    ...contextExtras,
                },
            });
        }

        it('secondary leg intercepted by Boon of Recovery consumes the whole hit — primary leg skipped, HP stays at the intercepted floor', async () => {
            applyDamageToTarget.mockReturnValueOnce({
                intercepted: true, finalDamage: 0, newHp: 72, damageDealt: 10, oldHp: 5,
                interceptedFeature: 'Boon of Recovery', damageReduced: true, resistanceDetails: [],
            });

            await flameSword();

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            expect(clearReTriggeredSequence).toHaveBeenCalled();
            expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'currentHitPoints', 72, 'test-campaign');
            expect(popupData().interceptedFeature).toBe('Boon of Recovery');
            expect(popupData().targetCurrentHp).toBe(72);
        });

        it('Relentless Endurance intercept and non-intercepted second legs both keep the primary leg', async () => {
            queueLegs({ intercepted: true, finalDamage: 0, newHp: 1, damageDealt: 10, oldHp: 5, interceptedFeature: 'Relentless Endurance', damageReduced: false }, leg(5, 1));

            await flameSword();

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            expect(applyDamageToTarget.mock.calls[1][3]).toEqual(['slashing']);

            resetRollState();
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Disciplined_Monk', type: 'player', currentHp: 5, maxHp: 143 }],
            });
            queueLegs(leg(10, 0), leg(21, 0));

            await flameSword();

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
        });
    });
});
