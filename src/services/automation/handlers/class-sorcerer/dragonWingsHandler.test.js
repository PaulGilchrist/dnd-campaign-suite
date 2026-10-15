// @maintained-by-ai
// BUG CLA-099: uses economy, SP restore/refusal lanes, rounds clock, retract.
// Handler-only lane: activation economy, 0-uses SP gate/refusal, the ONE rounds
// clock registration, and the retract DELEGATION pin. Service internals
// (endDragonWingsBuff writes, log copy, isDragonWingsBuff, formatWingsDuration)
// are owned by dragonWingsService.test.js; LONG_REST_RESOURCES registration is
// owned by restRules-constants.cla099-dragon-wings.test.js — not re-pinned here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isActive } from './dragonWingsHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as metamagic from '../../../../hooks/combat/useMetamagic.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as logService from '../../../ui/logService.js';
import * as expirationQueue from '../../../rules/effects/expirationQueue.js';
import { endDragonWingsBuff } from '../../../rules/features/dragonWingsService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    spendSorceryPoints: vi.fn(),
    getCurrentSorceryPoints: vi.fn(),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

// Partial mock: retract lane becomes a delegation pin; isDragonWingsBuff,
// formatWingsDuration, and the key constants stay real (service test owns internals).
vi.mock('../../../rules/features/dragonWingsService.js', async (importOriginal) => ({
    ...(await importOriginal()),
    endDragonWingsBuff: vi.fn(() => true),
}));

const campaignName = 'test-campaign';
const playerName = 'Test Character';
const usesKey = 'dragonWingsUses';
const activeKey = 'dragonWingsActive';
const WINGS_BUFF = { name: 'Dragon Wings', effect: 'dragon_wings', duration: '1_hour', flySpeed: 60, hover: true };

function makeAction(overrides = {}) {
    return {
        name: 'Dragon Wings',
        automation: {
            type: 'dragon_wings',
            action: 'bonus_action',
            duration: '1_hour',
            flySpeed: 60,
            hover: true,
            uses: 1,
            recharge: 'long_rest',
            resourceCost: 'sorcery_points',
            restoreCost: 3,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 20,
        class: { name: 'Sorcerer' },
        ...overrides,
    };
}

function mockRuntimeGet(mapping) {
    runtimeState.getRuntimeValue.mockImplementation((_name, storedKey) => mapping[storedKey] ?? null);
}

describe('CLA-099 dragonWingsHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(null);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 20 });
        metamagic.getCurrentSorceryPoints.mockReturnValue(20);
    });

    describe('activation', () => {
        it('consumes the use from a fresh (key-absent) store: writes uses=0 and active=true without touching SP', async () => {
            mockRuntimeGet({ activeBuffs: [] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, usesKey, 0, campaignName);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, activeKey, true, campaignName);
            expect(result.payload.description).toBe('Dragon Wings activated. Fly Speed 60 feet (hover) for 1 hour.');
        });

        it('honors a custom uses count — first activation of uses:2 writes uses=1', async () => {
            mockRuntimeGet({ activeBuffs: [] });

            await handle(makeAction({ automation: { uses: 2 } }), makePlayerStats(), campaignName, null);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, usesKey, 1, campaignName);
        });

        it('registers ONE rounds clock of 600 for the 1_hour duration', async () => {
            mockRuntimeGet({ [usesKey]: 1, activeBuffs: [] });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(expirationQueue.addExpiration).toHaveBeenCalledWith({
                attackerName: playerName,
                targetName: playerName,
                effects: [{ type: 'dragon_wings' }],
                campaignName,
                rounds: 600,
            });
        });

        it('stamps the activeBuffs entry with the full buff composition', async () => {
            mockRuntimeGet({ [usesKey]: 1, activeBuffs: [] });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                [WINGS_BUFF],
                campaignName,
            );
        });

        it('formats the duration for display and logs activation as ability_use — no raw 1_hour enum', async () => {
            mockRuntimeGet({ [usesKey]: 1, activeBuffs: [] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('1 hour');
            expect(result.payload.description).not.toContain('1_hour');
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Dragon Wings',
                description: 'Test Character activated Dragon Wings (Bonus Action, 1 hour). Fly Speed 60 feet (hover).',
            }));
        });
    });

    describe('retract (click while buff stands)', () => {
        it('routes through the endDragonWingsBuff choke point — deactivates, touches no economy, registers no clock', async () => {
            mockRuntimeGet({ [usesKey]: 0, activeBuffs: [WINGS_BUFF] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(endDragonWingsBuff).toHaveBeenCalledWith(playerName, campaignName, 'retracted');
            expect(result.payload.description).toBe('Dragon Wings deactivated.');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(expirationQueue.addExpiration).not.toHaveBeenCalled();
        });
    });

    describe('0-uses lanes', () => {
        it('refuses with no uses and insufficient SP — no spend, refusal popup + refusal log', async () => {
            mockRuntimeGet({ [usesKey]: 0, activeBuffs: [] });
            metamagic.getCurrentSorceryPoints.mockReturnValue(2);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toBe('Dragon Wings has no uses remaining. Recharges on a Long Rest, or you can spend 3 Sorcery Points to restore.');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'automation',
                automationType: 'dragon_wings_refused',
                automationDetail: 'long_rest',
                characterName: playerName,
                abilityName: 'Dragon Wings',
                description: 'Test Character attempted Dragon Wings but it has no uses remaining — refills after a Long Rest or 3 Sorcery Points.',
            }));
        });

        it('restores at 0 uses by spending 3 SP, then activates with the use consumed', async () => {
            mockRuntimeGet({ [usesKey]: 0, activeBuffs: [] });
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 3, campaignName, 20);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, usesKey, 0, campaignName);
            expect(expirationQueue.addExpiration).toHaveBeenCalledWith(expect.objectContaining({ rounds: 600 }));
            expect(result.payload.description).toBe('Dragon Wings activated. Fly Speed 60 feet (hover) for 1 hour. (3 SP spent to restore the use)');
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                description: expect.stringContaining('restored Dragon Wings by spending 3 Sorcery Points'),
            }));
        });

        it('honors custom restoreCost from automation', async () => {
            mockRuntimeGet({ [usesKey]: 0, activeBuffs: [] });
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);

            await handle(makeAction({ automation: { restoreCost: 5 } }), makePlayerStats(), campaignName, null);

            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 5, campaignName, 20);
        });

        it('spends at the exact SP boundary — currentSP === restoreCost restores, not refuses', async () => {
            mockRuntimeGet({ [usesKey]: 0, activeBuffs: [] });
            metamagic.getCurrentSorceryPoints.mockReturnValue(3);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('activated');
            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 3, campaignName, 20);
        });
    });

    describe('isActive', () => {
        it.each([
            [true, true],
            [false, false],
            [null, false],
        ])('reads the plain dragonWingsActive key (%s → %s)', (value, expected) => {
            runtimeState.getRuntimeValue.mockReturnValue(value);
            expect(isActive(playerName, campaignName)).toBe(expected);
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(playerName, activeKey, campaignName);
        });
    });
});
