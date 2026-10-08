// MN-014: the miss-chooser Precision lane must consume the die the executor
// already rolled + expended (no phantom re-roll), flush the executor's spend
// log, and log the recalculated total and hit/miss outcome.
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
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { addEntry } from '../../services/ui/logService.js';
import { getAttackRiderOptions, getAttackRiderOptionsByContext, executeAttackRiderManeuver } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const mockPlayerStats = {
    name: 'TestFighter',
    level: 5,
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
    ],
    proficiency: 3,
    automation: { actions: [], passives: [] },
};

const mockCampaignName = 'test-campaign';

const mockSetPopupHtml = vi.fn();
const mockRollDamage = vi.fn();
const mockBuildCtx = vi.fn(() => Promise.resolve({ targetName: 'Cambion', sneakAttackDice: 0 }));
const mockBuildCtxSync = vi.fn(() => Promise.resolve({ targetName: 'Cambion', sneakAttackDice: 0 }));
const mockPendingDamageRef = { current: null };
const mockSetPendingDamage = vi.fn();
const modalState = {};
const mockSetModalState = vi.fn((updates) => {
    if (typeof updates === 'function') return updates(modalState);
    Object.assign(modalState, updates);
});

function UseAttackDamageResolution(overrides = {}) {
    return useAttackDamageResolution({
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        mapName: null,
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
        rollDamage: mockRollDamage,
        buildCtx: mockBuildCtx,
        buildCtxSync: mockBuildCtxSync,
        modalState,
        setModalState: mockSetModalState,
        pendingDamage: mockPendingDamageRef.current,
        setPendingDamage: mockSetPendingDamage,
        resumeRef: mockPendingDamageRef,
        ...overrides,
    });
}

describe('MN-014 — miss chooser Precision resolution lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((key, prop) => prop === 'resumeRef' ? {} : null);
        getActiveBuffs.mockReturnValue([]);
        getAttackRiderOptions.mockResolvedValue([]);
        getAttackRiderOptionsByContext.mockResolvedValue([]);
        mockPendingDamageRef.current = null;
        Object.keys(modalState).forEach((key) => delete modalState[key]);
    });

    const precision = { name: 'Precision Attack', effect: 'attack_roll_bonus', dieExpression: '1d8' };
    const missPopup = { rolls: [8], bonus: 8, targetAc: 99, isCrit: false, hit: false, isMiss: true };

    it('consumes the executor die value and never re-rolls', async () => {
        executeAttackRiderManeuver.mockResolvedValue({
            type: 'popup',
            dieValue: 5,
            logEntries: [{ description: 'Rolled d8 for 5 (Relentless)' }],
        });
        rollExpression.mockReturnValue({ total: 99, rolls: [99], modifier: 0 });

        const { handleAttackRiderManeuverUse } = UseAttackDamageResolution({ popupHtml: missPopup });
        const result = await handleAttackRiderManeuverUse(precision, { damageType: 'slashing' }, missPopup, { formula: '1d8+3', total: 8, rolls: [5, 3] });

        expect(rollExpression).not.toHaveBeenCalled();
        expect(result.isMissResult).toBe(true);
        expect(result.description).toContain('Added 5 to the attack roll (8 + 8 + 5 = 21)');
        expect(result.description).toContain('still misses');
    });

    it('flushes the executor spend log AND logs the recalculated outcome', async () => {
        executeAttackRiderManeuver.mockResolvedValue({
            type: 'popup',
            dieValue: 5,
            logEntries: [{ description: 'Rolled d8 for 5' }, { description: 'Expend 1 Superiority Die' }],
        });

        const { handleAttackRiderManeuverUse } = UseAttackDamageResolution({ popupHtml: missPopup });
        await handleAttackRiderManeuverUse(precision, { damageType: 'slashing' }, missPopup, { formula: '1d8+3', total: 8, rolls: [5, 3] });

        const logged = addEntry.mock.calls.map(c => c[1].description);
        expect(logged).toContain('Rolled d8 for 5');
        expect(logged).toContain('Expend 1 Superiority Die');
        expect(logged.some(d => d.includes('Added 5 to the attack roll'))).toBe(true);
        expect(addEntry.mock.calls.every(c => c[0] === mockCampaignName)).toBe(true);
    });

    it('sets the converted popup with superiorityDieAdded and originalTotal', async () => {
        executeAttackRiderManeuver.mockResolvedValue({ type: 'popup', dieValue: 5, logEntries: [] });

        const { handleAttackRiderManeuverUse } = UseAttackDamageResolution({ popupHtml: missPopup });
        await handleAttackRiderManeuverUse(precision, { damageType: 'slashing' }, missPopup, { formula: '1d8+3', total: 8, rolls: [5, 3] });

        const popup = mockSetPopupHtml.mock.calls.find(c => c[0]?.superiorityDieAdded)?.[0];
        expect(popup).toMatchObject({ superiorityDieAdded: 5, originalTotal: 16, total: 21, hit: false });
    });

    it('falls back to a roll only when the executor returned no die value', async () => {
        executeAttackRiderManeuver.mockResolvedValue({ type: 'popup', logEntries: [] });
        rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

        const { handleAttackRiderManeuverUse } = UseAttackDamageResolution({ popupHtml: missPopup });
        const result = await handleAttackRiderManeuverUse(precision, { damageType: 'slashing' }, missPopup, { formula: '1d8+3', total: 8, rolls: [5, 3] });

        expect(rollExpression).toHaveBeenCalledWith('1d8');
        expect(result.description).toContain('Added 4');
    });
});
