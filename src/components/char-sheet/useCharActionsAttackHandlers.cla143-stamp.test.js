// CLA-143: the Attack-action row lane arms the round-keyed latch that
// gateTriggerRequirement (useCharActionsAutomation.js) enforces.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

vi.mock('../../hooks/runtime/useRuntimeState.js');
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
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
    markOncePerTurn: vi.fn().mockResolvedValue({ round: 3, activeCreature: 'Disciplined_Monk' }),
}));
vi.mock('../../services/rules/features/friendsService.js', () => ({
    endFriendsOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

const campaignName = 'test-campaign';

function createDeps(overrides = {}) {
    const {
        cannotAct = false,
        playerName = 'Disciplined_Monk',
        getRuntimeValue = vi.fn(),
        setRuntimeValue = vi.fn(),
        buildCtx = vi.fn(() => Promise.resolve({})),
        rollAttack = vi.fn(),
        setModalState = vi.fn(),
        specialActions = [],
        passives = [],
        exhaustionPenalty = 0,
    } = overrides;
    return {
        cannotAct,
        buildCtx,
        rollAttack,
        exhaustionPenalty,
        playerName,
        campaignName,
        setModalState,
        specialActions,
        passives,
        playerStats: { name: playerName, level: 20, class: { name: 'Monk' } },
        getRuntimeValue,
        setRuntimeValue,
    };
}

const staffRow = { name: 'Quarterstaff', type: 'Action', hitBonus: 11, damage: '1d6+5', weaponType: 'melee' };
const bonusRow = { name: 'Unarmed Strike', type: 'Bonus Action', hitBonus: 11, damage: '1d12+5', weaponType: 'unarmed' };

describe('CLA-143 _attackActionTakenRound stamp', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('stamps holder + current round on an Attack-action row click', () => {
        const deps = createDeps();
        const handlers = useCharActionsAttackHandlers(deps);
        handlers.handleAttackClick(staffRow);
        const stamp = deps.setRuntimeValue.mock.calls.find(c => c[1] === '_attackActionTakenRound');
        expect(stamp).toBeTruthy();
        expect(stamp[0]).toBe('Disciplined_Monk');
        expect(stamp[2]).toBe(3);
    });

    it('does NOT stamp on a Bonus Action attack row (Flurry cannot re-arm itself)', () => {
        const deps = createDeps();
        const handlers = useCharActionsAttackHandlers(deps);
        handlers.handleAttackClick(bonusRow);
        expect(deps.setRuntimeValue.mock.calls.filter(c => c[1] === '_attackActionTakenRound').length).toBe(0);
    });

    it('does NOT stamp when cannotAct', () => {
        const deps = createDeps({ cannotAct: true });
        const handlers = useCharActionsAttackHandlers(deps);
        handlers.handleAttackClick(staffRow);
        expect(deps.setRuntimeValue.mock.calls.filter(c => c[1] === '_attackActionTakenRound').length).toBe(0);
    });

    it('stamps even when the Reckless chooser opens (click already committed the Attack action)', () => {
        const specialActions = [{
            name: 'Reckless Attack',
            effect: 'advantage_attacks_advantage_against',
            trigger: 'first_attack_of_turn',
        }];
        const deps = createDeps({ specialActions });
        const handlers = useCharActionsAttackHandlers(deps);
        handlers.handleAttackClick(staffRow);
        expect(deps.setModalState).toHaveBeenCalled();
        expect(deps.setRuntimeValue.mock.calls.some(c => c[1] === '_attackActionTakenRound')).toBe(true);
    });
});
