// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { vi } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn((_expr) => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((_expr) => 5),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, newHp: 15, oldHp: 20, damageReduced: false })),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => ({ actualHeal: 12, oldHp: 10, newHp: 22 })),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(async () => ({
        attackEvent: { rollType: 'attack', attackerName: 'TestHero', hit: true },
        attackerName: 'TestHero',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['slashing'],
    })),
}));

beforeEach(() => { vi.resetAllMocks(); });
import { describe, it, expect } from 'vitest';
import {
    handle,
    confirmGiantAncestry,
    handleDirectType,
} from './giantAncestryHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { makeAction, makePlayerStats } from './giantAncestry.test.setup.js';
describe('giantAncestry selection & dispatch', () => {
    describe('handle', () => {
        it('shows selection modal when no ancestry is selected', async () => {
            getRuntimeValue.mockReturnValue(null);
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('giantAncestry');
            expect(result.payload.action).toBeInstanceOf(Object);
        });

        it('dispatches to the correct sub-handler based on stored selection', async () => {
            getRuntimeValue.mockReturnValue("Cloud's Jaunt");
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Cloud's Jaunt");
        });

        it('returns info popup when stored selection is unknown', async () => {
            getRuntimeValue.mockReturnValue("Unknown Ancestry");
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Unknown Ancestry");
        });
    });
    describe('confirmGiantAncestry', () => {
        it('stores the selected ancestry and returns confirmation', async () => {
            const result = await confirmGiantAncestry(makePlayerStats(), "Fire's Burn", 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Fire's Burn");
            expect(result.payload.description).toContain('Recharges');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', 'giantAncestrySelection', "Fire's Burn", 'campaign'
            );
        });

        it('returns error when no option is selected', async () => {
            const result = await confirmGiantAncestry(makePlayerStats(), 'Nonexistent Option', 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No option selected.');
        });
    });
    describe('getGiantAncestryOptions', () => {
        it('returns all 6 giant ancestry options with expected names', async () => {
            const { getGiantAncestryOptions } = await import('./giantAncestryHandler.js');
            const options = getGiantAncestryOptions();
            expect(options).toHaveLength(6);
            const names = options.map(o => o.name);
            expect(names).toContain("Cloud's Jaunt");
            expect(names).toContain("Fire's Burn");
            expect(names).toContain("Frost's Chill");
            expect(names).toContain("Hill's Tumble");
            expect(names).toContain("Stone's Endurance");
            expect(names).toContain("Storm's Thunder");
            options.forEach(opt => {
                expect(opt.type).toBeDefined();
                expect(opt.icon).toBeDefined();
                expect(opt.description).toBeDefined();
            });
        });
    });
    describe('handleDirectType', () => {
        it('shows modal when no selection', async () => {
            getRuntimeValue.mockReturnValue(null);
            const result = await handleDirectType(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('giantAncestry');
        });

        it('dispatches to matching direct type', async () => {
            getRuntimeValue.mockReturnValue("Fire's Burn");
            const result = await handleDirectType(
                makeAction({ automation: { type: 'damage' } }),
                makePlayerStats(),
                'campaign',
                'map'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.name).toBe("Fire's Burn");
        });

        it('returns info popup when direct type does not match selection', async () => {
            getRuntimeValue.mockReturnValue("Cloud's Jaunt");
            const result = await handleDirectType(
                makeAction({ automation: { type: 'damage' } }),
                makePlayerStats(),
                'campaign',
                'map'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Cloud's Jaunt");
            expect(result.payload.description).toContain('damage');
        });
    });
    describe('getGiantAncestrySelection', () => {
        it('returns the stored selection for the player', async () => {
            getRuntimeValue.mockReturnValue("Fire's Burn");
            const { getGiantAncestrySelection } = await import('./giantAncestryHandler.js');
            const result = getGiantAncestrySelection(makePlayerStats(), 'campaign');

            expect(result).toBe("Fire's Burn");
            expect(getRuntimeValue).toHaveBeenCalledWith('TestHero', 'giantAncestrySelection', 'campaign');
        });

        it('returns null when no selection is stored', async () => {
            getRuntimeValue.mockReturnValue(null);
            const { getGiantAncestrySelection } = await import('./giantAncestryHandler.js');
            const result = getGiantAncestrySelection(makePlayerStats(), 'campaign');

            expect(result).toBeNull();
        });
    });
    describe('handleDirectType unknown option', () => {
        it('returns info popup when stored selection is unknown', async () => {
            getRuntimeValue.mockReturnValue("Unknown Ancestry");
            const result = await handleDirectType(
                makeAction({ automation: { type: 'damage' } }),
                makePlayerStats(),
                'campaign',
                'map'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Unknown Ancestry");
        });
    });

    describe('handleDirectType type mismatch', () => {
        it('returns info popup when direct type does not match selection type', async () => {
            getRuntimeValue.mockReturnValue("Cloud's Jaunt");
            const result = await handleDirectType(
                makeAction({ automation: { type: 'damage' } }),
                makePlayerStats(),
                'campaign',
                'map'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Cloud's Jaunt");
            expect(result.payload.description).toContain('damage');
        });
    });

    describe('handle', () => {
        it('dispatches to handleFiresBurn when stored selection is Fire', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'giantAncestrySelection') return "Fire's Burn";
                if (key === 'firesBurnUses') return 3;
                return null;
            });
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.name).toBe("Fire's Burn");
        });

        it('dispatches to handleFrostsChill when stored selection is Frost', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'giantAncestrySelection') return "Frost's Chill";
                if (key === 'frostsChillUses') return 3;
                if (key === 'targetEffects') return [];
                return null;
            });
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.name).toBe("Frost's Chill");
        });

        it('dispatches to handleHillsTumble when stored selection is Hill', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'giantAncestrySelection') return "Hill's Tumble";
                if (key === 'hillsTumbleUses') return 3;
                if (key === 'activeConditions') return [];
                return null;
            });
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Hill's Tumble");
        });

        it('dispatches to handleStonesEndurance when stored selection is Stone', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'giantAncestrySelection') return "Stone's Endurance";
                if (key === 'stonesEnduranceUses') return 3;
                return null;
            });
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', attackerName: 'Orc' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 15,
            });
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Stone's Endurance");
        });

        it('dispatches to handleStormsThunder when stored selection is Storm', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'giantAncestrySelection') return "Storm's Thunder";
                if (key === 'stormsThunderUses') return 3;
                return null;
            });
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', attackerName: 'Orc' },
                attackerName: 'Orc',
                targetName: 'TestHero',
                totalDamage: 10,
            });
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
        });
    });
    describe('handleDirectType default case', () => {
        it('returns info popup with unknown option type in switch', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'giantAncestrySelection') return "Stone's Endurance";
                return null;
            });

            const result = await handleDirectType(
                makeAction({ automation: { type: 'unknown_type' } }),
                makePlayerStats(),
                'campaign',
                'map'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Stone's Endurance");
            expect(result.payload.description).toContain('unknown');
        });
    });
});
