// @maintained-by-ai
// MN-014 lane — Precision Attack MISS die math (handlePrecisionAttackMiss +
// precisionMissDieValue). Owns: consumed-die preference (executor dieValue, never a
// phantom re-roll), the fallback chain (dieValue → rollExpression → evaluateAutoExpression),
// the spent>0 guard, defensive popup defaults (missing rolls/bonus → 0, missing AC → 10),
// the >= AC equality boundary, spend-log flush ordered BEFORE the recalculated ability_use
// entry, and the attack-roll-not-damage invariant (no attackRiderDieValue runtime write).
// Lane ownership (do not duplicate here): dispatch popup/resume/stash-hit semantics →
// useAttackDamageResolution.maneuvers.test.js; executeAttackRiderManeuver save-DC arg
// forwarding + size-gate refusal → .mn015SaveDc.test.js; ally picker → .maneuveringAlly.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    collectWeaponMastery: vi.fn(),
    evaluateAutoExpression: vi.fn(),
    hasTwoWeaponFighting: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getAttackRiderOptions: vi.fn(),
    getAttackRiderOptionsByContext: vi.fn(),
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { addEntry } from '../../services/ui/logService.js';
import { executeAttackRiderManeuver } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const CHAR = 'TestFighter';
const CAMPAIGN = 'test-campaign';

const ATTACK = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', weaponType: 'melee', properties: [] };
const PRECISION = { name: 'Precision Attack', effect: 'attack_roll_bonus', dieExpression: '1d8' };
const CURRENT = { formula: '1d8+3', total: 8, rolls: [5, 3] };

// Fresh fixtures per mount — no cross-test bleed of popup/modal/pause state.
function UseAttackDamageResolution(overrides = {}) {
    const playerStats = {
        name: CHAR,
        level: 5,
        abilities: [
            { name: 'Strength', bonus: 3 },
            { name: 'Dexterity', bonus: 2 },
        ],
        proficiency: 3,
        automation: { actions: [], passives: [] },
    };
    const setPopupHtml = vi.fn();
    const modalState = {};
    const setModalState = vi.fn((updates) => Object.assign(modalState, updates));
    const resumeRef = { current: null };
    const api = useAttackDamageResolution({
        playerStats,
        campaignName: CAMPAIGN,
        mapName: null,
        popupHtml: null,
        setPopupHtml,
        rollDamage: vi.fn(),
        buildCtx: vi.fn(() => Promise.resolve({ targetName: 'Cambion', sneakAttackDice: 0 })),
        buildCtxSync: vi.fn(() => Promise.resolve({ targetName: 'Cambion', sneakAttackDice: 0 })),
        modalState,
        setModalState,
        setPendingDamage: vi.fn(),
        resumeRef,
        ...overrides,
    });
    return { api, playerStats, setPopupHtml, modalState, setModalState, resumeRef };
}

// Pipeline paused at attackRiderManeuvers whose stash resume can strand/clear cleanly.
function pausedAtManeuvers(stashCtx) {
    const resume = vi.fn(async (_ctx, ref) => { if (ref) ref.current = null; });
    const resumeRef = {
        current: { pipelineStash: { pipeline: { resume }, ctx: stashCtx }, _pausedStep: 'attackRiderManeuvers' },
    };
    return { resume, resumeRef };
}

