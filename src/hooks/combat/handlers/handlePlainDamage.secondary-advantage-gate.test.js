// MA-0889: advantage-gated secondary rider consumer — Goblin Boss
// Scimitar/Shortbow "plus 1d4 … if the attack roll had Advantage". With
// context.secondaryCondition === 'advantage' the rider fires ONLY when the
// resolved campaign lastAttack.forcedMode === 'advantage' (same post-hit
// channel the advantage-rig te stamps); a normal-mode hit pays primary-only
// with an honest `secondary_damage_skipped` log. Legacy always-roll rows
// (condition null/absent) stay byte-identical — rider rolls on every hit.
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    parseConstant: vi.fn((formula) => /^[+-]?\d+$/.test(String(formula ?? '').replace(/\s*\[.*?\]\s*/g, '').trim()) ? parseInt(String(formula).trim(), 10) : null),
    formatDamageFormula: vi.fn((formula) => formula),
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

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget, clearReTriggeredSequence } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('MA-0889 advantage-gated secondary rider', () => {
    const deps = {
        characterName: 'Goblin Boss',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Goblin Boss', computedStats: { armorClass: 17 } },
            { name: 'Bandit', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        getRuntimeValue.mockReset();
        rollExpression.mockReset().mockReturnValue({ total: 2, rolls: [2], modifier: 0 });
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 5, newHp: 7, damageReduced: false });
        clearReTriggeredSequence.mockClear();
        addEntry.mockClear().mockReturnValue(Promise.resolve());
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit', type: 'npc', ac: 12, currentHp: 12, maxHp: 12 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function stampForcedMode(mode) {
        getRuntimeValue.mockImplementation((char, key) => {
            if (char === 'campaign' && key === 'lastAttack') {
                return { attackerName: 'Goblin Boss', targetName: 'Bandit', forcedMode: mode };
            }
            if (char === 'campaign') return [];
            return null;
        });
    }

    function scimitarContext(secondaryCondition) {
        return {
            targetName: 'Bandit',
            damageType: 'Slashing',
            attackerName: 'Goblin Boss',
            autoDamageSecondaryFormula: '1d4',
            autoDamageSecondaryName: 'Scimitar',
            autoDamageSecondaryDamageType: 'Slashing',
            secondaryCondition,
        };
    }

    async function rollScimitar(secondaryCondition, mode) {
        stampForcedMode(mode);
        applyDamageToTarget
            .mockReturnValueOnce({ finalDamage: 2, newHp: 5, damageReduced: false })
            .mockReturnValueOnce({ finalDamage: 5, newHp: 7, damageReduced: false });
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Scimitar', formula: '1d6 + 2', total: 5, rolls: [3], modifier: 2, context: scimitarContext(secondaryCondition) });
    }

    describe('advantage hit (resolved forcedMode "advantage")', () => {
        it('rider rolls and applies — primary + secondary both paid', async () => {
            await rollScimitar('advantage', 'advantage');
            expect(rollExpression).toHaveBeenCalledWith('1d4');
            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            const secondaryCall = applyDamageToTarget.mock.calls[0];
            expect(secondaryCall[2]).toBe(2);
            expect(secondaryCall[3]).toEqual(['Slashing']);
            const primaryCall = applyDamageToTarget.mock.calls[1];
            expect(primaryCall[2]).toBe(5);
            expect(clearReTriggeredSequence).toHaveBeenCalled();
        });

        it('combined_damage_roll log carries the secondary fields, no skip log', async () => {
            await rollScimitar('advantage', 'advantage');
            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.note).toBe('combined_damage_roll');
            expect(logCall.secondaryFormula).toBe('1d4');
            expect(logCall.secondaryTotal).toBe(2);
            expect(logCall.secondaryFinalDamage).toBe(2);
            const skipped = addEntry.mock.calls.map(c => c[1]?.automationType);
            expect(skipped).not.toContain('secondary_damage_skipped');
        });
    });

    describe('normal hit (resolved forcedMode null) — rider gated OFF', () => {
        it('rider never rolls; primary-only damage applied once', async () => {
            await rollScimitar('advantage', null);
            expect(rollExpression).not.toHaveBeenCalledWith('1d4');
            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            const primaryCall = applyDamageToTarget.mock.calls[0];
            expect(primaryCall[2]).toBe(5);
            expect(primaryCall[3]).toEqual(['Slashing']);
        });

        it('logs secondary_damage_skipped with reason "no advantage"', async () => {
            await rollScimitar('advantage', null);
            const skipCall = addEntry.mock.calls.map(c => c[1]).find(e => e?.automationType === 'secondary_damage_skipped');
            expect(skipCall).toBeTruthy();
            expect(skipCall.reason).toBe('no advantage');
            expect(skipCall.characterName).toBe('Goblin Boss');
            expect(skipCall.abilityName).toBe('Scimitar');
        });

        it('damage log is primary-only — no secondary fields, no combined totals', async () => {
            await rollScimitar('advantage', null);
            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.formula).toBe('1d6 + 2');
            expect(logCall.secondaryFormula).toBeUndefined();
            expect(logCall.secondaryTotal).toBeUndefined();
            expect(logCall.secondaryFinalDamage).toBeUndefined();
            const popupCall = deps.setPopupHtml.mock.calls[0][0];
            expect(popupCall.secondaryFormula).toBeUndefined();
        });
    });

    describe('disadvantage hit — rider gated OFF too', () => {
        it('forcedMode "disadvantage" skips the rider with the honest skip log', async () => {
            await rollScimitar('advantage', 'disadvantage');
            expect(rollExpression).not.toHaveBeenCalledWith('1d4');
            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            const skipCall = addEntry.mock.calls.map(c => c[1]).find(e => e?.automationType === 'secondary_damage_skipped');
            expect(skipCall?.reason).toBe('no advantage');
        });
    });

    describe('legacy always-roll rows unchanged (MA-0426/0531 byte-identical)', () => {
        it('secondaryCondition null on a normal hit — rider still rolls and applies', async () => {
            await rollScimitar(null, null);
            expect(rollExpression).toHaveBeenCalledWith('1d4');
            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            const skipped = addEntry.mock.calls.map(c => c[1]?.automationType);
            expect(skipped).not.toContain('secondary_damage_skipped');
        });

        it('missing secondaryCondition key entirely — rider still rolls and applies', async () => {
            stampForcedMode(null);
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 2, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 5, newHp: 7, damageReduced: false });
            const context = scimitarContext(undefined);
            delete context.secondaryCondition;
            const fn = createLogDamageAndShow(deps);
            await fn({ name: 'Claw', formula: '1d6 + 2', total: 5, rolls: [3], modifier: 2, context });
            expect(rollExpression).toHaveBeenCalledWith('1d4');
            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
        });
    });
});
