// CLA-405: Bonus Action attack rows arm the Fleet Step Step-of-the-Wind
// grant (SP-128 flag-lane consumer); Attack-action rows and refused/blocked
// clicks never grant.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'Disciplined_Monk'),
    getCurrentCombatRound: vi.fn(() => 3),
}));
vi.mock('../../services/automation/common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
    markOncePerTurn: vi.fn(),
}));
vi.mock('../../services/rules/features/friendsService.js', () => ({
    endFriendsOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));
vi.mock('../../services/combat/brutalStrikeSelection.js', () => ({
    selectBrutalStrikeRiders: vi.fn(() => []),
}));
vi.mock('../../services/rules/features/fleetStepService.js', () => ({
    grantFleetStep: vi.fn(() => Promise.resolve(true)),
}));

import { grantFleetStep } from '../../services/rules/features/fleetStepService.js';

const campaignName = 'test-campaign';

function createDeps(overrides = {}) {
    const {
        cannotAct = false,
        playerStats = { name: 'Disciplined_Monk', level: 20, rules: '2024', class: { name: 'Monk' } },
    } = overrides;
    return {
        cannotAct,
        buildCtx: vi.fn(() => Promise.resolve({})),
        rollAttack: vi.fn(),
        exhaustionPenalty: 0,
        playerName: playerStats.name,
        campaignName,
        setModalState: vi.fn(),
        specialActions: [],
        passives: [],
        playerStats,
        getRuntimeValue: vi.fn(() => null),
        setRuntimeValue: vi.fn(),
        setPopupHtml: vi.fn(),
    };
}

const staffRow = { name: 'Quarterstaff', type: 'Action', hitBonus: 11, damage: '1d6+5', weaponType: 'melee' };
const bonusRow = { name: 'Unarmed Strike', type: 'Bonus Action', hitBonus: 11, damage: '1d12+5', weaponType: 'unarmed' };

describe('CLA-405 Fleet Step grant from the BA attack lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('grants after a Bonus Action attack row resolves (Unarmed Strike BA)', () => {
        const deps = createDeps();
        useCharActionsAttackHandlers(deps).handleAttackClick(bonusRow);
        expect(grantFleetStep).toHaveBeenCalledTimes(1);
        expect(grantFleetStep.mock.calls[0][0]).toBe(deps.playerStats);
        expect(grantFleetStep.mock.calls[0][1]).toBe(campaignName);
        expect(grantFleetStep.mock.calls[0][2]).toBe('Unarmed Strike');
    });

    it('does NOT grant on an Attack-action row', () => {
        const deps = createDeps();
        useCharActionsAttackHandlers(deps).handleAttackClick(staffRow);
        expect(grantFleetStep).not.toHaveBeenCalled();
    });

    it('does NOT grant when cannotAct', () => {
        const deps = createDeps({ cannotAct: true });
        useCharActionsAttackHandlers(deps).handleAttackClick(bonusRow);
        expect(grantFleetStep).not.toHaveBeenCalled();
    });

    it('still rolls the bonus attack (grant never blocks the lane)', async () => {
        const deps = createDeps();
        useCharActionsAttackHandlers(deps).handleAttackClick(bonusRow);
        await Promise.resolve();
        await Promise.resolve();
        expect(deps.rollAttack).toHaveBeenCalledWith('Unarmed Strike', 11, {});
    });
});
