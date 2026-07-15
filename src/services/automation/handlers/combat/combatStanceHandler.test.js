// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyStanceOption } from './combatStanceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as tempHpBuff from '../buffs/tempHpBuffHandler.js';
import * as tempTeleport from '../class-warlock/tempTeleportHandler.js';

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

// ─── helpers ───

function setupRuntimeMocks(mocks) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop, camp) => {
        const key = `${player}:${prop}:${camp}`;
        if (key in mocks) {
            return mocks[key];
        }
        return undefined;
    });
}

// ─── handle: deactivation (wasActive) ───

describe('combatStanceHandler - deactivation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('removes the stance from activeBuffs and returns popup when already active', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [{ name: 'Rage', effect: 'stance' }],
        });

        const action = makeAction({ effect: 'stance', options: [] });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('Rage ended');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            [],
            campaignName,
        );
    });

    it('clears extended flag when Rage is deactivated', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [{ name: 'Rage', effect: 'stance' }],
        });

        const action = makeAction({ effect: 'stance', options: [] });
        await handle(action, makePlayerStats(), campaignName);

        expect(tempTeleport.clearExtendedFlag).toHaveBeenCalledWith('TestBarbarian', campaignName);
    });

    it('returns healing illusion modal when create_illusion with enhanced distraction passive is deactivated', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [{ name: 'Rage', effect: 'create_illusion' }],
        });

        const ps = makePlayerStats({
            automation: {
                passives: [{ name: 'Test', effect: 'enhanced_distraction_and_healing' }],
            },
        });
        const action = makeAction({ effect: 'create_illusion', options: [] });
        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('healingIllusion');
        expect(result.payload.action).toBe(action);
        expect(result.payload.playerStats).toBe(ps);
        expect(result.payload.campaignName).toBe(campaignName);
    });
});

// ─── handle: modal path (options exist) ───

describe('combatStanceHandler - modal path', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns a modal when stance has options and is not already active', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
        });

        const options = [
            { name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] },
            { name: 'Wolf' },
        ];
        const action = makeAction({ effect: 'stance', options });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('combatStance');
        expect(result.payload.action).toBe(action);
        expect(result.payload.playerStats).toBeDefined();
    });

    it('does not show modal if stance is already active even with options', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [{ name: 'Rage', effect: 'stance' }],
        });

        const options = [{ name: 'Bear' }, { name: 'Wolf' }];
        const action = makeAction({ effect: 'stance', options });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Rage ended');
    });
});

// ─── handle: activation - instinctive pounce ───

describe('combatStanceHandler - instinctive pounce', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with instinctive pounce message when rage_bonus_movement feature exists', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const ps = makePlayerStats({
            automation: {
                specialActions: [{ name: 'Instinctive Pounce', effect: 'rage_bonus_movement', triggerOnRage: true }],
            },
        });

        const action = makeAction({ effect: 'stance', options: [] });
        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Rage');
        expect(result.payload.description).toContain('You can move up to');
        expect(result.payload.description).toContain('as part of entering your Rage');
        expect(result.payload.description).toContain('Rage activated');
        expect(tempHpBuff.grantTempHpOnRage).toHaveBeenCalled();
    });

    it('does not return instinctive pounce popup when feature does not exist', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const ps = makePlayerStats({
            automation: {
                specialActions: [{ name: 'Other Feature', effect: 'something_else' }],
            },
        });

        const action = makeAction({ effect: 'stance', options: [] });
        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Rage');
        expect(tempHpBuff.grantTempHpOnRage).not.toHaveBeenCalled();
    });

    it('handles missing automation gracefully without throwing', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const ps = makePlayerStats({ automation: null });
        const action = makeAction({ effect: 'stance', options: [] });

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Rage');
    });
});

// ─── handle: activation - teleport on rage ───

describe('combatStanceHandler - teleport on rage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns teleport modal when teleport_on_rage feature exists', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const ps = makePlayerStats({
            automation: {
                specialActions: [
                    { name: 'Test Teleport', effect: 'teleport_on_rage' },
                    { name: 'Instinctive Pounce', effect: 'rage_bonus_movement', triggerOnRage: true },
                ],
            },
        });

        const action = makeAction({ effect: 'stance', options: [] });
        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('teleport');
        expect(result.payload.triggeredByRage).toBe(true);
    });
});

// ─── handle: activation - create_illusion with teleport swap ───

describe('combatStanceHandler - create_illusion teleport swap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns teleport modal when create_illusion with teleport_swap passive exists', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const ps = makePlayerStats({
            automation: {
                specialActions: [
                    { name: 'Swap', effect: 'teleport_swap_with_illusion' },
                ],
            },
        });

        const action = makeAction({ effect: 'create_illusion', options: [] });
        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('teleport');
        expect(result.payload.triggeredByDuplicity).toBe(true);
    });

    it('returns normal popup when no teleport swap passive exists', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const ps = makePlayerStats({
            automation: {
                specialActions: [],
            },
        });

        const action = makeAction({ effect: 'create_illusion', options: [] });
        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('cast spells as though you were in the illusion');
    });
});

// ─── handle: activation - resource exhaustion ───

