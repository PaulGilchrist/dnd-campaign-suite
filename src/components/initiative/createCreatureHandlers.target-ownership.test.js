// @maintained-by-ai 2026-11-23
// Lane: createCreatureHandlers.js PC-row target ownership gate + arming audit
// (bug-visitor-arms-any-pc-target-cross-player-write). A LAN (non-localhost)
// tab may arm a target ONLY on the row its device plays — the sidebar
// selection threaded as localCharacterName (Players.jsx isTokenOwnedHere
// precedent, LAN-trust model D2: no accounts). Foreign PC rows refuse at both
// the routing seam (handleTargetChange, before any friendly-fire prompt) and
// the write seam (applyTargetSelection), with zero board writes and zero
// audit. Monster rows are UNTOUCHED: a delegated row stays LAN-trusted for
// any device. Every armed-target transition that lands writes exactly one
// "Target Selection" audit row (the friendly-fire lane keeps its own
// friendlyFire-flagged row and never double-logs).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import storage from '../../services/ui/storage.js';
import { setTarget } from '../../services/encounters/initiativeService.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    getRuntimeKeysByPrefix: vi.fn(() => []),
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
            { name: 'Zombie', type: 'npc', currentHp: 10, controller: 'Bob' },
        ],
    };
    const setCombatSummary = vi.fn();
    const handlers = createCreatureHandlers({
        combatSummary,
        campaignName,
        campaignNpcs: [],
        setNpcImages: vi.fn(),
        overlays: [{ id: 'abc' }],
        setCombatSummary,
        setActiveCreatureName: vi.fn(),
        characters: [{ name: 'Alice' }, { name: 'Bob' }],
        isLocalhost: true,
        localCharacterName: null,
        showToast: vi.fn(),
        requestFriendlyFireConfirm: vi.fn(),
        ...overrides,
    });
    return { handlers, combatSummary, setCombatSummary };
}

let errorSpy;
beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
});

const auditCalls = () => addEntry.mock.calls.filter(c => c[1]?.abilityName === 'Target Selection');

