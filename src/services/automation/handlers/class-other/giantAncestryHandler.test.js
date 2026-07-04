// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, confirmGiantAncestry, getGiantAncestrySelection, getGiantAncestryOptions, handleDirectType, handleCloudsJaunt, handleFiresBurn, handleFrostsChill, handleHillsTumble, handleStonesEndurance, handleStormsThunder } from './giantAncestryHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

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

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

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
        abilities: [
            { name: 'Constitution', bonus: 2 },
        ],
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('giantAncestryHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should show selection modal when no ancestry is selected', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('giantAncestry');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBeDefined();
        });

        it('should dispatch to the correct sub-handler based on stored selection', async () => {
            getRuntimeValue.mockReturnValue("Cloud's Jaunt");
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
        });

        it('should return info popup when stored selection is unknown', async () => {
            getRuntimeValue.mockReturnValue("Unknown Ancestry");
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Unknown Ancestry");
        });

        it('should dispatch to damage handler for Fire Burn', async () => {
            getRuntimeValue.mockReturnValue("Fire's Burn");
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Fire's Burn");
        });

        it('should dispatch to damage_reduction handler for Stone Endurance', async () => {
            getRuntimeValue.mockReturnValue("Stone's Endurance");
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Stone's Endurance");
        });
    });

    describe('confirmGiantAncestry', () => {
        it('should store the selected ancestry and return confirmation', async () => {
            const result = await confirmGiantAncestry(
                makePlayerStats(),
                "Fire's Burn",
                'campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Fire's Burn");
            expect(result.payload.description).toContain('Recharges');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'giantAncestrySelection',
                "Fire's Burn",
                'campaign'
            );
        });

        it('should return error when no option is selected', async () => {
            const result = await confirmGiantAncestry(
                makePlayerStats(),
                'Nonexistent Option',
                'campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No option selected.');
        });
    });

    describe('getGiantAncestrySelection', () => {
        it('should return the stored selection', () => {
            getRuntimeValue.mockReturnValue("Stone's Endurance");
            const selection = getGiantAncestrySelection(makePlayerStats(), 'campaign');
            expect(selection).toBe("Stone's Endurance");
        });

        it('should return null when no selection exists', () => {
            getRuntimeValue.mockReturnValue(null);
            const selection = getGiantAncestrySelection(makePlayerStats(), 'campaign');
            expect(selection).toBe(null);
        });
    });

    describe('getGiantAncestryOptions', () => {
        it('should return all 6 giant ancestry options with type, icon, and description', () => {
            const options = getGiantAncestryOptions();
            expect(Array.isArray(options)).toBe(true);
            expect(options).toHaveLength(6);
            options.forEach(opt => {
                expect(opt.type).toBeDefined();
                expect(opt.icon).toBeDefined();
                expect(opt.description).toBeDefined();
            });
        });

        it('should include all expected ancestry names', () => {
            const options = getGiantAncestryOptions();
            const names = options.map(o => o.name);
            expect(names).toContain("Cloud's Jaunt");
            expect(names).toContain("Fire's Burn");
            expect(names).toContain("Frost's Chill");
            expect(names).toContain("Hill's Tumble");
            expect(names).toContain("Stone's Endurance");
            expect(names).toContain("Storm's Thunder");
        });
    });

    describe('resource_pool routing', () => {
        it('should route Giant Ancestry through resourcePoolHandler', async () => {
            const { handle: resourcePoolHandle } = await import('../resources/resourcePoolHandler.js');
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction();
            const result = await resourcePoolHandle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('giantAncestry');
        });
    });

    describe('handleDirectType', () => {
        it('should show modal when no selection', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction();
            const result = await handleDirectType(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('giantAncestry');
        });

        it('should dispatch to matching direct type', async () => {
            getRuntimeValue.mockReturnValue("Fire's Burn");
            const action = makeAction({ automation: { type: 'damage' } });
            const result = await handleDirectType(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Fire's Burn");
        });

        it('should return info popup when direct type does not match selection', async () => {
            getRuntimeValue.mockReturnValue("Cloud's Jaunt");
            const action = makeAction({ automation: { type: 'damage' } });
            const result = await handleDirectType(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Cloud's Jaunt");
            expect(result.payload.description).toContain('damage');
        });

        it('should show modal when no selection even with direct type', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction({ automation: { type: 'teleport' } });
            const result = await handleDirectType(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('giantAncestry');
        });

        it('should handle missing automation type gracefully', async () => {
            getRuntimeValue.mockReturnValue("Fire's Burn");
            const action = makeAction({ automation: undefined });
            const result = await handleDirectType(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Fire's Burn");
        });
    });

    describe('handleCloudsJaunt', () => {
        const option = { name: "Cloud's Jaunt", type: 'teleport', range: '30_ft' };

        it('should return modal for teleport with uses available', async () => {
            getRuntimeValue.mockReturnValue(3);
            const action = makeAction();
            const result = await handleCloudsJaunt(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
            expect(result.payload.action.name).toBe("Cloud's Jaunt");
            expect(result.payload.action.automation.distance).toBe('30 ft');
        });

        it('should return info popup when no uses remaining', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction();
            const result = await handleCloudsJaunt(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain("Cloud's Jaunt");
        });

        it('should default to proficiency as max uses when runtime value is undefined', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            const action = makeAction();
            const result = await handleCloudsJaunt(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
        });
    });

    describe('handleFiresBurn', () => {
        const option = { name: "Fire's Burn", type: 'damage', damage: '1d10', damageType: 'Fire' };

        it('should deal damage and consume use', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === "fire'sburnUses") return 3;
                return null;
            });
            const action = makeAction();
            const result = await handleFiresBurn(action, makePlayerStats(), 'campaign', option);

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

        it('should return popup when no target', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === "fire'sburnUses") return 3;
                return null;
            });
            const action = makeAction();
            const optionNoTarget = { ...option };
            resolveTarget.mockResolvedValue(null);

            const result = await handleFiresBurn(action, makePlayerStats(), 'campaign', optionNoTarget);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('should return info popup when no uses remaining', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === "fire'sburnUses") return 0;
                return null;
            });
            const action = makeAction();
            const result = await handleFiresBurn(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('should default to proficiency as max uses when runtime value is undefined', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
            const action = makeAction();
            const result = await handleFiresBurn(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalled();
        });
    });

    describe('handleFrostsChill', () => {
        const option = { name: "Frost's Chill", type: 'damage_with_condition', damage: '1d6', damageType: 'Cold', value: '10_ft' };

        it('should deal damage and apply speed reduction', async () => {
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
            getRuntimeValue.mockImplementation((_name, key, campaign) => {
                if (key === "frost'schillUses") return 3;
                if (key === 'targetEffects' && campaign === 'campaign') return [];
                return null;
            });
            const action = makeAction();
            const result = await handleFrostsChill(action, makePlayerStats(), 'campaign', option);

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

        it('should return popup when no target', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === "frost'schillUses") return 3;
                return null;
            });
            const action = makeAction();
            resolveTarget.mockResolvedValue(null);

            const result = await handleFrostsChill(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('should return info popup when no uses remaining', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === "frost'schillUses") return 0;
                return null;
            });
            const action = makeAction();
            const result = await handleFrostsChill(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('handleHillsTumble', () => {
        const option = { name: "Hill's Tumble", type: 'auto_effect', trigger: 'melee_hit', effect: 'prone' };

        it('should knock target prone', async () => {
            getRuntimeValue.mockImplementation((_name, key, campaign) => {
                if (key === "hill'stumbleUses") return 3;
                if (campaign && key === 'activeConditions') return [];
                return null;
            });
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const action = makeAction();
            const result = await handleHillsTumble(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Goblin');
            expect(result.payload.description).toContain('prone');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Hill's Tumble",
            }));
        });

        it('should return popup when no target found', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === "hill'stumbleUses") return 3;
                return null;
            });
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue(null);
            const action = makeAction();
            const result = await handleHillsTumble(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target found');
        });

        it('should return popup when no combat context', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === "hill'stumbleUses") return 3;
                return null;
            });
            getCombatContext.mockResolvedValue(null);
            const action = makeAction();
            const result = await handleHillsTumble(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target found');
        });

        it('should return info popup when no uses remaining', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === "hill'stumbleUses") return 0;
                return null;
            });
            const action = makeAction();
            const result = await handleHillsTumble(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('handleStonesEndurance', () => {
        const option = { name: "Stone's Endurance", type: 'damage_reduction', reductionExpression: '1d10 + CON modifier' };

        it('should reduce damage and return popup', async () => {
            getRuntimeValue.mockReturnValue(3);
            const action = makeAction();
            const result = await handleStonesEndurance(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Stone's Endurance");
            expect(result.payload.description).toContain('Reduce damage by');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', "stone'senduranceUses", 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Stone's Endurance",
            }));
        });

        it('should return info popup when no uses remaining', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction();
            const result = await handleStonesEndurance(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('should default to proficiency as max uses when runtime value is undefined', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            const action = makeAction();
            const result = await handleStonesEndurance(action, makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalled();
        });
    });

    describe('handleStormsThunder', () => {
        const option = { name: "Storm's Thunder", type: 'reaction_damage', damage: '1d8', damageType: 'Thunder', range: '60_ft' };

        it('should deal thunder damage as reaction', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === "storm'sthunderUses") return 3;
                return null;
            });
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
            const action = makeAction();
            const result = await handleStormsThunder(action, makePlayerStats(), 'campaign', 'map', option);

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

        it('should return popup when no target', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === "storm'sthunderUses") return 3;
                return null;
            });
            const action = makeAction();
            resolveTarget.mockResolvedValue(null);

            const result = await handleStormsThunder(action, makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('should return info popup when no uses remaining', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === "storm'sthunderUses") return 0;
                return null;
            });
            const action = makeAction();
            const result = await handleStormsThunder(action, makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('should default to proficiency as max uses when runtime value is undefined', async () => {
            getRuntimeValue.mockReturnValue(undefined);
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
            const action = makeAction();
            const result = await handleStormsThunder(action, makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalled();
        });
    });
});
