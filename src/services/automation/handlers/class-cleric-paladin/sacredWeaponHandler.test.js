import { describe, it, expect, vi } from 'vitest';
import { handle, applyDamageTypeChoice } from './sacredWeaponHandler.js';
import * as runtimeState from '../../../../hooks/useRuntimeState.js';

const campaignName = 'test-campaign';

function makeAction(overrides = {}) {
    return {
        name: 'Sacred Weapon',
        automation: {
            type: 'temp_buff',
            effect: 'sacred_weapon',
            duration: '10_minutes',
            resourceCost: 'channel_divinity',
            options: [
                { name: 'Normal Damage Type', damageType: 'normal' },
                { name: 'Radiant Damage', damageType: 'Radiant' },
            ],
            casting_time: '1_action',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        level: 5,
        class: {
            class_levels: [
                undefined, undefined, { channel_divinity: 2 },
                undefined, undefined,
            ],
        },
        abilities: [
            { name: 'Charisma', bonus: 3 },
        ],
        ...overrides,
    };
}

describe('sacredWeaponHandler', () => {
    it('returns modal when activating with options', async () => {
        vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((target, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'channelDivinityCharges') return 2;
            return null;
        });

        const action = makeAction();
        const playerStats = makePlayerStats();
        vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);

        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('sacredWeaponDamageType');
    });

    it('returns no-charges popup when channel divinity charges are 0', async () => {
        vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((target, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'channelDivinityCharges') return 0;
            return null;
        });

        const action = makeAction();
        const playerStats = makePlayerStats();

        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
    });

    it('returns popup when activating without options', async () => {
        const action = makeAction({ automation: { ...makeAction().automation, options: [] } });

        vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((target, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'channelDivinityCharges') return 2;
            return null;
        });

        const setMock = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);

        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Sacred Weapon activated');
        expect(result.payload.description).toContain('bright light');
        expect(result.payload.description).toContain('Charisma modifier');

        expect(setMock).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 1, campaignName);
        expect(setMock).toHaveBeenCalledWith('TestHero', 'activeBuffs', expect.any(Array), campaignName);
    });

    it('ends sacred weapon when toggled off', async () => {
        vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((target, key) => {
            if (key === 'activeBuffs') return [{ name: 'Sacred Weapon', effect: 'sacred_weapon' }];
            return null;
        });

        const setMock = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);

        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Sacred Weapon ended');
        expect(setMock).toHaveBeenCalledWith('TestHero', 'activeBuffs', [], campaignName);
    });

    it('applies damage type choice correctly', async () => {
        vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((target, key) => {
            if (key === 'activeBuffs') return [{ name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: null }];
            return null;
        });

        const setMock = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);

        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await applyDamageTypeChoice(action, playerStats, campaignName, 'Radiant Damage');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Radiant');
        expect(setMock).toHaveBeenCalledWith('TestHero', 'activeBuffs', expect.arrayContaining([
            expect.objectContaining({ damageTypeChoice: 'Radiant' })
        ]), campaignName);
    });

    it('applies normal damage type choice correctly', async () => {
        vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((target, key) => {
            if (key === 'activeBuffs') return [{ name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: null }];
            return null;
        });

        const setMock = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);

        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await applyDamageTypeChoice(action, playerStats, campaignName, 'Normal Damage Type');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('normal');
        expect(setMock).toHaveBeenCalledWith('TestHero', 'activeBuffs', expect.arrayContaining([
            expect.objectContaining({ damageTypeChoice: 'normal' })
        ]), campaignName);
    });

    it('uses class_specific.channel_divinity_charges as fallback', async () => {
        vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((target, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'channelDivinityCharges') return null;
            return null;
        });

        const setMock = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);

        const action = makeAction();
        const playerStats = makePlayerStats({
            level: 3,
            class: {
                class_levels: [
                    undefined, undefined, { channel_divinity: 0, class_specific: { channel_divinity_charges: 3 } },
                    undefined, undefined,
                ],
            },
        });

        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('modal');
        expect(setMock).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 2, campaignName);
    });

    it('decrements channel divinity charges when activating', async () => {
        vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((target, key) => {
            if (key === 'activeBuffs') return [];
            if (key === 'channelDivinityCharges') return 2;
            return null;
        });

        const setMock = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);

        const action = makeAction({ automation: { ...makeAction().automation, options: [] } });
        const playerStats = makePlayerStats();

        await handle(action, playerStats, campaignName);

        expect(setMock).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 1, campaignName);
    });
});
