// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './combatStanceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

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

const campaignName = 'test-campaign';

function setupRageRuntime() {
    runtimeState.getRuntimeValue.mockImplementation((player, prop) => {
        if (prop === 'activeBuffs') return [];
        if (prop === 'ragePoints') return 6;
        return undefined;
    });
}

function makePounceBarbarian(overrides = {}) {
    return {
        name: 'DraconicDragon',
        level: 20,
        rules: '2024',
        race: { name: 'Dragonborn', speed: 30, subrace: { name: 'Red Dragonborn' } },
        automation: {
            specialActions: [
                { name: 'Instinctive Pounce', effect: 'rage_bonus_movement', distanceExpression: 'speed / 2', triggerOnRage: true },
            ],
            passives: [
                { name: 'Fast Movement', type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_heavy_armor' },
            ],
        },
        ...overrides,
    };
}

function makeRageAction() {
    return {
        name: 'Rage',
        automation: { type: 'combat_stance', effect: 'stance', options: [] },
    };
}

describe('combatStanceHandler — CLA-201 instinctive pounce numeric + log', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rage-entry popup states half the canonical speed (40 → 20 ft), not the 30 fallback', async () => {
        setupRageRuntime();

        const result = await handle(makeRageAction(), makePounceBarbarian({ speed: 40 }), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Instinctive Pounce');
        expect(result.payload.description).toContain('up to 20 feet');
        expect(result.payload.description).not.toContain('up to 15 feet');
    });

    it('rage-entry ability_use log carries the pounce advisory distance', async () => {
        setupRageRuntime();

        await handle(makeRageAction(), makePounceBarbarian({ speed: 40 }), campaignName);

        const entry = logService.addEntry.mock.calls
            .map(c => c[1])
            .find(e => e && e.type === 'ability_use' && e.abilityName === 'Rage');
        expect(entry).toBeDefined();
        expect(entry.description).toContain('Instinctive Pounce');
        expect(entry.description).toContain('20 feet');
    });

    it('pounce advisory is still logged when the rage entry routes to the teleport modal', async () => {
        setupRageRuntime();
        const ps = makePounceBarbarian({
            speed: 40,
            automation: {
                specialActions: [
                    { name: 'Instinctive Pounce', effect: 'rage_bonus_movement', distanceExpression: 'speed / 2', triggerOnRage: true },
                    { name: 'Berserker Teleport', effect: 'teleport_on_rage' },
                ],
                passives: [],
            },
        });

        const result = await handle(makeRageAction(), ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('teleport');
        const entry = logService.addEntry.mock.calls
            .map(c => c[1])
            .find(e => e && e.type === 'ability_use' && e.abilityName === 'Rage');
        expect(entry).toBeDefined();
        expect(entry.description).toContain('20 feet');
    });

    it('falls back to the race JSON base speed when no folded speed is present', async () => {
        setupRageRuntime();

        const result = await handle(makeRageAction(), makePounceBarbarian({ speed: undefined }), campaignName);

        expect(result.payload.description).toContain('up to 15 feet');
    });
});
