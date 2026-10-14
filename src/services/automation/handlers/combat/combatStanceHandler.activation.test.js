import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './combatStanceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as tempHpBuff from '../buffs/tempHpBuffHandler.js';

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