describe('MN-014 — Precision miss die math', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });
        evaluateAutoExpression.mockReturnValue(0);
        executeAttackRiderManeuver.mockResolvedValue(undefined);
        addEntry.mockResolvedValue(undefined);
        getRuntimeValue.mockReturnValue(null);
        getActiveBuffs.mockReturnValue([]);
    });

    it('consumes the executor die without re-rolling and lands the exact popup, full ledger, and miss result', async () => {
        // Poison the roller: any phantom re-roll would shift totals even without the call assertion.
        rollExpression.mockReturnValue({ total: 99, rolls: [99], modifier: 0 });
        const logEntries = [
            { description: 'Rolled d8 for 5 (Relentless)' },
            { description: 'Expend 1 Superiority Die' },
        ];
        executeAttackRiderManeuver.mockResolvedValue({ type: 'popup', dieValue: 5, logEntries });
        const missPopup = { rolls: [8], bonus: 8, targetAc: 99, isCrit: false, hit: false, isMiss: true };
        const dieDesc = 'Precision Attack: Added 5 to the attack roll (8 + 8 + 5 = 21). The attack still misses.';
        const { api, setPopupHtml } = UseAttackDamageResolution({ popupHtml: missPopup });

        const result = await api.handleAttackRiderManeuverUse(PRECISION, ATTACK, missPopup, CURRENT);

        expect(result).toEqual({
            formula: '1d8+3', total: 8, rolls: [5, 3],
            isMissResult: true, hit: false, description: dieDesc,
        });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(evaluateAutoExpression).not.toHaveBeenCalled();
        expect(setPopupHtml).toHaveBeenCalledTimes(1);
        expect(setPopupHtml).toHaveBeenCalledWith({
            rolls: [8], bonus: 8, targetAc: 99, isCrit: false, hit: false, isMiss: true,
            total: 21, isNatural20: false, superiorityDieAdded: 5, originalTotal: 16, originalD20: 8,
        });
        // Ledger trail: executor spend entries flush first, then the recalculated outcome — campaign-exact.
        expect(addEntry.mock.calls).toEqual([
            [CAMPAIGN, logEntries[0]],
            [CAMPAIGN, logEntries[1]],
            [CAMPAIGN, { type: 'ability_use', characterName: CHAR, name: 'Precision Attack', description: dieDesc }],
        ]);
        // Precision adds to the attack roll, never to the pending damage formula.
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it.each([
        {
            branch: 'executor omits dieValue',
            executor: { type: 'popup', logEntries: [] },
            rolled: { total: 4, rolls: [4], modifier: 0 },
            expectedDie: 4,
        },
        {
            // Pins the spent>0 guard: a zero die is an unspent die, not a free bonus.
            branch: 'executor spent dieValue 0',
            executor: { type: 'popup', dieValue: 0, logEntries: [] },
            rolled: { total: 4, rolls: [4], modifier: 0 },
            expectedDie: 4,
        },
        {
            branch: 'roller returns no total',
            executor: { type: 'popup', logEntries: [] },
            rolled: undefined,
            expectedDie: 6,
        },
    ])('falls back down the die chain on $branch', async ({ executor, rolled, expectedDie }) => {
        executeAttackRiderManeuver.mockResolvedValue(executor);
        if (rolled === undefined) {
            rollExpression.mockReturnValue(undefined);
            evaluateAutoExpression.mockReturnValue(6);
        } else {
            rollExpression.mockReturnValue(rolled);
        }
        const missPopup = { rolls: [8], bonus: 8, targetAc: 99, isCrit: false, hit: false, isMiss: true };
        const { api, setPopupHtml } = UseAttackDamageResolution({ popupHtml: missPopup });

        const result = await api.handleAttackRiderManeuverUse(PRECISION, ATTACK, missPopup, CURRENT);

        expect(rollExpression).toHaveBeenCalledWith('1d8');
        expect(evaluateAutoExpression).toHaveBeenCalledTimes(rolled === undefined ? 1 : 0);
        if (rolled === undefined) {
            expect(evaluateAutoExpression).toHaveBeenCalledWith('1d8', expect.objectContaining({ name: CHAR }));
        }
        expect(result.description).toBe(`Precision Attack: Added ${expectedDie} to the attack roll (8 + 8 + ${expectedDie} = ${16 + expectedDie}). The attack still misses.`);
        expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            superiorityDieAdded: expectedDie, originalTotal: 16, total: 16 + expectedDie, hit: false,
        }));
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('defaults missing rolls/bonus to 0 and missing AC to 10 when the miss popup carries no dice', async () => {
        executeAttackRiderManeuver.mockResolvedValue({ type: 'popup', dieValue: 8, logEntries: [] });
        const barePopup = { isCrit: false, hit: false, isMiss: true };
        const { api, setPopupHtml } = UseAttackDamageResolution({ popupHtml: barePopup });

        const result = await api.handleAttackRiderManeuverUse(PRECISION, ATTACK, barePopup, CURRENT);

        expect(result).toEqual({
            formula: '1d8+3', total: 8, rolls: [5, 3],
            isMissResult: true, hit: false,
            description: 'Precision Attack: Added 8 to the attack roll (0 + 0 + 8 = 8). The attack still misses.',
        });
        expect(setPopupHtml).toHaveBeenCalledTimes(1);
        expect(setPopupHtml).toHaveBeenCalledWith({
            isCrit: false, hit: false, isMiss: true,
            total: 8, isNatural20: false, superiorityDieAdded: 8, originalTotal: 0, originalD20: 0,
        });
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('counts newTotal exactly equal to AC as a hit and carries the recalculated popup into the stash', async () => {
        executeAttackRiderManeuver.mockResolvedValue({ type: 'popup', dieValue: 5, logEntries: [] });
        const missPopup = { rolls: [12], bonus: 3, targetAc: 20, isCrit: false, hit: false, isMiss: true };
        const stashCtx = { hit: false };
        const { resumeRef } = pausedAtManeuvers(stashCtx);
        const { api, setPopupHtml } = UseAttackDamageResolution({ popupHtml: missPopup, resumeRef });

        const result = await api.handleAttackRiderManeuverUse(PRECISION, ATTACK, missPopup, CURRENT);

        expect(result.hit).toBe(true);
        expect(result.description).toBe('Precision Attack: Added 5 to the attack roll (12 + 3 + 5 = 20). The attack now hits!');
        const expectedPopup = {
            rolls: [12], bonus: 3, targetAc: 20, isCrit: false, hit: true, isMiss: true,
            total: 20, isNatural20: false, superiorityDieAdded: 5, originalTotal: 15, originalD20: 12,
        };
        expect(setPopupHtml).toHaveBeenCalledWith(expectedPopup);
        // The resumed pipeline must receive the recalculated popup, not the original miss.
        expect(stashCtx.hit).toBe(true);
        expect(stashCtx.popupHtml).toEqual(expectedPopup);
    });
});
