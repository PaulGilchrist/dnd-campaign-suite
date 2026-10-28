// @maintained-by-ai
// SP-069 unit lane: handleCreatureHpChange → breakHypnoticPatternOnDamage wiring only.
// A GM HP-input reduction is adjudicated damage (source: createCreatureHandlers.js `if (delta < 0)`);
// this table pins each distinct branch once: npc-card lane fires, player-runtime lane fires
// (oldHp read via getRuntimeValue, not the card), heal does not, delta-0 guard returns before any write.
// Other SP-069 lanes (do NOT duplicate here):
//   - services/rules/features/hypnoticPatternService.test.js — service break internals (store state)
//   - services/rules/combat/applyDamage.hypnotic-break.test.js — pipeline damage wake
//   - createCreatureHandlers.test.jsx — base HP store writes, death-save resets, NPC remove/name/target (no hypno asserts)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import { breakHypnoticPatternOnDamage } from '../../services/rules/features/hypnoticPatternService.js';
import storage from '../../services/ui/storage.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/rules/features/hypnoticPatternService.js', () => ({
    breakHypnoticPatternOnDamage: vi.fn(() => true),
}));

vi.mock('../../services/ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(),
}));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    clearCombat: vi.fn(),
    setInitiative: vi.fn(),
    renameNpc: vi.fn(),
    setTarget: vi.fn(),
    removeNpc: vi.fn(),
    addNpc: vi.fn(),
}));
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    maybeGrantThiefsReflexesSecondTurn: vi.fn(),
}));
vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({
    vanishSummonAtZeroHp: vi.fn(),
}));

const campaignName = 'test-campaign';

function makeHandlers(creatures) {
    const combatSummary = { round: 1, creatures };
    const setCombatSummary = vi.fn();
    const handlers = createCreatureHandlers({
        combatSummary,
        campaignName,
        campaignNpcs: [],
        setNpcImages: vi.fn(),
        overlays: [],
        setCombatSummary,
        setActiveCreatureName: vi.fn(),
        characters: [],
        numOfNpc: 0,
        isLocalhost: true,
    });
    return { handlers, combatSummary, setCombatSummary };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('handleCreatureHpChange — SP-069 hypno damage-break', () => {
    it('max-HP edit clamping current down (#854 third arg) is NOT adjudicated damage', () => {
        const { handlers, combatSummary, setCombatSummary } = makeHandlers([
            { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 20 },
        ]);

        handlers.handleCreatureHpChange('Bandit 1', 7, 7); // max lowered to 7, current clamped to it

        expect(breakHypnoticPatternOnDamage).not.toHaveBeenCalled();
        expect(combatSummary.creatures[0].currentHp).toBe(7);
        expect(combatSummary.creatures[0].maxHp).toBe(7);
        expect(storage.set).toHaveBeenCalledTimes(1);
        expect(setCombatSummary).toHaveBeenCalledTimes(1);
    });

    it.each([
        { desc: 'GM HP-input reduction damages an NPC', name: 'Bandit 1', type: 'npc', oldHp: 11, newHp: 5, breaks: true },
        { desc: 'player HP reduction (old HP read from runtime store)', name: 'DivinationWizard', type: 'player', oldHp: 82, newHp: 70, breaks: true },
        { desc: 'heal / revive via HP increase', name: 'Bandit 1', type: 'npc', oldHp: 5, newHp: 11, breaks: false },
        { desc: 'no-op HP set hits the delta-0 guard', name: 'Bandit 1', type: 'npc', oldHp: 11, newHp: 11, breaks: false },
    ])('$desc ⇒ hypno break: $breaks', ({ name, type, oldHp, newHp, breaks }) => {
        // prop-aware so the player lane provably reads currentHitPoints for its oldHp
        getRuntimeValue.mockImplementation((creatureKey, prop) => (prop === 'currentHitPoints' ? oldHp : null));
        const { handlers, combatSummary, setCombatSummary } = makeHandlers([
            { name, type, currentHp: oldHp },
        ]);

        handlers.handleCreatureHpChange(name, newHp);

        if (breaks) {
            expect(breakHypnoticPatternOnDamage).toHaveBeenCalledTimes(1);
            expect(breakHypnoticPatternOnDamage).toHaveBeenCalledWith(name, campaignName);
        }
        else {
            expect(breakHypnoticPatternOnDamage).not.toHaveBeenCalled();
        }

        // paired state write observable per lane
        if (type === 'npc') {
            expect(combatSummary.creatures[0].currentHp).toBe(newHp);
        }
        else {
            expect(setRuntimeValue).toHaveBeenCalledWith(name, 'currentHitPoints', newHp, campaignName);
        }

        if (newHp === oldHp) {
            // delta-0 guard returns before any persistence at all
            expect(storage.set).not.toHaveBeenCalled();
            expect(setCombatSummary).not.toHaveBeenCalled();
        }
    });
});
