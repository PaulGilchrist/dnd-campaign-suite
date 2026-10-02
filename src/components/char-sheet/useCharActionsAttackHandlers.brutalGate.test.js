// CLA-044 regression: once-per-turn Brutal Strike latch must refuse the
// chooser after a spend on the same turn (holder-match, top-level truth),
// and the brutalOnly chooser must roll the arming attack.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

vi.mock('../../hooks/runtime/useRuntimeState.js');
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'STALE_CS_MIRROR'),
    getCurrentCombatRound: vi.fn(() => 1),
}));
vi.mock('../../services/automation/common/buffToggle.js', () => ({ toggleBuff: vi.fn() }));
vi.mock('../../services/rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
    markOncePerTurn: vi.fn().mockResolvedValue({ round: 1, activeCreature: 'Korgath' }),
}));
vi.mock('../../services/rules/features/friendsService.js', () => ({ endFriendsOnHostileAction: vi.fn() }));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({ endInvisibilityOnHostileAction: vi.fn() }));
vi.mock('../../services/combat/brutalStrikeSelection.js', () => ({ selectBrutalStrikeRiders: vi.fn() }));

const logService = await import('../../services/ui/logService.js');
const oncePerTurn = await import('../../services/automation/common/oncePerTurn.js');
const { getActiveCreatureName } = await import('../../services/encounters/combatData.js');
const { selectBrutalStrikeRiders } = await import('../../services/combat/brutalStrikeSelection.js');

const campaignName = 'test-campaign';
const playerName = 'Korgath';

const RIDER = {
    name: 'Brutal Strike',
    damageExpression: '2d10',
    options: [
        { name: 'Forceful Blow', effect: 'speed_reduction', value: '15_ft_until_start_of_next_turn' },
        { name: 'Hamstring Blow', effect: 'push_15ft' },
        { name: 'Tiring Blow', effect: 'disadvantage_on_next_save' },
        { name: 'Sundering Blow', effect: 'next_attack_bonus', value: 5 },
    ],
    maxEffects: 2,
};

const playerStats = { name: playerName, level: 20, class: { name: 'Barbarian' } };
const specialActions = [{ effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' }];

function createDeps({ grv, ...overrides } = {}) {
    return {
        cannotAct: false,
        buildCtx: vi.fn(() => Promise.resolve({ hitBonus: 11 })),
        rollAttack: vi.fn(),
        exhaustionPenalty: 0,
        playerName,
        campaignName,
        setModalState: vi.fn(),
        specialActions,
        passives: [{ name: 'Brutal Strike' }],
        playerStats,
        getRuntimeValue: grv || vi.fn(),
        setRuntimeValue: vi.fn(),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

describe('CLA-044: Brutal Strike once-per-turn gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        selectBrutalStrikeRiders.mockReturnValue([RIDER]);
    });

    it('offers the brutalOnly chooser when reckless is active and latch is absent', () => {
        const deps = createDeps({
            grv: vi.fn((name, key) => {
                if (name === 'campaign' && key === 'activeCreatureName') return playerName;
                if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
                if (key === '_recklessAttack_offeredThisTurn') return { activeCreature: playerName };
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            }),
        });
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick({ name: 'Greataxe' });

        const modal = deps.setModalState.mock.calls[0][0].recklessAttackModal;
        expect(modal.mode).toBe('brutalOnly');
        expect(deps.rollAttack).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalledWith(campaignName, expect.objectContaining({ automationType: 'brutal_strike_refused' }));
    });

    it('refuses the chooser after a spend this turn — refusal log, no modal, attack still rolls', () => {
        const deps = createDeps({
            grv: vi.fn((name, key) => {
                if (name === 'campaign' && key === 'activeCreatureName') return playerName;
                if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
                if (key === '_recklessAttack_offeredThisTurn') return { activeCreature: playerName };
                if (key === '_BrutalStrike_usedRound') return { round: 1, activeCreature: playerName };
                return undefined;
            }),
        });
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick({ name: 'Greataxe' });

        expect(deps.setModalState).not.toHaveBeenCalled();
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'automation',
            automationType: 'brutal_strike_refused',
            characterName: playerName,
        }));
        expect(deps.buildCtx).toHaveBeenCalled();
    });

    it('holder match works even while the cs mirror is stale (split-brain)', () => {
        getActiveCreatureName.mockReturnValue('STALE_CS_MIRROR');
        const deps = createDeps({
            grv: vi.fn((name, key) => {
                if (name === 'campaign' && key === 'activeCreatureName') return playerName;
                if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
                if (key === '_recklessAttack_offeredThisTurn') return { activeCreature: 'STALE_CS_MIRROR' };
                if (key === '_BrutalStrike_usedRound') return { round: 1, activeCreature: playerName };
                return undefined;
            }),
        });
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick({ name: 'Greataxe' });

        expect(deps.setModalState).not.toHaveBeenCalled();
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({ automationType: 'brutal_strike_refused' }));
    });

    it('a spent latch belonging to another creature does not block a new turn', () => {
        const deps = createDeps({
            grv: vi.fn((name, key) => {
                if (name === 'campaign' && key === 'activeCreatureName') return playerName;
                if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
                if (key === '_recklessAttack_offeredThisTurn') return { activeCreature: 'Other' };
                if (key === '_BrutalStrike_usedRound') return { round: 1, activeCreature: 'Other' };
                return undefined;
            }),
        });
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick({ name: 'Greataxe' });

        const modal = deps.setModalState.mock.calls[0][0].recklessAttackModal;
        expect(modal.mode).toBe('brutalOnly');
    });
});

describe('CLA-044: brutalOnly chooser rolls the arming attack', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        selectBrutalStrikeRiders.mockReturnValue([RIDER]);
    });

    it('confirm arms, marks once-per-turn, and rolls the threaded attack', async () => {
        const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 11 }));
        const rollAttack = vi.fn();
        const deps = createDeps({ buildCtx, rollAttack });
        const handlers = useCharActionsAttackHandlers(deps);
        const attack = { name: 'Greataxe', hitBonus: 11 };

        handlers.handleBrutalStrikeConfirm({ useBrutalStrike: true, effectChoices: ['Forceful Blow'], riderName: 'Brutal Strike' }, attack);

        expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeActive', true, campaignName);
        expect(oncePerTurn.markOncePerTurn).toHaveBeenCalledWith('Brutal Strike', '_BrutalStrike_usedRound', playerStats, campaignName);
        await new Promise(process.nextTick);
        expect(buildCtx).toHaveBeenCalledWith(attack);
        expect(rollAttack).toHaveBeenCalledWith('Greataxe', 11, expect.any(Object));
    });

    it('cancel clears the sticky without arming', () => {
        const deps = createDeps();
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleBrutalStrikeCancel({ name: 'Greataxe', hitBonus: 11 });

        expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeActive', null, campaignName);
        expect(oncePerTurn.markOncePerTurn).not.toHaveBeenCalled();
    });
});
