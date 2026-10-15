// @maintained-by-ai
// CLA-378: Vitality of the Tree — rage-activation surge ordering + rage-end THP strip.
// combatStanceHandler sextet lane: owns grant-BEFORE-buff-POST ordering + the single-deferred-POST
// count, rage anchor stamps, max-surge pick + rage ability_use log composition (full strings), and the
// rage-end THP/anchor strip incl. the Rage of the Gods strip. grantTempHpOnRage ARG SHAPE is pinned
// by the activation/pounce lanes; generic (non-Rage) deactivation by the main lane.
// Deterministic: runtime/logService/combatData mocked, pure handler, exact pins — no churn expected.
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
        // Rage DEFERS its activeBuffs write until after the grant — exactly one POST exists.
        const buffWrites = callsFor('activeBuffs');
        expect(buffWrites).toHaveLength(1);
        const buffIdx = runtimeState.setRuntimeValue.mock.calls.indexOf(buffWrites[0]);
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
            description: 'TestBarbarian activated Rage. Vitality of the Tree (Vitality Surge) grants 20 temporary hit points.',
        }));
    });

    it('dispatches every triggerOnRage feature and names only the largest surge in the log', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs': [],
            'TestBarbarian:ragePoints': 6,
        });
        const ps = makePlayerStats({
            automation: {
                specialActions: [
                    { name: 'Lesser Surge', triggerOnRage: true },
                    { name: 'Bigger Surge', triggerOnRage: true },
                ],
            },
        });
        tempHpBuff.grantTempHpOnRage.mockResolvedValueOnce(8).mockResolvedValueOnce(12);

        await handle(makeRageAction(), ps, campaignName);

        expect(tempHpBuff.grantTempHpOnRage).toHaveBeenCalledTimes(2);
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestBarbarian',
            abilityName: 'Rage',
            description: 'TestBarbarian activated Rage. Bigger Surge (Vitality Surge) grants 12 temporary hit points.',
        }));
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
            description: "TestBarbarian's Rage ended. Vitality of the Tree temporary hit points vanish for Thug 1.",
        }));
    });

    it('strips the dependent Rage of the Gods buff while keeping unrelated stances', async () => {
        setupRuntimeMocks({
            'TestBarbarian:activeBuffs': [
                { name: 'Rage', effect: 'stance' },
                { name: 'Rage of the Gods', effect: 'stance' },
                { name: 'Enhanced Ability', effect: 'stance' },
            ],
            'TestBarbarian:vitalityOfTheTreeGrantedTargets': null,
        });

        const result = await handle(makeRageAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(callsFor('activeBuffs')).toEqual([
            ['TestBarbarian', 'activeBuffs', [{ name: 'Enhanced Ability', effect: 'stance' }], campaignName],
        ]);
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
