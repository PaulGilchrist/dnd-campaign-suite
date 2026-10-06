// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import { breakHypnoticPatternOnDamage } from '../../services/rules/features/hypnoticPatternService.js';

vi.mock('../../services/rules/features/hypnoticPatternService.js', () => ({
    breakHypnoticPatternOnDamage: vi.fn(() => true),
}));

vi.mock('../../services/ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => 82),
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
    const handlers = createCreatureHandlers({
        combatSummary,
        campaignName,
        campaignNpcs: [],
        setNpcImages: vi.fn(),
        overlays: [],
        setCombatSummary: vi.fn(),
        setActiveCreatureName: vi.fn(),
        characters: [],
        numOfNpc: 0,
        _isLocalhost: true,
    });
    return { handlers, combatSummary };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('handleCreatureHpChange — SP-069 hypno damage-break', () => {
    it('breaks Hypnotic Pattern when a GM HP-input reduction damages an NPC', () => {
        const { handlers, combatSummary } = makeHandlers([
            { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11 },
        ]);

        handlers.handleCreatureHpChange('Bandit 1', 5);

        expect(breakHypnoticPatternOnDamage).toHaveBeenCalledWith('Bandit 1', campaignName);
        expect(combatSummary.creatures[0].currentHp).toBe(5);
    });

    it('breaks Hypnotic Pattern when a player loses HP via HP input', () => {
        const { handlers } = makeHandlers([
            { name: 'DivinationWizard', type: 'player', currentHp: 82, maxHp: 82 },
        ]);

        handlers.handleCreatureHpChange('DivinationWizard', 70);

        expect(breakHypnoticPatternOnDamage).toHaveBeenCalledWith('DivinationWizard', campaignName);
    });

    it('does NOT fire the break on HP increases (heal/revive)', () => {
        const { handlers } = makeHandlers([
            { name: 'Bandit 1', type: 'npc', currentHp: 5, maxHp: 11 },
        ]);

        handlers.handleCreatureHpChange('Bandit 1', 11);

        expect(breakHypnoticPatternOnDamage).not.toHaveBeenCalled();
    });

    it('does NOT fire the break on a no-op HP set', () => {
        const { handlers } = makeHandlers([
            { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11 },
        ]);

        handlers.handleCreatureHpChange('Bandit 1', 11);

        expect(breakHypnoticPatternOnDamage).not.toHaveBeenCalled();
    });
});
