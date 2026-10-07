// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyMageArmor } from './mageArmorHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../../services/rules/combat/damageUtils.js';
import * as rangeValidation from '../../../../services/rules/combat/rangeValidation.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as logService from '../../../../services/ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

const CAMPAIGN_NAME = 'test-campaign';
const MAP_NAME = 'test-map';
const PLAYER_NAME = 'TestWizard';

function makePlayerStats(overrides = {}) {
    return { name: PLAYER_NAME, level: 5, ...overrides };
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
        rangeValidation.rangeToFeet.mockReturnValue(0);
    });

    it('returns target selection popup with creature list when combat context exists', async () => {
        combatData.getCombatContext.mockReturnValue({
            creatures: [
                { name: 'Ally1', type: 'player' },
                { name: PLAYER_NAME, type: 'player' },
                { name: 'Enemy1', type: 'npc' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('mage_armor_target_selection');
        expect(result.payload.name).toBe('Mage Armor');
        expect(result.payload.creatureTargets).toEqual(['Ally1', 'Enemy1']);
        expect(result.payload.duration).toBe('8 hours');
        expect(result.payload.range).toBe('Touch');
        expect(result.payload.attackerPos).toBeNull();
        expect(combatData.getCombatContext).toHaveBeenCalledWith(CAMPAIGN_NAME);
        expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('Touch');
    });

    it('uses custom spell range and duration when provided', async () => {
        combatData.getCombatContext.mockReturnValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const result = await handle(
            makeAction({ spell: { range: '60 feet', duration: '1 hour' } }),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
        );

        expect(result.payload.range).toBe('60 feet');
        expect(result.payload.duration).toBe('1 hour');
        expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('60 feet');
    });

    it('defaults range to Touch and duration to 8 hours when spell is missing', async () => {
        combatData.getCombatContext.mockReturnValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const result = await handle(
            { name: 'Mage Armor', automation: { type: 'mage_armor' } },
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
        );

        expect(result.payload.range).toBe('Touch');
        expect(result.payload.duration).toBe('8 hours');
    });

    it('includes attackerPos when mapName is provided', async () => {
        combatData.getCombatContext.mockReturnValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 1, y: 2 } });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, MAP_NAME);

        expect(result.payload.attackerPos).toEqual({ x: 1, y: 2 });
        expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(
            CAMPAIGN_NAME,
            MAP_NAME,
            PLAYER_NAME,
        );
    });

    it('sets attackerPos to null when no mapName is provided', async () => {
        combatData.getCombatContext.mockReturnValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

        expect(result.payload.attackerPos).toBeNull();
    });

    it('returns automation_info popup when no combat context', async () => {
        combatData.getCombatContext.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No combat context found');
        expect(result.payload.description).toContain('Mage Armor');
    });

    it('returns popup with empty creature targets when combat context has no creatures', async () => {
        combatData.getCombatContext.mockReturnValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('mage_armor_target_selection');
        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('returns empty creature targets when only the player exists in combat', async () => {
        combatData.getCombatContext.mockReturnValue({
            creatures: [{ name: PLAYER_NAME, type: 'player' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('defaults rangeFt to 0 when range string is unparseable', async () => {
        rangeValidation.rangeToFeet.mockReturnValue(0);
        combatData.getCombatContext.mockReturnValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        const result = await handle(
            makeAction({ spell: { range: 'invalid range' } }),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
        );

        expect(result.payload.rangeFt).toBe(0);
    });
});

// ─── applyMageArmor ───

describe('mageArmorHandler.applyMageArmor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when targets is empty, null, or not an array', async () => {
        expect(
            await applyMageArmor(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, []),
        ).toBeNull();

        expect(
            await applyMageArmor(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, null),
        ).toBeNull();

        expect(
            await applyMageArmor(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, 'Ally1'),
        ).toBeNull();
    });

    it('applies mage armor buff to target and returns info popup', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'activeBuffs') return [];
            return null;
        });

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Ally1'],
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('1 target(s)');
        expect(result.payload.description).toContain('Mage Armor');

        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            CAMPAIGN_NAME,
        );

        const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCall).toBeDefined();
        expect(buffsCall[2]).toContainEqual(
            expect.objectContaining({
                name: 'Mage Armor',
                effect: 'mage_armor',
                baseAc: 13,
                sourceCharacter: PLAYER_NAME,
            }),
        );
    });

    it('does not apply buff if Mage Armor already active on target', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'activeBuffs') return [{ name: 'Mage Armor', effect: 'mage_armor' }];
            return null;
        });

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Ally1'],
        );

        expect(result.type).toBe('popup');
        const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCall).toBeUndefined();
    });

    it('applies buff to multiple targets', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'activeBuffs') return [];
            return null;
        });

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Ally1', 'Ally2'],
        );

        expect(result.payload.description).toContain('2 target(s)');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            expect.any(Array),
            CAMPAIGN_NAME,
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally2',
            'activeBuffs',
            expect.any(Array),
            CAMPAIGN_NAME,
        );
    });

    it('skips targets that already have Mage Armor', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') {
                if (name === 'Ally1') return [{ name: 'Mage Armor', effect: 'mage_armor' }];
                return [];
            }
            return null;
        });

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Ally1', 'Ally2'],
        );

        expect(result.payload.description).toContain('2 target(s)');
        const buffsCalls = runtimeState.setRuntimeValue.mock.calls.filter(
            (c) => c[1] === 'activeBuffs',
        );
        expect(buffsCalls.length).toBe(1);
        expect(buffsCalls[0][0]).toBe('Ally2');
    });

    it('handles target with null activeBuffs value', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'activeBuffs') return null;
            return null;
        });

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Ally1'],
        );

        expect(result.type).toBe('popup');
        const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCall[2]).toContainEqual(
            expect.objectContaining({ name: 'Mage Armor' }),
        );
    });

    it('handles target with non-array activeBuffs value', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'activeBuffs') return 'not-an-array';
            return null;
        });

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Ally1'],
        );

        expect(result.type).toBe('popup');
        const buffsCall = runtimeState.setRuntimeValue.mock.calls.find(
            (c) => c[0] === 'Ally1' && c[1] === 'activeBuffs',
        );
        expect(buffsCall[2]).toContainEqual(
            expect.objectContaining({ name: 'Mage Armor' }),
        );
    });

    it('SP-074 D3: registers ONE addExpiration clock rounds=4800 (8 hours × 600, §38) per stamped target', async () => {
        runtimeState.getRuntimeValue.mockReturnValue([]);

        await applyMageArmor(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

        expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
        expect(expirations.addExpiration).toHaveBeenCalledWith({
            attackerName: PLAYER_NAME,
            targetName: 'Ally1',
            effects: [{ type: 'remove_active_buff', buffName: 'Mage Armor' }],
            campaignName: CAMPAIGN_NAME,
            rounds: 4800,
        });
    });

    it('SP-074 D3: no clock registered when the target already has Mage Armor (no existing-buff write)', async () => {
        runtimeState.getRuntimeValue.mockReturnValue([{ name: 'Mage Armor', effect: 'mage_armor' }]);

        await applyMageArmor(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);

        expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('SP-074 D3: custom durations encode hours×600 / minutes×10, unparseable stays undefined', async () => {
        // fresh [] per read — the handler splices the returned array in place
        runtimeState.getRuntimeValue.mockImplementation(() => []);

        await applyMageArmor(makeAction({ spell: { duration: '1 hour' } }), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);
        expect(expirations.addExpiration.mock.calls[0][0].rounds).toBe(600);

        await applyMageArmor(makeAction({ spell: { duration: '10 minutes' } }), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally2']);
        expect(expirations.addExpiration.mock.calls[1][0].rounds).toBe(100);

        await applyMageArmor(makeAction({ spell: { duration: 'special' } }), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally3']);
        expect(expirations.addExpiration.mock.calls[2][0].rounds).toBeUndefined();
    });

    it('posts a log entry for each target', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'activeBuffs') return [];
            return null;
        });

        await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Ally1', 'Ally2'],
        );

        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
            type: 'ability_use',
            characterName: PLAYER_NAME,
            abilityName: 'Mage Armor',
            description: expect.stringContaining(
                `${PLAYER_NAME} cast Mage Armor on Ally1`,
            ),
        });
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
            type: 'ability_use',
            characterName: PLAYER_NAME,
            abilityName: 'Mage Armor',
            description: expect.stringContaining(
                `${PLAYER_NAME} cast Mage Armor on Ally2`,
            ),
        });
    });
});
