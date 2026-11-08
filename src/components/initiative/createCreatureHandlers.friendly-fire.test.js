// @maintained-by-ai
// Lane: createCreatureHandlers.js friendly-fire confirm (Phase 3.2 betrayal,
// arena-starter §4; migrated off native window.confirm 2026-11-04 CQ). Arming
// a target from the attacker's OWN ally list routes the pending pair to the
// host-injected requestFriendlyFireConfirm overlay bridge — ZERO native
// dialogs on this lane. Nothing writes until the host resumes via
// confirmFriendlyFireTarget (accept = arm + audit row, byte-identical to the
// retired native lane; cancel = the host simply never calls it ⇒ inert).
// Unlisted (hostile) targets, self-targets, overlay targets and unedited ally
// lists never prompt — engine resolution is unchanged either way.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
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

function makeHandlers(overrides = {}) {
    const combatSummary = {
        round: 1,
        creatures: [
            { name: 'Alice', type: 'player', currentHp: 20 },
            { name: 'Bob', type: 'player', currentHp: 15 },
            { name: 'Zombie', type: 'npc', currentHp: 10 },
        ],
    };
    const setCombatSummary = vi.fn();
    const requestFriendlyFireConfirm = vi.fn();
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
        requestFriendlyFireConfirm,
        ...overrides,
    });
    return { handlers, combatSummary, setCombatSummary, requestFriendlyFireConfirm };
}

let confirmSpy;
let errorSpy;
beforeEach(() => {
    vi.clearAllMocks();
    // The migrated lane must never touch a native dialog (criterion 1).
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
});

function seedAllies(list) {
    getRuntimeValue.mockImplementation((name, key) =>
        (name === 'Alice' && key === 'selectedAllies') ? list : null);
}

describe('confirmClear (post-modal-accept body)', () => {
    it('zero-character roster clears without crashing (Arena/Starter quick play)', async () => {
        const { handlers, setCombatSummary } = makeHandlers()
        // Simulate the join→clear flow in a fresh arena/starter campaign: the
        // clear's newSummary (players-only skeleton) is EMPTY with 0 characters.
        // 2026-11-08 EK: the confirmed body moved to confirmClear (handleClear
        // now only arms the host's role=dialog prompt).
        const initiativeService = await import('../../services/encounters/initiativeService.js')
        initiativeService.clearCombat.mockReturnValue({ round: 1, creatures: [] })
        expect(() => handlers.confirmClear()).not.toThrow()
        expect(setCombatSummary).toHaveBeenCalledWith({ round: 1, creatures: [] })
    })
})

describe('handleTargetChange — friendly-fire overlay bridge', () => {
    it('ally target: routed to the overlay with the pending pair; NO native confirm; zero writes until resumed', () => {
        seedAllies(['Alice', 'Bob']);
        const { handlers, requestFriendlyFireConfirm, setCombatSummary } = makeHandlers();

        handlers.handleTargetChange('Alice', 'Bob');

        expect(requestFriendlyFireConfirm).toHaveBeenCalledWith({ creatureName: 'Alice', targetName: 'Bob' });
        expect(confirmSpy).not.toHaveBeenCalled();
        // Fully inert pre-decision: no arm, no log, no board write.
        expect(setTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(storage.patch).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
    });

    it('accept lane (confirmFriendlyFireTarget): arms AND logs exactly one audit-flagged row with the byte-exact copy', () => {
        seedAllies(['Alice', 'Bob']);
        const { handlers, combatSummary, setCombatSummary } = makeHandlers();

        handlers.handleTargetChange('Alice', 'Bob');
        handlers.confirmFriendlyFireTarget('Alice', 'Bob');

        expect(setTarget).toHaveBeenCalledWith(combatSummary, 'Alice', 'Bob');
        // Scoped arming write (backlog 2026-11-04 CR): the confirmed lane
        // ships only the armed creature's targetName, never the full board.
        expect(storage.patch).toHaveBeenCalledWith('combatSummary', { creatures: [{ name: 'Alice', targetName: 'Bob' }] }, campaignName);
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummary).toHaveBeenCalledTimes(1);
        const friendlyCalls = addEntry.mock.calls.filter(c => c[1]?.friendlyFire);
        expect(friendlyCalls).toHaveLength(1);
        expect(friendlyCalls[0][1]).toMatchObject({
            type: 'ability_use',
            characterName: 'Alice',
            abilityName: 'Target Selection',
            friendlyFire: true,
            description: 'Alice armed Bob as a target — Bob is on Alice\'s ally list (friendly fire confirmed).',
        });
    });

    it('cancel lane: the host never resumes — zero arms, zero logs, zero board writes', () => {
        seedAllies(['Alice', 'Bob']);
        const { handlers, setCombatSummary } = makeHandlers();

        handlers.handleTargetChange('Alice', 'Bob');
        // Cancel = the overlay closes without invoking confirmFriendlyFireTarget.

        expect(setTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(storage.patch).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
    });

    it('fail closed: without a wired confirm host the ally target is NOT armed (named console.error, no native dialog)', () => {
        seedAllies(['Alice', 'Bob']);
        const { handlers, setCombatSummary } = makeHandlers({ requestFriendlyFireConfirm: undefined });

        handlers.handleTargetChange('Alice', 'Bob');

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('friendly-fire confirm host not wired'));
        expect(setTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(storage.patch).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
    });

    it('non-ally target arms silently — zero prompt, zero confirm log', () => {
        seedAllies(['Alice', 'Bob']);
        const { handlers, requestFriendlyFireConfirm } = makeHandlers();

        handlers.handleTargetChange('Alice', 'Zombie');

        expect(requestFriendlyFireConfirm).not.toHaveBeenCalled();
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(setTarget).toHaveBeenCalledWith(expect.anything(), 'Alice', 'Zombie');
    });

    it('self-target arms silently (exempt face)', () => {
        seedAllies(['Alice', 'Bob']);
        const { handlers, requestFriendlyFireConfirm } = makeHandlers();

        handlers.handleTargetChange('Alice', 'Alice');

        expect(requestFriendlyFireConfirm).not.toHaveBeenCalled();
        expect(setTarget).toHaveBeenCalledWith(expect.anything(), 'Alice', 'Alice');
    });

    it('unedited ally list (default self-only) never prompts; legacy PvP arms straight through', () => {
        getRuntimeValue.mockReturnValue(null);
        const { handlers, requestFriendlyFireConfirm } = makeHandlers();

        handlers.handleTargetChange('Alice', 'Bob');

        expect(requestFriendlyFireConfirm).not.toHaveBeenCalled();
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(setTarget).toHaveBeenCalledWith(expect.anything(), 'Alice', 'Bob');
    });

    it('overlay (AoE) arming bypasses the confirm lane', () => {
        seedAllies(['Alice', 'Bob']);
        const { handlers, requestFriendlyFireConfirm } = makeHandlers();

        handlers.handleTargetChange('Alice', 'overlay-abc');

        expect(requestFriendlyFireConfirm).not.toHaveBeenCalled();
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(setTarget).not.toHaveBeenCalled(); // unknown overlay id → no arm (existing behavior)
    });
});
