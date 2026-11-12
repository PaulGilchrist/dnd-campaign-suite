// @maintained-by-ai
// Lane: createCreatureHandlers.js control delegation (Phase 2).
// Owned here: the assign/release write to the combatSummary row, the campaign-log
// audit entry (repo "every automation must log"), the GM-only guard, the player-row
// refusal, and the unknown-name validation refusal. Controller RESOLUTION
// precedence is creatureControl.test.js; card gating is CreatureCard.control.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import storage from '../../services/ui/storage.js';
import { addEntry } from '../../services/ui/logService.js';

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

function makeHandlers(overrides = {}) {
    const combatSummary = {
        round: 1,
        creatures: [
            { name: 'Alice', type: 'player', currentHp: 20 },
            { name: 'Bob', type: 'player', currentHp: 15 },
            { name: 'Zombie', type: 'npc', currentHp: 10 },
            { name: 'Fairy', type: 'npc', currentHp: 5, summonedBy: 'Alice' },
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
        numOfNpc: 2,
        isLocalhost: true,
        showToast: vi.fn(),
        ...overrides,
    });
    return { handlers, combatSummary, setCombatSummary };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('handleControllerChange', () => {
    it('GM assigns an NPC to a player: row stamped, board persisted, audit logged', () => {
        const { handlers, combatSummary, setCombatSummary } = makeHandlers();

        handlers.handleControllerChange('Zombie', 'Bob');

        const zombie = combatSummary.creatures.find(c => c.name === 'Zombie');
        expect(zombie.controller).toBe('Bob');
        expect(storage.set).toHaveBeenCalledWith('combatSummary', combatSummary, campaignName);
        expect(setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({
            creatures: expect.arrayContaining([expect.objectContaining({ name: 'Zombie', controller: 'Bob' })]),
        }));
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'automation',
            characterName: 'Zombie',
            automationType: 'control_assigned',
            description: 'Zombie handed to Bob — their device can run its card (roll, target, saves) until released.',
        }));
    });

    it('release drops the stamp and names the derived fallback (summon stays with its caster)', () => {
        const { handlers, combatSummary } = makeHandlers();
        handlers.handleControllerChange('Fairy', 'Bob');
        expect(combatSummary.creatures.find(c => c.name === 'Fairy').controller).toBe('Bob');

        handlers.handleControllerChange('Fairy', null);

        const fairy = combatSummary.creatures.find(c => c.name === 'Fairy');
        expect(fairy.controller).toBeUndefined();
        expect(addEntry).toHaveBeenLastCalledWith(campaignName, expect.objectContaining({
            automationType: 'control_released',
            description: 'Fairy returned to the GM (auto-controlled by Alice).',
        }));
    });

    // Owner law (2026-11-11): release clears the armed target on the SAME write —
    // a re-delegation or the GM never inherits a stale ally-targeted arm.
    it('release clears the armed targetName alongside the controller stamp (one write)', () => {
        const { handlers, combatSummary, setCombatSummary } = makeHandlers();
        handlers.handleControllerChange('Zombie', 'Bob');
        combatSummary.creatures.find(c => c.name === 'Zombie').targetName = 'Alice';

        handlers.handleControllerChange('Zombie', null);

        const zombie = combatSummary.creatures.find(c => c.name === 'Zombie');
        expect(zombie.controller).toBeUndefined();
        expect(zombie.targetName).toBeUndefined();
        // Both halves land on the single persisted + echoed board.
        expect(storage.set).toHaveBeenLastCalledWith('combatSummary', combatSummary, campaignName);
        expect(setCombatSummary).toHaveBeenLastCalledWith(expect.objectContaining({
            creatures: expect.arrayContaining([
                expect.not.objectContaining({ name: 'Zombie', targetName: 'Alice' }),
            ]),
        }));
        const released = setCombatSummary.mock.calls.at(-1)[0].creatures.find(c => c.name === 'Zombie');
        expect(released.targetName).toBeUndefined();
    });

    it('assign keeps an already-armed targetName untouched', () => {
        const { handlers, combatSummary } = makeHandlers();
        combatSummary.creatures.find(c => c.name === 'Zombie').targetName = 'Fairy';

        handlers.handleControllerChange('Zombie', 'Bob');

        const zombie = combatSummary.creatures.find(c => c.name === 'Zombie');
        expect(zombie.controller).toBe('Bob');
        expect(zombie.targetName).toBe('Fairy');
    });

    // Owner law (2026-11-11, MB-2 ruling extending the release law): a DIRECT
    // controller→controller swap never inherits the previous controller's armed
    // target — targetName is deleted on the SAME full-board write that stamps B,
    // and the handoff logs its own audit row (never audit-silent).
    it('direct A→B swap clears the armed targetName on the same write and audits the handoff', () => {
        const { handlers, combatSummary, setCombatSummary } = makeHandlers();
        handlers.handleControllerChange('Zombie', 'Alice');
        combatSummary.creatures.find(c => c.name === 'Zombie').targetName = 'Fairy';

        handlers.handleControllerChange('Zombie', 'Bob');

        const zombie = combatSummary.creatures.find(c => c.name === 'Zombie');
        expect(zombie.controller).toBe('Bob');
        expect('targetName' in zombie).toBe(false);
        // Both halves land on the single persisted + echoed board (one SSE write).
        expect(storage.set).toHaveBeenLastCalledWith('combatSummary', combatSummary, campaignName);
        const swapped = setCombatSummary.mock.calls.at(-1)[0].creatures.find(c => c.name === 'Zombie');
        expect(swapped.controller).toBe('Bob');
        expect('targetName' in swapped).toBe(false);
        // Audit: the usual control_assigned row PLUS a swap-clear row.
        expect(addEntry).toHaveBeenCalledTimes(3);
        expect(addEntry).toHaveBeenNthCalledWith(2, campaignName, expect.objectContaining({
            automationType: 'control_assigned',
            characterName: 'Zombie',
        }));
        expect(addEntry).toHaveBeenNthCalledWith(3, campaignName, expect.objectContaining({
            type: 'automation',
            characterName: 'Zombie',
            automationType: 'control_arm_cleared',
            description: 'Zombie handed directly from Alice to Bob — armed target Fairy cleared on the handoff (the new controller starts unarmed).',
        }));
    });

    it('first-time assign (no prior controller) keeps the arm and logs no swap-clear row', () => {
        const { handlers, combatSummary } = makeHandlers();
        combatSummary.creatures.find(c => c.name === 'Zombie').targetName = 'Fairy';

        handlers.handleControllerChange('Zombie', 'Bob');

        const zombie = combatSummary.creatures.find(c => c.name === 'Zombie');
        expect(zombie.controller).toBe('Bob');
        expect(zombie.targetName).toBe('Fairy');
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry.mock.calls.every(([, e]) => e.automationType !== 'control_arm_cleared')).toBe(true);
    });

    it('same-controller re-stamp is not a swap — the arm survives, no clear row', () => {
        const { handlers, combatSummary } = makeHandlers();
        handlers.handleControllerChange('Zombie', 'Bob');
        combatSummary.creatures.find(c => c.name === 'Zombie').targetName = 'Fairy';

        handlers.handleControllerChange('Zombie', 'Bob');

        const zombie = combatSummary.creatures.find(c => c.name === 'Zombie');
        expect(zombie.controller).toBe('Bob');
        expect(zombie.targetName).toBe('Fairy');
        expect(addEntry).toHaveBeenCalledTimes(2);
        expect(addEntry.mock.calls.every(([, e]) => e.automationType !== 'control_arm_cleared')).toBe(true);
    });

    it('unknown controller name is refused with a console.error and zero writes', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { handlers, combatSummary, setCombatSummary } = makeHandlers();

        handlers.handleControllerChange('Zombie', 'Nobody');

        expect(combatSummary.creatures.find(c => c.name === 'Zombie').controller).toBeUndefined();
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('not a player on the tracker'));
        spy.mockRestore();
    });

    it('player rows never take a controller stamp', () => {
        const { handlers, combatSummary } = makeHandlers();

        handlers.handleControllerChange('Alice', 'Bob');

        expect(combatSummary.creatures.find(c => c.name === 'Alice').controller).toBeUndefined();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('LAN clients are refused at the handler seam (authorship stays GM-only)', () => {
        const { handlers, combatSummary, setCombatSummary } = makeHandlers({ isLocalhost: false });

        handlers.handleControllerChange('Zombie', 'Alice');

        expect(combatSummary.creatures.find(c => c.name === 'Zombie').controller).toBeUndefined();
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
    });

    it('no combat summary → inert', () => {
        const handlers = createCreatureHandlers({
            combatSummary: null, campaignName, campaignNpcs: [], setNpcImages: vi.fn(),
            overlays: [], setCombatSummary: vi.fn(), setActiveCreatureName: vi.fn(),
            characters: [], numOfNpc: 0, isLocalhost: true, showToast: vi.fn(),
        });
        expect(() => handlers.handleControllerChange('Zombie', 'Alice')).not.toThrow();
        expect(addEntry).not.toHaveBeenCalled();
    });
});
