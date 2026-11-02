// @maintained-by-ai
// Lane: createCreatureHandlers.js friendly-fire confirm (Phase 3.2 betrayal,
// arena-starter §4). Arming a target from the attacker's OWN ally list asks a
// UI-local confirm; cancel is inert, confirm arms normally and logs an
// audit-flagged row. Unlisted (hostile) targets and unedited ally lists never
// confirm — engine resolution is unchanged either way.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { setTarget } from '../../services/encounters/initiativeService.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (n) => n, guid: () => 'guid' } }));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(), sendDeathSavePrompt: vi.fn(),
}));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    clearCombat: vi.fn(), setInitiative: vi.fn(), renameNpc: vi.fn(), setTarget: vi.fn(),
    removeNpc: vi.fn(), addNpc: vi.fn(), mergeCombatSummaryWithCharacters: vi.fn(),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(), setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/items/autoRewardService.js', () => ({ autoAwardCombatRewards: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({ maybeGrantThiefsReflexesSecondTurn: vi.fn() }));
vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({ vanishSummonAtZeroHp: vi.fn() }));
vi.mock('../../services/rules/features/hypnoticPatternService.js', () => ({ breakHypnoticPatternOnDamage: vi.fn() }));
vi.mock('../../services/rules/effects/zoneDurationClock.js', () => ({ sweepNewCombatClocks: vi.fn(() => Promise.resolve()) }));

const campaignName = 'test-campaign';

function makeHandlers() {
    const combatSummary = {
        round: 1,
        creatures: [
            { name: 'Alice', type: 'player', currentHp: 20 },
            { name: 'Bob', type: 'player', currentHp: 15 },
            { name: 'Zombie', type: 'npc', currentHp: 10 },
        ],
    };
    const setCombatSummary = vi.fn();
    const handlers = createCreatureHandlers({
        combatSummary,
        campaignName,
        campaignNpcs: [],
        setNpcImages: vi.fn(),
        overlays: [],
        setCombatSummary,
        setActiveCreatureName: vi.fn(),
        characters: [{ name: 'Alice' }, { name: 'Bob' }],
        numOfNpc: 1,
        isLocalhost: true,
        showToast: vi.fn(),
    });
    return { handlers, combatSummary, setCombatSummary };
}

let confirmSpy;
beforeEach(() => {
    vi.clearAllMocks();
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
    vi.restoreAllMocks();
});

function seedAllies(list) {
    getRuntimeValue.mockImplementation((name, key) =>
        (name === 'Alice' && key === 'selectedAllies') ? list : null);
}

describe('handleClear', () => {
    it('zero-character roster clears without crashing (Arena/Starter quick play)', async () => {
        const { handlers, setCombatSummary } = makeHandlers()
        // Simulate the join→clear flow in a fresh arena/starter campaign: the
        // clear's newSummary (players-only skeleton) is EMPTY with 0 characters.
        const initiativeService = await import('../../services/encounters/initiativeService.js')
        initiativeService.clearCombat.mockReturnValue({ round: 1, creatures: [] })
        expect(() => handlers.handleClear()).not.toThrow()
        expect(setCombatSummary).toHaveBeenCalledWith({ round: 1, creatures: [] })
    })
})

describe('handleTargetChange — friendly-fire confirm', () => {
    it('ally target: confirm asked; on OK the target arms AND the row is log-flagged', () => {
        seedAllies(['Alice', 'Bob']);
        const { handlers } = makeHandlers();
        handlers.handleTargetChange('Alice', 'Bob');
        expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Friendly fire'));
        expect(setTarget).toHaveBeenCalledWith(expect.anything(), 'Alice', 'Bob');
        const entry = addEntry.mock.calls.find(c => c[1]?.friendlyFire)?.[1];
        expect(entry).toMatchObject({ characterName: 'Alice', friendlyFire: true });
        expect(entry.description).toContain('Bob');
    });

    it('cancel is fully inert: no arm, no log', () => {
        seedAllies(['Alice', 'Bob']);
        confirmSpy.mockReturnValue(false);
        const { handlers, setCombatSummary } = makeHandlers();
        handlers.handleTargetChange('Alice', 'Bob');
        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(setTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
    });

    it('non-ally target arms without a confirm', () => {
        seedAllies(['Alice', 'Bob']);
        const { handlers } = makeHandlers();
        handlers.handleTargetChange('Alice', 'Zombie');
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(setTarget).toHaveBeenCalledWith(expect.anything(), 'Alice', 'Zombie');
    });

    it('unedited ally list (default self-only) never confirms legacy PvP arms', () => {
        getRuntimeValue.mockReturnValue(null);
        const { handlers } = makeHandlers();
        handlers.handleTargetChange('Alice', 'Bob');
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(setTarget).toHaveBeenCalledWith(expect.anything(), 'Alice', 'Bob');
    });

    it('overlay (AoE) arming bypasses the confirm lane', () => {
        seedAllies(['Alice', 'Bob']);
        const { handlers } = makeHandlers();
        handlers.handleTargetChange('Alice', 'overlay-abc');
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(setTarget).not.toHaveBeenCalled(); // unknown overlay id → no arm (existing behavior)
    });
});
