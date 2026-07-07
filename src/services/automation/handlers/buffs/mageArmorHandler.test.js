// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyMageArmor } from './mageArmorHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../../services/rules/combat/damageUtils.js';

import { resolveMapPositions } from '../../common/targetResolver.js';
import { postLogEntry } from '../../../../services/shared/logPoster.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn((r) => (r ? 5 : 0)),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../services/shared/logPoster.js', () => ({
    postLogEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const mapName = 'test-map';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestWizard',
        level: 5,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Mage Armor',
        spell: { range: 'Touch', duration: '8 hours', ...overrides.spell },
        automation: { type: 'mage_armor', ...overrides.automation },
    };
}

// ─── handle ───

describe('mageArmorHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns target selection popup with creature list when combat context exists', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Ally1', type: 'player' },
                { name: 'TestWizard', type: 'player' },
                { name: 'Enemy1', type: 'npc' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('mage_armor_target_selection');
        expect(result.payload.name).toBe('Mage Armor');
        expect(result.payload.creatureTargets).toEqual(['Ally1', 'Enemy1']);
        expect(result.payload.duration).toBe('8 hours');
        expect(result.payload.range).toBe('Touch');
        expect(result.payload).toHaveProperty('rangeFt');
        expect(result.payload.attackerPos).toBeNull();
    });

    it('uses custom spell range and duration when provided', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const result = await handle(makeAction({ spell: { range: '60 feet', duration: '1 hour' } }), makePlayerStats(), campaignName, null);

        expect(result.payload.range).toBe('60 feet');
        expect(result.payload.duration).toBe('1 hour');
    });

    it('defaults range to Touch and duration to 8 hours when spell is missing', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const result = await handle(
            { name: 'Mage Armor', automation: { type: 'mage_armor' } },
            makePlayerStats(),
            campaignName,
            null,
        );

        expect(result.payload.range).toBe('Touch');
        expect(result.payload.duration).toBe('8 hours');
    });

    it('includes attackerPos when mapName is provided', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        resolveMapPositions.mockResolvedValue({ attackerPos: { x: 1, y: 2 } });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.attackerPos).toEqual({ x: 1, y: 2 });
        expect(resolveMapPositions).toHaveBeenCalledWith(campaignName, mapName, 'TestWizard');
    });

    it('returns automation_info popup when no combat context', async () => {
        getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No combat context found');
        expect(result.payload.description).toContain('Mage Armor');
    });

    it('returns popup with empty creature targets when combat context has no creatures', async () => {
        getCombatContext.mockResolvedValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('mage_armor_target_selection');
        expect(result.payload.creatureTargets).toEqual([]);
    });
});

// ─── applyMageArmor ───

describe('mageArmorHandler.applyMageArmor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('applies mage armor buff to target and returns info popup', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            return null;
        });

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(result).not.toBeNull();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('1 target(s)');
        expect(result.payload.description).toContain('+3 AC');

        const buffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCall).toBeDefined();
        expect(buffsCall[2]).toContainEqual(
            expect.objectContaining({
                name: 'Mage Armor',
                effect: 'mage_armor',
                acBonus: 3,
                sourceCharacter: 'TestWizard',
            }),
        );
    });

    it('does not apply buff if Mage Armor already active on target', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [{ name: 'Mage Armor', effect: 'mage_armor' }];
            return null;
        });

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(result.type).toBe('popup');
        const buffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCall).toBeUndefined();
    });

    it('applies buff to multiple targets', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            return null;
        });

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1', 'Ally2'],
        );

        expect(result.payload.description).toContain('2 target(s)');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'activeBuffs', expect.any(Array), campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally2', 'activeBuffs', expect.any(Array), campaignName);
    });

    it('skips targets that already have Mage Armor', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') {
                if (name === 'Ally1') return [{ name: 'Mage Armor', effect: 'mage_armor' }];
                return [];
            }
            return null;
        });

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1', 'Ally2'],
        );

        expect(result.payload.description).toContain('2 target(s)');
        const buffsCalls = setRuntimeValue.mock.calls.filter(
            (c) => c[1] === 'activeBuffs',
        );
        expect(buffsCalls.length).toBe(1);
        expect(buffsCalls[0][0]).toBe('Ally2');
    });

    it('returns null when targets is empty, null, or not an array', async () => {
        const emptyResult = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            [],
        );
        expect(emptyResult).toBeNull();

        const nullResult = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            null,
        );
        expect(nullResult).toBeNull();

        const strResult = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            'Ally1',
        );
        expect(strResult).toBeNull();
    });

    it('calls addExpiration for each target', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            return null;
        });

        await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1', 'Ally2'],
        );

        expect(addExpiration).toHaveBeenCalledWith(
            'TestWizard',
            'Ally1',
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'remove_active_buff',
                    buffName: 'Mage Armor',
                }),
            ]),
            campaignName,
        );
        expect(addExpiration).toHaveBeenCalledWith(
            'TestWizard',
            'Ally2',
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'remove_active_buff',
                    buffName: 'Mage Armor',
                }),
            ]),
            campaignName,
        );
    });

    it('handles activeBuffs not set (null stored value)', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return null;
            return null;
        });

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(result).not.toBeNull();
        const buffsCall = setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCall[2]).toContainEqual(
            expect.objectContaining({ name: 'Mage Armor' }),
        );
    });

    it('posts a log entry for each target', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            return null;
        });

        await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1', 'Ally2'],
        );

        expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestWizard',
            abilityName: 'Mage Armor',
            description: expect.stringContaining('TestWizard cast Mage Armor on Ally1'),
        });
        expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestWizard',
            abilityName: 'Mage Armor',
            description: expect.stringContaining('TestWizard cast Mage Armor on Ally2'),
        });
    });
});
