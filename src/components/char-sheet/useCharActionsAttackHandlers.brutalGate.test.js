// @maintained-by-ai
// CLA-044 gate lane: the once-per-turn Brutal Strike latch semantics on the
// handleAttackClick chooser path ONLY — a spent latch held by this creature
// refuses the chooser (refusal log, zero spend, attack still rolls), while an
// absent latch or one held by another creature still opens the brutalOnly
// chooser. Terminal confirm/cancel handlers are owned by
// useCharActionsAttackHandlers-2.test.js (they pin the exact sticky writes,
// logs, exhaustion and finally-clears there); chooser dispatch/payload and
// rider selection are owned by .test.js and .improvedBrutalStrike.test.js —
// none of those are re-tested here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

// Dead-mock purge: the old vi.mock('../../hooks/runtime/useRuntimeState.js')
// automock was dead — the hook takes getRuntimeValue via deps and never
// imports it (grep of useCharActionsAttackHandlers.js finds no reference),
// and the -2 lane runs the identical transitive graph unmocked.
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
// The cs mirror answers STALE_CS_MIRROR on every row: holder-match must ride
// the campaign activeCreatureName top-level truth, never this frozen mirror
// (the CLA-044 split-brain regression).
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'STALE_CS_MIRROR'),
    getCurrentCombatRound: vi.fn(() => 1),
    getCombatSummary: vi.fn(() => null),
}));
// buffToggle/expirations/oncePerTurn/friends/invisibility are reachable from
// runAttackClick's module graph; mocked so the click lane has no real side
// effects. oncePerTurn has no fake return: if the gate ever regressed into
// spending on the click lane, the source's .catch() on undefined would be
// loud, not silent.
vi.mock('../../services/automation/common/buffToggle.js', () => ({ toggleBuff: vi.fn() }));
vi.mock('../../services/rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({ markOncePerTurn: vi.fn() }));
vi.mock('../../services/rules/features/friendsService.js', () => ({ endFriendsOnHostileAction: vi.fn() }));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({ endInvisibilityOnHostileAction: vi.fn() }));
vi.mock('../../services/combat/brutalStrikeSelection.js', () => ({ selectBrutalStrikeRiders: vi.fn() }));

const logService = await import('../../services/ui/logService.js');
const oncePerTurn = await import('../../services/automation/common/oncePerTurn.js');
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

/** Fresh attack row per test (never shared mutable state). */
function makeAttack() {
    return { name: 'Greataxe', hitBonus: 11 };
}

/**
 * Runtime-store read stub keyed by store key; the split-brain scenario only
 * needs the campaign-scoped activeCreatureName truth plus per-key overrides.
 */
function makeRuntimeStore(overrides = {}) {
    const store = {
        activeCreatureName: playerName,
        activeBuffs: [{ effect: 'advantage_attacks_advantage_against' }],
        '_recklessAttack_offeredThisTurn': { activeCreature: playerName },
        '_BrutalStrike_usedRound': null,
        ...overrides,
    };
    return vi.fn((_charKey, key) => store[key]);
}

// exhaustionPenalty 2 pins the subtraction on the refusal lane's terminal
// roll, byte-exact: hitBonus 11 − penalty 2 → rollAttack('Greataxe', 9, ctx).
function createDeps(overrides = {}) {
    const ctx = { hitBonus: 11 };
    return {
        cannotAct: false,
        buildCtx: vi.fn(() => Promise.resolve(ctx)),
        rollAttack: vi.fn(),
        exhaustionPenalty: 2,
        playerName,
        campaignName,
        setModalState: vi.fn(),
        specialActions: [{ effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' }],
        passives: [{ name: 'Brutal Strike' }],
        playerStats: { name: playerName, level: 20, class: { name: 'Barbarian' } },
        getRuntimeValue: makeRuntimeStore(),
        setRuntimeValue: vi.fn(),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

describe('CLA-044: Brutal Strike once-per-turn gate (handleAttackClick chooser lane)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        selectBrutalStrikeRiders.mockReturnValue([RIDER]);
    });

    it.each([
        ['absent latch', null],
        ['latch stamped on another creature', { round: 1, activeCreature: 'Other' }],
    ])('%s: chooser opens brutalOnly with the full offer payload, zero logs, no roll, no spend', async (_label, usedRound) => {
        const deps = createDeps({
            getRuntimeValue: makeRuntimeStore({ '_BrutalStrike_usedRound': usedRound }),
        });
        const handlers = useCharActionsAttackHandlers(deps);
        const attack = makeAttack();

        handlers.handleAttackClick(attack);

        expect(deps.setModalState).toHaveBeenCalledTimes(1);
        expect(deps.setModalState).toHaveBeenCalledWith({
            recklessAttackModal: {
                attack,
                mode: 'brutalOnly',
                hasBrutalStrike: true,
                brutalStrikeOptions: RIDER.options,
                maxEffects: 2,
                riderName: 'Brutal Strike',
            },
        });
        expect(logService.addEntry).not.toHaveBeenCalled();
        expect(oncePerTurn.markOncePerTurn).not.toHaveBeenCalled();
        expect(deps.buildCtx).not.toHaveBeenCalled();
        expect(deps.rollAttack).not.toHaveBeenCalled();
    });

    it('a latch spent by this creature refuses the chooser — byte-exact refusal log, zero spend, attack still rolls through the stale cs mirror', async () => {
        // Split-brain wiring: the cs mirror is frozen at STALE_CS_MIRROR and
        // the reckless-offered latch is stamped against that stale name, yet
        // holder-match on the campaign top-level truth must still refuse.
        const deps = createDeps({
            getRuntimeValue: makeRuntimeStore({
                '_recklessAttack_offeredThisTurn': { activeCreature: 'STALE_CS_MIRROR' },
                '_BrutalStrike_usedRound': { round: 1, activeCreature: playerName },
            }),
        });
        const handlers = useCharActionsAttackHandlers(deps);
        const attack = makeAttack();

        handlers.handleAttackClick(attack);

        expect(deps.setModalState).not.toHaveBeenCalled();
        expect(logService.addEntry).toHaveBeenCalledTimes(1);
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'automation',
            characterName: playerName,
            automationType: 'brutal_strike_refused',
            name: 'Brutal Strike',
            description: 'Brutal Strike: already used this turn — once per turn, chooser refused',
            timestamp: expect.any(Number),
        });
        // Refusal is a zero-spend event: no once-per-turn mark, no sticky writes
        // (the CLA-143 _attackActionTakenRound stamp is a different lane's key).
        expect(oncePerTurn.markOncePerTurn).not.toHaveBeenCalled();
        expect(deps.setRuntimeValue.mock.calls.filter(c => c[1] === '_brutalStrikeActive')).toEqual([]);
        expect(deps.setRuntimeValue.mock.calls.filter(c => c[1] === '_brutalStrikeEffects')).toEqual([]);
        // Refusal does not block the attack — it rolls normally via buildCtx.
        await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Greataxe', 9, { hitBonus: 11 }));
    });
});
