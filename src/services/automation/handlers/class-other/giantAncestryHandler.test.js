import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    handle,
    confirmGiantAncestry,
    handleDirectType,
    handleCloudsJaunt,
    handleFiresBurn,
    handleFrostsChill,
    handleHillsTumble,
    handleStonesEndurance,
    handleStormsThunder,
} from './giantAncestryHandler.js';

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

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(async () => ({ target: { name: 'Goblin' } })),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((_expr) => 5),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

function makeAction(overrides = {}) {
    return {
        name: 'Giant Ancestry',
        description: 'Choose a giant ancestry benefit.',
        automation: {
            type: 'resource_pool',
            options: [],
            recharge: 'short_rest',
            casting_time: '1 action',
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [{ name: 'Constitution', bonus: 2 }],
        ...overrides,
    };
}

describe('giantAncestryHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
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
            expect(result.payload.description).toContain("Fire's Burn");
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

    // Helper for sub-handler tests that share the "no uses remaining" pattern
    function makeUsesMock(usesKey, value) {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === usesKey) return value;
            return null;
        });
    }

    describe('handleCloudsJaunt', () => {
        const option = { name: "Cloud's Jaunt", type: 'teleport', range: '30_ft' };

        it('returns modal for teleport with uses available', async () => {
            makeUsesMock("cloud'sjauntUses", 3);
            const result = await handleCloudsJaunt(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
            expect(result.payload.action.name).toBe("Cloud's Jaunt");
            expect(result.payload.action.automation.distance).toBe('30 ft');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock("cloud'sjauntUses", 0);
            const result = await handleCloudsJaunt(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('handleFiresBurn', () => {
        const option = { name: "Fire's Burn", type: 'damage', damage: '1d10', damageType: 'Fire' };

        it('deals damage and consumes use', async () => {
            makeUsesMock("fire'sburnUses", 3);
            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Fire's Burn");
            expect(result.payload.description).toContain('Fire');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', "fire'sburnUses", 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'damage_roll',
                characterName: 'TestHero',
                targetName: 'Goblin',
                damageType: 'Fire',
            }));
        });

        it('returns popup when no target', async () => {
            makeUsesMock("fire'sburnUses", 3);
            resolveTarget.mockResolvedValue(null);

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock("fire'sburnUses", 0);
            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('handleFrostsChill', () => {
        const option = { name: "Frost's Chill", type: 'damage_with_condition', damage: '1d6', damageType: 'Cold', value: '10_ft' };

        it('deals damage and applies speed reduction', async () => {
            getRuntimeValue.mockImplementation((_name, key, campaign) => {
                if (key === "frost'schillUses") return 3;
                if (key === 'targetEffects' && campaign === 'campaign') return [];
                return null;
            });
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Frost's Chill");
            expect(result.payload.description).toContain('Cold');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'damage_roll',
                targetName: 'Goblin',
                damageType: 'Cold',
            }));
        });

        it('returns popup when no target', async () => {
            makeUsesMock("frost'schillUses", 3);
            resolveTarget.mockResolvedValue(null);

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock("frost'schillUses", 0);
            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('handleHillsTumble', () => {
        const option = { name: "Hill's Tumble", type: 'auto_effect', trigger: 'melee_hit', effect: 'prone' };

        it('knocks target prone', async () => {
            getRuntimeValue.mockImplementation((_name, key, campaign) => {
                if (key === "hill'stumbleUses") return 3;
                if (campaign && key === 'activeConditions') return [];
                return null;
            });
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const result = await handleHillsTumble(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Goblin');
            expect(result.payload.description).toContain('prone');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Hill's Tumble",
            }));
        });

        it('returns popup when no target found', async () => {
            makeUsesMock("hill'stumbleUses", 3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue(null);
            const result = await handleHillsTumble(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target found');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock("hill'stumbleUses", 0);
            const result = await handleHillsTumble(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('handleStonesEndurance', () => {
        const option = { name: "Stone's Endurance", type: 'damage_reduction', reductionExpression: '1d10 + CON modifier' };

        it('reduces damage and returns popup', async () => {
            makeUsesMock("stone'senduranceUses", 3);
            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Stone's Endurance");
            expect(result.payload.description).toContain('Reduce damage by');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', "stone'senduranceUses", 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Stone's Endurance",
            }));
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock("stone'senduranceUses", 0);
            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('handleStormsThunder', () => {
        const option = { name: "Storm's Thunder", type: 'reaction_damage', damage: '1d8', damageType: 'Thunder', range: '60_ft' };

        it('deals thunder damage as reaction', async () => {
            makeUsesMock("storm'sthunderUses", 3);
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Storm's Thunder");
            expect(result.payload.description).toContain('Thunder');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', "storm'sthunderUses", 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'damage_roll',
                targetName: 'Goblin',
                damageType: 'Thunder',
            }));
        });

        it('returns popup when no target', async () => {
            makeUsesMock("storm'sthunderUses", 3);
            resolveTarget.mockResolvedValue(null);

            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock("storm'sthunderUses", 0);
            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });
});
