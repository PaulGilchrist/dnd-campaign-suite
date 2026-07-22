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
    handleCloudsJauntDirect,
    handleFiresBurnDirect,
    handleFrostsChillDirect,
    handleHillsTumbleDirect,
    handleStonesEnduranceDirect,
    handleStormsThunderDirect,
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

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, newHp: 15, oldHp: 20, damageReduced: false })),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(async () => ({
        attackEvent: { rollType: 'attack', attackerName: 'TestHero' },
        attackerName: 'TestHero',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
    })),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { findLastAttack } from '../../common/damageRollback.js';

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
        vi.resetAllMocks();
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

    // Helper for sub-handler tests that share the "no uses remaining" pattern
    function makeUsesMock(usesKey, value) {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === usesKey) return value;
            return null;
        });
    }

    describe('handleCloudsJaunt', () => {
        const option = { name: "Cloud's Jaunt", type: 'teleport', range: '30_ft' };

        it('returns info popup when uses available', async () => {
            makeUsesMock('cloudsJauntUses', 3);
            const result = await handleCloudsJaunt(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Cloud's Jaunt");
            expect(result.payload.description).toContain('Teleported');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'cloudsJauntUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: "Cloud's Jaunt",
            }));
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('cloudsJauntUses', 0);
            const result = await handleCloudsJaunt(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });

    describe('handleFiresBurn', () => {
        const option = { name: "Fire's Burn", type: 'damage', damage: '1d10', damageType: 'Fire' };

        it('deals damage and consumes use', async () => {
            makeUsesMock('firesBurnUses', 3);
            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.name).toBe("Fire's Burn");
            expect(result.payload.damageType).toBe('Fire');
            expect(result.payload.finalDamage).toBe(5);
            expect(result.payload.targetName).toBe('Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'firesBurnUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                characterName: 'TestHero',
                targetName: 'Goblin',
                damageType: 'Fire',
            }));
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('requires a recent attack');
        });

        it('returns popup when attacker is not the player', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after you make an attack');
        });

        it('returns popup when rollType is not attack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            });

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after an attack roll');
        });

        it('returns popup when no targetName in lastAttack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'TestHero',
                targetName: null,
            });

            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('firesBurnUses', 0);
            const result = await handleFiresBurn(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });

    describe('handleFrostsChill', () => {
        const option = { name: "Frost's Chill", type: 'damage_with_condition', damage: '1d6', damageType: 'Cold', value: '10_ft' };

        it('deals damage and applies speed reduction', async () => {
            makeUsesMock('frostsChillUses', 3);
            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.name).toBe("Frost's Chill");
            expect(result.payload.damageType).toBe('Cold');
            expect(result.payload.finalDamage).toBe(5);
            expect(result.payload.targetName).toBe('Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'frostsChillUses', 2, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Goblin',
                damageType: 'Cold',
            }));
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('requires a recent attack');
        });

        it('returns popup when attacker is not the player', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after you make an attack');
        });

        it('returns popup when rollType is not attack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after an attack roll');
        });

        it('returns popup when no targetName in lastAttack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'TestHero',
                targetName: null,
            });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('frostsChillUses', 0);
            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });

    describe('handleHillsTumble', () => {
        const option = { name: "Hill's Tumble", type: 'auto_effect', trigger: 'melee_hit', effect: 'prone' };

        it('knocks target prone', async () => {
            getRuntimeValue.mockImplementation((_name, key, campaign) => {
                if (key === 'hillsTumbleUses') return 3;
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
            makeUsesMock('hillsTumbleUses', 3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue(null);
            const result = await handleHillsTumble(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target found');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('hillsTumbleUses', 0);
            const result = await handleHillsTumble(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('handleStonesEndurance', () => {
        const option = { name: "Stone's Endurance", type: 'damage_reduction', reductionExpression: '1d10 + CON modifier' };

        it('reduces damage and returns popup', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Stone's Endurance");
            expect(result.payload.description).toContain('Reduce damage by');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stonesEnduranceUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Stone's Endurance",
            }));
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('stonesEnduranceUses', 0);
            const result = await handleStonesEndurance(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('handleStormsThunder', () => {
        const option = { name: "Storm's Thunder", type: 'reaction_damage', damage: '1d8', damageType: 'Thunder', range: '60_ft' };

        it('deals thunder damage as reaction', async () => {
            makeUsesMock('stormsThunderUses', 3);
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Storm's Thunder");
            expect(result.payload.description).toContain('Thunder');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stormsThunderUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Goblin',
                damageType: 'Thunder',
            }));
        });

        it('returns popup when no target', async () => {
            makeUsesMock('stormsThunderUses', 3);
            resolveTarget.mockResolvedValue(null);

            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', option);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('stormsThunderUses', 0);
            const stormsThunderOption = { name: "Storm's Thunder", type: 'reaction_damage', damage: '3d8', damageType: 'Thunder' };
            const result = await handleStormsThunder(makeAction(), makePlayerStats(), 'campaign', 'map', stormsThunderOption);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('handleCloudsJauntDirect', () => {
        const directAction = {
            name: "Cloud's Jaunt",
            automation: {
                type: 'clouds_jaunt',
                distance: '30 ft',
                range: '30_ft',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 bonus action',
            },
        };

        it('consumes use and returns info popup', async () => {
            makeUsesMock('cloudsJauntUses', 3);
            const result = await handleCloudsJauntDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Cloud's Jaunt");
            expect(result.payload.description).toContain('Teleported');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'cloudsJauntUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: "Cloud's Jaunt",
            }));
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('cloudsJauntUses', 0);
            const result = await handleCloudsJauntDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });

    describe('handleFiresBurnDirect', () => {
        const directAction = {
            name: "Fire's Burn",
            automation: {
                type: 'fire_burn',
                damage: '1d10',
                damageType: 'Fire',
                trigger: 'hit',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 action',
            },
        };

        it('deals damage and consumes use', async () => {
            makeUsesMock('firesBurnUses', 3);
            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.name).toBe("Fire's Burn");
            expect(result.payload.damageType).toBe('Fire');
            expect(result.payload.finalDamage).toBe(5);
            expect(result.payload.targetName).toBe('Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'firesBurnUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                characterName: 'TestHero',
                targetName: 'Goblin',
                damageType: 'Fire',
            }));
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('requires a recent attack');
        });

        it('returns popup when attacker is not the player', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after you make an attack');
        });

        it('returns popup when rollType is not attack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            });

            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after an attack roll');
        });

        it('returns popup when no targetName in lastAttack', async () => {
            makeUsesMock('firesBurnUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'TestHero',
                targetName: null,
            });

            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('firesBurnUses', 0);
            const result = await handleFiresBurnDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });

    describe('handleFrostsChillDirect', () => {
        const directAction = {
            name: "Frost's Chill",
            automation: {
                type: 'frosts_chill',
                damage: '1d6',
                damageType: 'Cold',
                condition: 'speed_reduction',
                value: '10_ft',
                trigger: 'hit',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 action',
            },
        };

        it('deals damage and applies speed reduction', async () => {
            makeUsesMock('frostsChillUses', 3);
            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('damage');
            expect(result.payload.name).toBe("Frost's Chill");
            expect(result.payload.damageType).toBe('Cold');
            expect(result.payload.finalDamage).toBe(5);
            expect(result.payload.targetName).toBe('Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'frostsChillUses', 2, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Goblin',
                damageType: 'Cold',
            }));
        });

        it('returns popup when no lastAttack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('requires a recent attack');
        });

        it('returns popup when attacker is not the player', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after you make an attack');
        });

        it('returns popup when rollType is not attack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            });

            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('after an attack roll');
        });

        it('returns popup when no targetName in lastAttack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack' },
                attackerName: 'TestHero',
                targetName: null,
            });

            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('frostsChillUses', 0);
            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });
    });

    describe('handleHillsTumbleDirect', () => {
        const directAction = {
            name: "Hill's Tumble",
            automation: {
                type: 'hills_tumble',
                trigger: 'melee_hit',
                effect: 'prone',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 action',
            },
        };

        it('knocks target prone', async () => {
            getRuntimeValue.mockImplementation((_name, key, campaign) => {
                if (key === 'hillsTumbleUses') return 3;
                if (campaign && key === 'activeConditions') return [];
                return null;
            });
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const result = await handleHillsTumbleDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Goblin');
            expect(result.payload.description).toContain('prone');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Hill's Tumble",
            }));
        });

        it('returns popup when no target found', async () => {
            makeUsesMock('hillsTumbleUses', 3);
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue(null);
            const result = await handleHillsTumbleDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target found');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('hillsTumbleUses', 0);
            const result = await handleHillsTumbleDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('handleStonesEnduranceDirect', () => {
        const directAction = {
            name: "Stone's Endurance",
            automation: {
                type: 'stones_endurance',
                reductionExpression: '1d12 + CON modifier',
                trigger: 'damage_received',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 reaction',
            },
        };

        it('reduces damage and returns popup', async () => {
            makeUsesMock('stonesEnduranceUses', 3);
            const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Stone's Endurance");
            expect(result.payload.description).toContain('Reduce damage by');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stonesEnduranceUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: "Stone's Endurance",
            }));
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('stonesEnduranceUses', 0);
            const result = await handleStonesEnduranceDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('handleStormsThunderDirect', () => {
        const directAction = {
            name: "Storm's Thunder",
            automation: {
                type: 'storms_thunder',
                damage: '1d8',
                damageType: 'Thunder',
                range: '60_ft',
                trigger: 'damage_received_within_range',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 reaction',
            },
        };

        it('deals thunder damage as reaction', async () => {
            makeUsesMock('stormsThunderUses', 3);
            resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Storm's Thunder");
            expect(result.payload.description).toContain('Thunder');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stormsThunderUses', 2, 'campaign');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                targetName: 'Goblin',
                damageType: 'Thunder',
            }));
        });

        it('returns popup when no target', async () => {
            makeUsesMock('stormsThunderUses', 3);
            resolveTarget.mockResolvedValue(null);

            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires a target');
        });

        it('returns info popup when no uses remaining', async () => {
            makeUsesMock('stormsThunderUses', 0);
            const result = await handleStormsThunderDirect(directAction, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });
});
