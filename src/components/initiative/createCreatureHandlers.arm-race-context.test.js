// @maintained-by-ai
// Regression (bug-race-arm-patch-beats-swap-clear-post): the scoped arm PATCH is
// coalesced ~120 ms client-side, so cross-tab it could land AFTER a concurrent
// control swap's full-board POST (which deletes targetName on the same write, per
// the owner law) and the server's by-name merge re-armed the already-swapped row.
// Fix contract owned here: a DELEGATED row's arm write declares its controller
// context (seenController — wire-only; campaigns-changedata.js dropStaleArmWrites
// drops the targetName when the row's controller has moved). GM/PC rows (no
// delegated controller at issue time) keep the exact legacy payload bytes — the
// blessed first-time-assign face (an existing arm survives the assign) stays
// merge-permissive. Swap/release write semantics + audits stay pinned in
// createCreatureHandlers.control.test.js; the friendly-fire gate in
// createCreatureHandlers.friendly-fire.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import storage from '../../services/ui/storage.js';
import { setTarget } from '../../services/encounters/initiativeService.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn(), patch: vi.fn() } }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (n) => n, guid: () => 'guid' } }));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(), sendDeathSavePrompt: vi.fn(),
}));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    clearCombat: vi.fn(), setInitiative: vi.fn(), renameNpc: vi.fn(),
    setTarget: vi.fn((summary, name, target) => {
        const row = summary.creatures.find(c => c.name === name);
        if (row) row.targetName = target;
    }),
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

function makeHandlers(creatureOverrides = {}) {
    const combatSummary = {
        round: 1,
        creatures: [
            { name: 'Alice', type: 'player', currentHp: 20 },
            { name: 'Bob', type: 'player', currentHp: 15 },
            { name: 'Zombie', type: 'npc', currentHp: 10, ...creatureOverrides },
        ],
    };
    const handlers = createCreatureHandlers({
        combatSummary,
        campaignName,
        campaignNpcs: [],
        setNpcImages: vi.fn(),
        overlays: [],
        setCombatSummary: vi.fn(),
        setActiveCreatureName: vi.fn(),
        characters: [{ name: 'Alice' }, { name: 'Bob' }],
        numOfNpc: 2,
        isLocalhost: true,
        showToast: vi.fn(),
    });
    return { handlers, combatSummary };
}

const patchedRecord = () => storage.patch.mock.calls[0][1].creatures[0];

beforeEach(() => {
    vi.clearAllMocks();
});

describe('arm lane — declared controller context on the scoped PATCH', () => {
    it('delegated row: the arm record carries seenController (the swap-race witness)', () => {
        const { handlers } = makeHandlers({ controller: 'Bob' });

        handlers.handleTargetChange('Zombie', 'Alice');

        expect(storage.patch).toHaveBeenCalledWith('combatSummary', {
            creatures: [{ name: 'Zombie', targetName: 'Alice', seenController: 'Bob' }],
        }, campaignName);
    });

    it('delegated row unarm (empty select) also carries the context stamp', () => {
        const { handlers } = makeHandlers({ controller: 'Bob' });

        handlers.handleTargetChange('Zombie', '');

        expect(patchedRecord()).toEqual({ name: 'Zombie', targetName: null, seenController: 'Bob' });
    });

    it('GM-controlled monster keeps the legacy bytes — no stamp (first-time-assign face stays permissive)', () => {
        const { handlers } = makeHandlers();

        handlers.handleTargetChange('Zombie', 'Alice');

        expect(storage.patch).toHaveBeenCalledWith('combatSummary', {
            creatures: [{ name: 'Zombie', targetName: 'Alice' }],
        }, campaignName);
        expect('seenController' in patchedRecord()).toBe(false);
    });

    it('player rows never stamp (no delegated controller lane exists)', () => {
        const { handlers } = makeHandlers();

        handlers.handleTargetChange('Alice', 'Zombie');

        expect(patchedRecord()).toEqual({ name: 'Alice', targetName: 'Zombie' });
    });

    it('the friendly-fire confirm lane shares the same stamped payload', () => {
        const { handlers } = makeHandlers({ controller: 'Bob' });

        handlers.confirmFriendlyFireTarget('Zombie', 'Alice');

        expect(patchedRecord().seenController).toBe('Bob');
        expect(patchedRecord().targetName).toBe('Alice');
    });

    it('unknown creature stays fully inert (no record to stamp)', () => {
        const { handlers } = makeHandlers({ controller: 'Bob' });

        handlers.handleTargetChange('Ghost', 'Alice');

        expect(setTarget).toHaveBeenCalled(); // service stays inert for unknown names itself
        expect(storage.patch).not.toHaveBeenCalled();
    });
});