describe('visitor PC-row ownership gate (bug-visitor-arms-any-pc-target-cross-player-write)', () => {
    it('visitor arming ANOTHER player\'s row: refused — zero setTarget, zero board write, zero audit, named console.error', () => {
        const { handlers, setCombatSummary } = makeHandlers({ isLocalhost: false, localCharacterName: 'Bob' });

        handlers.handleTargetChange('Alice', 'Zombie');

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('not the character played on this device'));
        expect(setTarget).not.toHaveBeenCalled();
        expect(storage.patch).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
    });

    it('visitor with NO sidebar selection cannot arm any PC row', () => {
        const { handlers } = makeHandlers({ isLocalhost: false, localCharacterName: null });

        handlers.handleTargetChange('Alice', 'Zombie');
        handlers.handleTargetChange('Bob', 'Zombie');

        expect(setTarget).not.toHaveBeenCalled();
        expect(storage.patch).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('visitor refuses BEFORE friendly-fire routing — a foreign ally row never arms the confirm prompt', () => {
        getRuntimeValue.mockImplementation((name, key) =>
            (name === 'Alice' && key === 'selectedAllies') ? ['Bob'] : null);
        const { handlers } = makeHandlers({ isLocalhost: false, localCharacterName: 'Bob' });

        handlers.handleTargetChange('Alice', 'Bob');

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('not the character played on this device'));
        expect(setTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('write-seam belt: confirmFriendlyFireTarget on a foreign PC row never reaches the board (GM-side fixture mirrors via applyTargetSelection refusal)', () => {
        // Visitor tab: applyTargetSelection is the shared write tail — the gate
        // refuses the write even if a caller skips handleTargetChange.
        const { handlers } = makeHandlers({ isLocalhost: false, localCharacterName: 'Bob' });

        handlers.confirmFriendlyFireTarget('Alice', 'Bob');

        expect(setTarget).not.toHaveBeenCalled();
        expect(storage.patch).not.toHaveBeenCalled();
        // The dedicated FF row still logged pre-gate (unreachable UI path: the
        // confirm modal never opens for a foreign row) — the generic row is absent.
        expect(auditCalls().filter(c => c[1]?.friendlyFire)).toHaveLength(1);
    });

    it('visitor arming its OWN character row lands: scoped PATCH + exactly one generic Target Selection audit row', () => {
        const { handlers, combatSummary } = makeHandlers({ isLocalhost: false, localCharacterName: 'Bob' });

        handlers.handleTargetChange('Bob', 'Zombie');

        expect(setTarget).toHaveBeenCalledWith(combatSummary, 'Bob', 'Zombie');
        expect(storage.patch).toHaveBeenCalledWith('combatSummary', { creatures: [{ name: 'Bob', targetName: 'Zombie' }] }, campaignName);
        const rows = auditCalls();
        expect(rows).toHaveLength(1);
        expect(rows[0][1]).toMatchObject({
            type: 'ability_use',
            characterName: 'Bob',
            abilityName: 'Target Selection',
            description: 'Bob armed Zombie as a target.',
        });
        expect(rows[0][1].friendlyFire).toBeUndefined();
    });

    it('visitor arming a delegated MONSTER row stays LAN-trusted (D2 law untouched)', () => {
        const { handlers, combatSummary } = makeHandlers({ isLocalhost: false, localCharacterName: null });

        handlers.handleTargetChange('Zombie', 'Alice');

        expect(setTarget).toHaveBeenCalledWith(combatSummary, 'Zombie', 'Alice');
        expect(storage.patch).toHaveBeenCalled();
    });

    it('GM arming any PC row works and writes its audit row (visibility + audit pattern)', () => {
        const { handlers } = makeHandlers({ isLocalhost: true });

        handlers.handleTargetChange('Alice', 'Zombie');

        expect(setTarget).toHaveBeenCalled();
        const rows = auditCalls();
        expect(rows).toHaveLength(1);
        expect(rows[0][1].description).toBe('Alice armed Zombie as a target.');
    });

    it('clearing an armed target logs the clear transition (audit covers every armed-target transition)', () => {
        const { handlers, combatSummary } = makeHandlers({ isLocalhost: true });
        combatSummary.creatures[0].targetName = 'Zombie';

        handlers.handleTargetChange('Alice', '');

        expect(storage.patch).toHaveBeenCalledWith('combatSummary', { creatures: [{ name: 'Alice', targetName: null }] }, campaignName);
        const rows = auditCalls();
        expect(rows).toHaveLength(1);
        expect(rows[0][1].description).toBe('Alice cleared their armed target (was Zombie).');
    });

    it('no-op lane (same value re-applied at the write seam) writes no audit row', () => {
        // Select onChange cannot fire for an unchanged value, but a programmatic
        // re-apply through the seam must stay silent (no transition happened).
        const { handlers, combatSummary } = makeHandlers({ isLocalhost: true });
        combatSummary.creatures[0].targetName = 'Zombie';

        handlers.handleTargetChange('Alice', 'Zombie');

        expect(setTarget).toHaveBeenCalled();
        expect(auditCalls()).toHaveLength(0);
    });

    it('overlay (AoE) arming rides its spell flow — no Target Selection row here', () => {
        const { handlers } = makeHandlers({ isLocalhost: true });

        handlers.handleTargetChange('Alice', 'overlay-abc');

        expect(setTarget).toHaveBeenCalled();
        expect(storage.patch).toHaveBeenCalled();
        expect(auditCalls()).toHaveLength(0);
    });

    it('friendly-fire lane stays EXACTLY ONE audit row — the generic row is suppressed on the FF-confirmed arm', () => {
        getRuntimeValue.mockImplementation((name, key) =>
            (name === 'Alice' && key === 'selectedAllies') ? ['Bob'] : null);
        const { handlers } = makeHandlers({ isLocalhost: true });

        handlers.handleTargetChange('Alice', 'Bob'); // routes to the confirm bridge
        handlers.confirmFriendlyFireTarget('Alice', 'Bob');

        const rows = auditCalls();
        expect(rows).toHaveLength(1);
        expect(rows[0][1]).toMatchObject({ friendlyFire: true, abilityName: 'Target Selection' });
    });

    it('unknown creature rows stay inert (legacy no-write, no-audit lane)', () => {
        const { handlers } = makeHandlers({ isLocalhost: true });

        handlers.handleTargetChange('Nobody', 'Zombie');

        expect(storage.patch).not.toHaveBeenCalled();
        expect(auditCalls()).toHaveLength(0);
    });
});
