// CLA-378: Vitality of the Tree — rage-activation surge ordering + rage-end THP strip.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './combatStanceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as tempHpBuff from '../buffs/tempHpBuffHandler.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';

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
        level: 20,
        speed: 30,
        automation: {
            specialActions: [
                { name: 'Vitality of the Tree', triggerOnRage: true, tempHpExpression: 'barbarian_level' },
            ],
        },
        ...overrides,
    };
}

function makeRageAction(automation = {}) {
    return {
        name: 'Rage',
        automation: { type: 'combat_stance', effect: 'stance', options: [], ...automation },
    };
}

function setupRuntimeMocks(mocks) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop) => {
        const key = `${player}:${prop}`;
        return key in mocks ? mocks[key] : undefined;
    });
}

function callsFor(prop) {
    return runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === prop);
}

beforeEach(() => {
    vi.clearAllMocks();
    combatData.getCurrentCombatRound.mockReturnValue(1);
});

describe('CLA-378 rage activation', () => {
    it('awaits the triggerOnRage grant BEFORE the buff POST so the last full-store write is a superset', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs': [],
            'TestBarbarian:ragePoints': 6,
        });
        tempHpBuff.grantTempHpOnRage.mockResolvedValue(20);

        await handle(makeRageAction(), makePlayerStats(), campaignName);

        expect(tempHpBuff.grantTempHpOnRage).toHaveBeenCalledTimes(1);
        const buffIdx = runtimeState.setRuntimeValue.mock.calls.findIndex(c => c[1] === 'activeBuffs');
        expect(buffIdx).toBeGreaterThanOrEqual(0);
        expect(tempHpBuff.grantTempHpOnRage.mock.invocationCallOrder[0])
            .toBeLessThan(runtimeState.setRuntimeValue.mock.invocationCallOrder[buffIdx]);
    });

    it('stamps the rage anchor and resets attribution + availability on activation', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs': [],
            'TestBarbarian:ragePoints': 6,
        });
        tempHpBuff.grantTempHpOnRage.mockResolvedValue(20);

        await handle(makeRageAction(), makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestBarbarian', 'vitalityOfTheTreeRageRound', 1, campaignName);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestBarbarian', 'vitalityOfTheTreeGrantedTargets', null, campaignName);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestBarbarian', 'vitalityOfTheTreeAvailable', false, campaignName);
    });

    it('logs Rage activation with the Vitality Surge amount', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs': [],
            'TestBarbarian:ragePoints': 6,
        });
        tempHpBuff.grantTempHpOnRage.mockResolvedValue(20);

        await handle(makeRageAction(), makePlayerStats(), campaignName);

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestBarbarian',
            abilityName: 'Rage',
            description: expect.stringContaining('activated Rage'),
        }));
        expect(logService.addEntry.mock.calls[0][1].description).toContain('20 temporary hit points');
    });
});

describe('CLA-378 rage end', () => {
    it('strips the caster temp HP and clears the rage anchor keys', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs': [{ name: 'Rage', effect: 'stance' }],
            'TestBarbarian:tempHp': 20,
            'TestBarbarian:vitalityOfTheTreeGrantedTargets': [{ target: 'Thug 1', amount: 15, round: 1 }],
        });

        const result = await handle(makeRageAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Rage ended');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestBarbarian', 'activeBuffs', [], campaignName);
        expect(callsFor('tempHp')).toEqual(expect.arrayContaining([
            ['TestBarbarian', 'tempHp', 0, campaignName],
        ]));
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestBarbarian', 'vitalityOfTheTreeAvailable', false, campaignName);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestBarbarian', 'vitalityOfTheTreeRageRound', null, campaignName);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestBarbarian', 'vitalityOfTheTreeGrantedTargets', null, campaignName);
    });

    it('strips attributed ally temp HP recorded on the rage anchor', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs': [{ name: 'Rage', effect: 'stance' }],
            'TestBarbarian:tempHp': 20,
            'TestBarbarian:vitalityOfTheTreeGrantedTargets': [
                { target: 'Thug 1', amount: 15, round: 1 },
                { target: 'Ally2', amount: 15, round: 2 },
            ],
        });

        await handle(makeRageAction(), makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Thug 1', 'tempHp', 0, campaignName);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally2', 'tempHp', 0, campaignName);
    });

    it('supports legacy plain-string attribution entries', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs': [{ name: 'Rage', effect: 'stance' }],
            'TestBarbarian:vitalityOfTheTreeGrantedTargets': ['Ally1'],
        });

        await handle(makeRageAction(), makePlayerStats(), campaignName);

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'tempHp', 0, campaignName);
    });

    it('logs Rage end naming the stripped allies', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs': [{ name: 'Rage', effect: 'stance' }],
            'TestBarbarian:vitalityOfTheTreeGrantedTargets': [{ target: 'Thug 1', amount: 15, round: 1 }],
        });

        await handle(makeRageAction(), makePlayerStats(), campaignName);

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestBarbarian',
            abilityName: 'Rage',
            description: expect.stringContaining("Rage ended"),
        }));
        expect(logService.addEntry.mock.calls[0][1].description).toContain('Thug 1');
    });

    it('does not strip temp HP when a non-Rage stance ends', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs': [{ name: 'Invocations', effect: 'stance' }],
        });

        const action = { name: 'Invocations', automation: { type: 'combat_stance', effect: 'stance', options: [] } };
        await handle(action, makePlayerStats(), campaignName);

        expect(callsFor('tempHp').length).toBe(0);
    });
});
