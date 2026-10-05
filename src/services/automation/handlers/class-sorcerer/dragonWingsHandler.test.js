// @improved-by-ai
// BUG CLA-099: uses economy, SP restore/refusal lanes, rounds clock, retract.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isActive } from './dragonWingsHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as metamagic from '../../../../hooks/combat/useMetamagic.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as logService from '../../../ui/logService.js';
import * as expirationQueue from '../../../rules/effects/expirationQueue.js';

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
        it('consumes the use: writes dragonWingsUses=0 on activation', async () => {
            mockRuntimeGet({ [usesKey]: null, activeBuffs: [] });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, usesKey, 0, campaignName);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, activeKey, true, campaignName);
        });

        it('defaults to usesMax when the key is absent (fresh Long Rest)', async () => {
            mockRuntimeGet({ activeBuffs: [] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('activated');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, usesKey, 0, campaignName);
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

        it('writes the activeBuffs entry with fly speed and hover', async () => {
            mockRuntimeGet({ [usesKey]: 1, activeBuffs: [] });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                expect.arrayContaining([expect.objectContaining({ name: 'Dragon Wings', effect: 'dragon_wings', flySpeed: 60, hover: true })]),
                campaignName,
            );
        });

        it('formats the duration for display — no raw 1_hour enum', async () => {
            mockRuntimeGet({ [usesKey]: 1, activeBuffs: [] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('1 hour');
            expect(result.payload.description).not.toContain('1_hour');
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                description: expect.stringContaining('1 hour'),
            }));
        });

        it('logs activation as ability_use', async () => {
            mockRuntimeGet({ [usesKey]: 1, activeBuffs: [] });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Dragon Wings',
            }));
        });
    });

    describe('retract (click while buff stands)', () => {
        it('keeps toggle-off working: re-click removes the buff and does not refund the use', async () => {
            mockRuntimeGet({ [usesKey]: 0, activeBuffs: [WINGS_BUFF] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('deactivated');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'activeBuffs', [], campaignName);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, activeKey, false, campaignName);
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(playerName, usesKey, 1, campaignName);
            expect(expirationQueue.addExpiration).not.toHaveBeenCalled();
        });

        it('logs the retract', async () => {
            mockRuntimeGet({ [usesKey]: 0, activeBuffs: [WINGS_BUFF] });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                description: expect.stringContaining('dismisses the draconic wings'),
            }));
        });
    });

    describe('0-uses lanes', () => {
        it('refuses with no uses and insufficient SP — no spend, refusal popup + refusal log', async () => {
            mockRuntimeGet({ [usesKey]: 0, activeBuffs: [] });
            metamagic.getCurrentSorceryPoints.mockReturnValue(2);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('3 Sorcery Points');
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(playerName, 'activeBuffs', expect.anything(), campaignName);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'automation',
                automationType: 'dragon_wings_refused',
            }));
        });

        it('restores at 0 uses by spending 3 SP, then activates with the use consumed', async () => {
            mockRuntimeGet({ [usesKey]: 0, activeBuffs: [] });
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 3, campaignName, 20);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, usesKey, 0, campaignName);
            expect(expirationQueue.addExpiration).toHaveBeenCalledWith(expect.objectContaining({ rounds: 600 }));
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('3 SP spent to restore');
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

        it('does not re-gate when a prior refusal left uses at 0 but SP was since refilled', async () => {
            mockRuntimeGet({ [usesKey]: 0, activeBuffs: [] });
            metamagic.getCurrentSorceryPoints.mockReturnValue(3);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('activated');
            expect(metamagic.spendSorceryPoints).toHaveBeenCalled();
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
