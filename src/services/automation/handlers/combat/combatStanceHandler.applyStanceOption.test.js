import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyStanceOption } from './combatStanceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../buffs/tempHpBuffHandler.js', () => ({
    grantTempHpOnRage: vi.fn(),
    handle: vi.fn(),
    confirmVitalityOfTheTree: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
    clearExtendedFlag: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestBarbarian',
        level: 5,
        speed: 30,
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Rage',
        automation: {
            type: 'combat_stance',
            ...automation,
        },
    };
}

function setupRuntimeMocks(mocks) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop, camp) => {
        const key = `${player}:${prop}:${camp}`;
        if (key in mocks) {
            return mocks[key];
        }
        return undefined;
    });
}

// ─── applyStanceOption: buff creation with option ───

describe('applyStanceOption - buff creation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('delegates to activateStance when valid option is found', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Bear', resistanceTypes: ['fire'] }];
        const action = makeAction({ effect: 'stance', options });
        const result = await applyStanceOption(action, makePlayerStats(), campaignName, 'Bear');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Rage');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    optionName: 'Bear',
                    resistanceTypes: ['fire'],
                }),
            ]),
            campaignName,
        );
    });

    it('sets flySpeed when chosen option has flySpeed and player is not wearing armor', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const ps = makePlayerStats({
            armorClassFormula: 'Unarmored Defense',
        });
        const options = [{ name: 'Falcon', flySpeed: 30, noArmor: true }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, ps, campaignName, 'Falcon');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'fly_speed_equals_walk_speed',
                    flySpeed: 30,
                }),
            ]),
            campaignName,
        );
    });

    it('blocks flySpeed when chosen option has noArmor and player is wearing armor', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const ps = makePlayerStats({
            armorClassFormula: 'Armor (16) + DEX modifier',
        });
        const options = [{ name: 'Falcon', flySpeed: 30, noArmor: true }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, ps, campaignName, 'Falcon');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'stance',
                    flySpeed: null,
                }),
            ]),
            campaignName,
        );
    });

    it('allows flySpeed when noArmor is false on the option', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const ps = makePlayerStats({
            armorClassFormula: '(Armor) 18',
        });
        const options = [{ name: 'Falcon', flySpeed: 30, noArmor: false }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, ps, campaignName, 'Falcon');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'fly_speed_equals_walk_speed',
                    flySpeed: 30,
                }),
            ]),
            campaignName,
        );
    });

    it('sets effect to ice_walk when chosen option has ice_walk effect', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Cold', effect: 'ice_walk' }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Cold');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'ice_walk',
                }),
            ]),
            campaignName,
        );
    });

    it('sets speedBonus when chosen option has speed_boost effect', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Fire', effect: 'speed_boost', speedBonus: 15 }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Fire');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'speed_boost',
                    speedBonus: 15,
                }),
            ]),
            campaignName,
        );
    });

    it('sets flySpeed to equals_walk_speed when chosen option has fly_speed effect', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Lightning', effect: 'fly_speed' }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Lightning');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'fly_speed_equals_walk_speed',
                    flySpeed: 'equals_walk_speed',
                }),
            ]),
            campaignName,
        );
    });

    it('sets teleport when chosen option has teleport effect', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Thunder', effect: 'teleport', teleportDistance: '60 ft' }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Thunder');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    effect: 'teleport_ready',
                    teleportDistance: '60 ft',
                }),
            ]),
            campaignName,
        );
    });

    it('returns teleport modal for elemental stride teleport option', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Thunder', effect: 'teleport', teleportDistance: '30 ft' }];
        const action = makeAction({ effect: 'stance', options });
        const result = await applyStanceOption(action, makePlayerStats(), campaignName, 'Thunder');

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('teleport');
        expect(result.payload.triggeredByElementalStride).toBe(true);
    });

    it('sets noArmor from chosen option', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Falcon', noArmor: true }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Falcon');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    noArmor: true,
                }),
            ]),
            campaignName,
        );
    });

    it('sets range from chosen option', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Test', range: '60 ft' }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Test');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    range: '60 ft',
                }),
            ]),
            campaignName,
        );
    });

    it('removes charmed and frightened conditions when Rage is activated via applyStanceOption', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
            'TestBarbarian:activeConditions:TestCampaign': ['charmed', 'frightened', 'poisoned'],
        });

        const options = [{ name: 'Bear' }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Bear');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeConditions',
            ['poisoned'],
            campaignName,
        );
    });

    it('sets resistance types from chosen option when Bear is selected', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] }];
        const action = makeAction({ effect: 'stance', options });
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Bear');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    resistanceTypes: expect.arrayContaining([
                        'acid', 'bludgeoning', 'cold', 'fire', 'lightning', 'piercing', 'poison', 'slashing', 'thunder',
                    ]),
                }),
            ]),
            campaignName,
        );
    });
});

// ─── Rage of the Wilds - special handling ───

describe('combatStanceHandler - Rage of the Wilds', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns modal for Rage of the Wilds (options shown even if rage not active)', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
        });

        const options = [
            { name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] },
            { name: 'Eagle' },
            { name: 'Wolf' },
        ];
        const action = { name: 'Rage of the Wilds', automation: { type: 'combat_stance', effect: 'animal_rage_option', options } };
        const result = await (await import('./combatStanceHandler.js')).handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('combatStance');
    });

    it('returns error popup when rage is not active via applyStanceOption', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
        });

        const options = [
            { name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] },
            { name: 'Wolf' },
        ];
        const action = { name: 'Rage of the Wilds', automation: { type: 'combat_stance', effect: 'animal_rage_option', options } };
        const result = await applyStanceOption(action, makePlayerStats(), campaignName, 'Bear');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('Rage of the Wilds requires Rage to be active.');
    });

    it('does not deduct rage points when rage is active', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [{ name: 'Rage', effect: 'stance' }],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [
            { name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] },
            { name: 'Wolf' },
        ];
        const action = { name: 'Rage of the Wilds', automation: { type: 'combat_stance', effect: 'animal_rage_option', options } };
        const result = await (await import('./combatStanceHandler.js')).handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'TestBarbarian',
            'ragePoints',
            expect.any(Number),
            campaignName,
        );
    });

    it('creates buff without deducting rage points when rage is active', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [{ name: 'Rage', effect: 'stance' }],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] }];
        const action = { name: 'Rage of the Wilds', automation: { type: 'combat_stance', effect: 'animal_rage_option', options } };
        const result = await applyStanceOption(action, makePlayerStats(), campaignName, 'Bear');

        expect(result.type).toBe('popup');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Rage of the Wilds',
                    optionName: 'Bear',
                }),
            ]),
            campaignName,
        );
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            'TestBarbarian',
            'ragePoints',
            expect.any(Number),
            campaignName,
        );
    });

    it('logs wild selection to campaign log', async () => {
        const { addEntry } = await import('../../../ui/logService.js');

        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [{ name: 'Rage', effect: 'stance' }],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Wolf', effect: 'ally_advantage_on_nearby_enemies', range: '5 ft' }];
        const action = { name: 'Rage of the Wilds', automation: { type: 'combat_stance', effect: 'animal_rage_option', options } };
        await applyStanceOption(action, makePlayerStats(), campaignName, 'Wolf');

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'automation',
            automationType: 'Rage of the Wilds',
            creatureName: 'TestBarbarian',
            description: 'Selected Wolf wild form',
        }));
    });
});
