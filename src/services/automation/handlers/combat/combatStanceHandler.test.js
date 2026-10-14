import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyStanceOption } from './combatStanceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

import * as tempTeleport from '../class-warlock/tempTeleportHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
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