describe('combatStanceHandler - resource exhaustion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('blocks activation when ragePoints resource is exhausted', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 0,
        });

        const action = makeAction({ effect: 'stance', options: [], uses: 1, resourceKey: 'ragePoints' });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Rage has been used and cannot be used again until a Long Rest.');
    });

    it('blocks activation when channel divinity charges are 0', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:channelDivinityCharges:TestCampaign': 0,
        });

        const action = makeAction({ effect: 'stance', options: [], resourceCost: 'channel_divinity' });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
    });

    it('blocks activation when custom resource is exhausted', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:customResource:TestCampaign': 0,
        });

        const action = makeAction({ effect: 'stance', options: [], resourceKey: 'customResource' });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No Rage uses remaining.');
    });
});

// ─── handle: activation - buff creation ───

describe('combatStanceHandler - buff creation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('adds a buff to activeBuffs with default values', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const action = makeAction({ effect: 'stance', options: [] });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Rage',
                    effect: 'stance',
                    duration: '1_minute',
                    resistanceTypes: [],
                    advantages: [],
                    blocksSpellcasting: false,
                }),
            ]),
            campaignName,
        );
    });

    it('removes charmed and frightened conditions when Rage is activated', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
            'TestBarbarian:activeConditions:TestCampaign': ['charmed', 'frightened', 'poisoned'],
        });

        const action = makeAction({ effect: 'stance', options: [] });
        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeConditions',
            ['poisoned'],
            campaignName,
        );
    });

    it('does not modify conditions when activeConditions is null', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
            'TestBarbarian:activeConditions:TestCampaign': null,
        });

        const action = makeAction({ effect: 'stance', options: [] });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
    });

    it('sets resistance types from auto config when no option chosen', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const resistanceTypes = ['fire', 'cold', 'all_except_force_necrotic_psychic_radiant'];
        const action = makeAction({
            effect: 'stance',
            options: [],
            resistanceTypes,
        });
        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    resistanceTypes: ['fire', 'cold', 'all_except_force_necrotic_psychic_radiant'],
                }),
            ]),
            campaignName,
        );
    });

    it('sets advantages from auto config', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const action = makeAction({
            effect: 'stance',
            options: [],
            advantages: ['melee_attack_rolls'],
        });
        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    advantages: ['melee_attack_rolls'],
                }),
            ]),
            campaignName,
        );
    });

    it('sets damageBonusExpression from auto config', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const action = makeAction({
            effect: 'stance',
            options: [],
            damageBonusExpression: '1d12',
        });
        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    damageBonusExpression: '1d12',
                }),
            ]),
            campaignName,
        );
    });

    it('sets blocksSpellcasting from auto config', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const action = makeAction({
            effect: 'stance',
            options: [],
            blocksSpellcasting: true,
        });
        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    blocksSpellcasting: true,
                }),
            ]),
            campaignName,
        );
    });

    it('sets reactionSave from auto config', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const action = makeAction({
            effect: 'stance',
            options: [],
            reactionSave: { dc: 15, save: 'dexterity' },
        });
        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    reactionSave: { dc: 15, save: 'dexterity' },
                }),
            ]),
            campaignName,
        );
    });

    it('sets flySpeed from auto config when no option chosen', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const action = makeAction({
            effect: 'stance',
            options: [],
            flySpeed: 20,
        });
        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    flySpeed: 20,
                }),
            ]),
            campaignName,
        );
    });

    it('decrements ragePoints on activation', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const action = makeAction({ effect: 'stance', options: [] });
        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'ragePoints',
            3,
            campaignName,
        );
    });

    it('decrements channel divinity charges on activation', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:channelDivinityCharges:TestCampaign': 2,
        });

        const action = makeAction({ effect: 'stance', options: [], resourceCost: 'channel_divinity' });
        await handle(action, makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'channelDivinityCharges',
            1,
            campaignName,
        );
    });
});

// ─── handle: activation - description formatting ───

describe('combatStanceHandler - description formatting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('includes uses remaining in description when maxUses > 0', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const action = makeAction({ effect: 'stance', options: [], uses: 3 });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('2/3 uses remaining');
    });

    it('includes option name and effects in description when option chosen', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const options = [{ name: 'Bear', resistanceTypes: [] }];
        const action = makeAction({ effect: 'stance', options });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('combatStance');
    });

    it('returns simple activated message when no uses and no option', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const action = makeAction({ effect: 'stance', options: [] });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toBe('Rage activated');
    });

    it('returns activated message with uses remaining for custom resource', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [],
            'TestBarbarian:customResource:TestCampaign': 3,
        });

        const action = makeAction({ effect: 'stance', options: [], uses: 3, resourceKey: 'customResource' });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.payload.description).toContain('activated');
        expect(result.payload.description).toContain('2/3');
    });
});

// ─── handle: activeBuffs null handling ───

describe('combatStanceHandler - activeBuffs null handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('handles null activeBuffs gracefully', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': null,
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        const action = makeAction({ effect: 'stance', options: [] });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
    });
});

// ─── applyStanceOption: invalid option ───

describe('applyStanceOption - invalid option', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns invalid option popup when optionName does not match', async () => {
        const options = [{ name: 'Bear' }, { name: 'Wolf' }];
        const action = makeAction({ effect: 'stance', options });
        const result = await applyStanceOption(action, makePlayerStats(), campaignName, 'Nonexistent');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('Invalid option: Nonexistent');
    });
});

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
        const result = await handle(action, makePlayerStats(), campaignName);

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
        const result = await handle(action, makePlayerStats(), campaignName);

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
        vi.mock('../../../ui/logService.js', () => ({
            addEntry: vi.fn(() => Promise.resolve()),
        }));

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
