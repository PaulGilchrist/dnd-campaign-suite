// @maintained-by-ai
// combatStanceHandler sextet — lane: MAIN (per the seam map in
// combatStanceHandler.activation.test.js). Owns: handle() deactivation
// (wasActive) — the full popup envelope + '${action.name} ended' template
// canon incl. 'Rage ended', the generic non-Rage buff-filter else-branch
// (no clearExtendedFlag), the create_illusion+enhanced-passive healingIllusion
// modal handoff; the modal path (options > 0); resource-exhaustion refusals
// for all three consumeStanceResource gates (tracked uses, channel divinity,
// rage-point pool) as zero-write refusals; null activeBuffs coalescing; and
// applyStanceOption invalid-option refusal.
// Rage-END THP/anchor strip writes are cla378's; option-derived buff shapes
// and Rage of the Wilds flows are the applyStanceOption lane's; successful
// resource decrements and buff/description shapes are activation's.
// Deterministic: runtime/logService/combatData/tempHpBuff mocked, pure
// handler, exact pins — no churn expected.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyStanceOption } from './combatStanceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

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

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
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

function makeAction(automation = {}, name = 'Rage') {
    return {
        name,
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

    it('ends an active Rage: canonical popup envelope, buff stripped, extended flag cleared', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [{ name: 'Rage', effect: 'stance' }],
        });

        const action = makeAction({ effect: 'stance', options: [] });
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload).toEqual({
            type: 'automation_info',
            name: 'Rage',
            automationType: 'combat_stance',
            description: 'Rage ended',
            automation: action.automation,
        });
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            [],
            campaignName,
        );
        expect(tempTeleport.clearExtendedFlag).toHaveBeenCalledWith('TestBarbarian', campaignName);
        // THP/anchor strip writes on rage-end are owned by cla378 — not repinned here.
    });

    it('deactivates a generic non-Rage stance instead of reopening its modal, keeping unrelated buffs', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': [
                { name: 'Invocations', effect: 'stance' },
                { name: 'Enhanced Ability', effect: 'stance' },
            ],
        });

        // Options present but wasActive wins: deactivation, never the modal.
        const action = makeAction({ effect: 'stance', options: [{ name: 'A' }, { name: 'B' }] }, 'Invocations');
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload).toEqual({
            type: 'automation_info',
            name: 'Invocations',
            automationType: 'combat_stance',
            description: 'Invocations ended',
            automation: action.automation,
        });
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestBarbarian',
            'activeBuffs',
            [{ name: 'Enhanced Ability', effect: 'stance' }],
            campaignName,
        );
        // Generic stances must not touch the warlock teleport extended flag.
        expect(tempTeleport.clearExtendedFlag).not.toHaveBeenCalled();
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
        // Modal defers state changes — nothing written until the modal resolves.
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
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
        const ps = makePlayerStats();
        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('combatStance');
        expect(result.payload).toEqual({ action, playerStats: ps, campaignName });
        // Routing only — no activation side effects before a choice is made.
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
});

// ─── handle: activation - resource exhaustion refusals (zero state writes) ───

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
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
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
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
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
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
});

// ─── handle: activeBuffs null handling ───

describe('combatStanceHandler - activeBuffs null handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('treats null activeBuffs as empty and activates cleanly', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs:TestCampaign': null,
            'TestBarbarian:ragePoints:TestCampaign': 4,
        });

        // Non-Rage stance: stays a pure null-coalesce probe, no rage machinery.
        const action = makeAction({ effect: 'stance', options: [] }, 'Invocations');
        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        const buffWrites = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'activeBuffs');
        expect(buffWrites).toEqual([
            ['TestBarbarian', 'activeBuffs', [expect.objectContaining({ name: 'Invocations' })], campaignName],
        ]);
    });
});

// ─── applyStanceOption: invalid option ───

describe('applyStanceOption - invalid option', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns invalid option popup when optionName does not match, inert', async () => {
        const options = [{ name: 'Bear' }, { name: 'Wolf' }];
        const action = makeAction({ effect: 'stance', options });
        const result = await applyStanceOption(action, makePlayerStats(), campaignName, 'Nonexistent');

        expect(result.type).toBe('popup');
        expect(result.payload).toEqual({
            type: 'automation_info',
            name: 'Rage',
            automationType: 'combat_stance',
            description: 'Invalid option: Nonexistent',
            automation: action.automation,
        });
        // Refusal is inert: zero state writes.
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
});
