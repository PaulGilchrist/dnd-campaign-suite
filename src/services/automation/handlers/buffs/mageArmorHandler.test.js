// @maintained-by-ai: 2026-10-15
// Handler-contract lane for SP-074 Mage Armor (registry keys mage_armor /
// mage_armor_apply in automation/index.js). Pins the exact popup payloads of
// handle() and the exact activeBuffs stamp / addExpiration clock (§38 hours×600)
// / log rows of applyMageArmor(). Eligibility gate lives in spellGates.mageArmor
// lane; donning-strip in mageArmorService lane; AC math in rules-armorClass lane —
// deliberately not asserted here.
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

// The exact buff the handler stamps onto activeBuffs.
const MAGE_ARMOR_STAMP = {
    name: 'Mage Armor',
    effect: 'mage_armor',
    baseAc: 13,
    duration: '8 hours',
    sourceCharacter: PLAYER_NAME,
};

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

function emptyBuffsOnRead() {
    // fresh [] per read — the handler splices the returned array in place
    runtimeState.getRuntimeValue.mockImplementation(() => []);
}

// ─── handle ───

describe('mageArmorHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rangeValidation.rangeToFeet.mockReturnValue(0);
    });

    it('returns target selection popup excluding the caster, with attackerPos null off-map', async () => {
        combatData.getCombatContext.mockReturnValue({
            creatures: [
                { name: 'Ally1', type: 'player' },
                { name: PLAYER_NAME, type: 'player' },
                { name: 'Enemy1', type: 'npc' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'mage_armor_target_selection',
                name: 'Mage Armor',
                creatureTargets: ['Ally1', 'Enemy1'],
                range: 'Touch',
                rangeFt: 0,
                duration: '8 hours',
                attackerPos: null,
            },
        });
        expect(combatData.getCombatContext).toHaveBeenCalledWith(CAMPAIGN_NAME);
        expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('Touch');
    });

    it('passes custom range/duration through and defaults to Touch/8 hours when spell is missing', async () => {
        combatData.getCombatContext.mockReturnValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });

        rangeValidation.rangeToFeet.mockReturnValueOnce(60);
        const custom = await handle(
            makeAction({ spell: { range: '60 feet', duration: '1 hour' } }),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
        );
        expect(custom.payload.range).toBe('60 feet');
        expect(custom.payload.rangeFt).toBe(60);
        expect(custom.payload.duration).toBe('1 hour');

        const bare = await handle(
            { name: 'Mage Armor', automation: { type: 'mage_armor' } },
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
        );
        expect(bare.payload.range).toBe('Touch');
        expect(bare.payload.duration).toBe('8 hours');
        expect(rangeValidation.rangeToFeet).toHaveBeenLastCalledWith('Touch');
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
});

// ─── applyMageArmor ───

describe('mageArmorHandler.applyMageArmor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null with zero side effects when targets is empty, null, or not an array', async () => {
        for (const targets of [[], null, 'Ally1']) {
            expect(
                await applyMageArmor(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, targets),
            ).toBeNull();
        }

        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('stamps the exact mage_armor buff on the target and returns exact info popup', async () => {
        emptyBuffsOnRead();

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Ally1'],
        );

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Mage Armor',
                description: '1 target(s) received Mage Armor from Mage Armor. Base AC becomes 13 + Dexterity modifier.',
            },
        });
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            CAMPAIGN_NAME,
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            [MAGE_ARMOR_STAMP],
            CAMPAIGN_NAME,
        );
    });

    it('target already wearing Mage Armor: no activeBuffs write, no expiration clock, popup still returned', async () => {
        runtimeState.getRuntimeValue.mockReturnValue([MAGE_ARMOR_STAMP]);

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Ally1'],
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('1 target(s)');
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('applies the stamp to every target', async () => {
        emptyBuffsOnRead();

        const result = await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Ally1', 'Ally2'],
        );

        expect(result.payload.description).toContain('2 target(s)');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            [MAGE_ARMOR_STAMP],
            CAMPAIGN_NAME,
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally2',
            'activeBuffs',
            [MAGE_ARMOR_STAMP],
            CAMPAIGN_NAME,
        );
    });

    it('skips targets that already have Mage Armor mid-mixed-list', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') {
                if (name === 'Ally1') return [MAGE_ARMOR_STAMP];
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
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally2',
            'activeBuffs',
            [MAGE_ARMOR_STAMP],
            CAMPAIGN_NAME,
        );
    });

    it('replaces null or non-array activeBuffs reads with a clean [stamp] array', async () => {
        runtimeState.getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') {
                return name === 'Ally1' ? null : 'not-an-array';
            }
            return null;
        });

        await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Ally1', 'Ally2'],
        );

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            [MAGE_ARMOR_STAMP],
            CAMPAIGN_NAME,
        );
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally2',
            'activeBuffs',
            [MAGE_ARMOR_STAMP],
            CAMPAIGN_NAME,
        );
    });

    it('SP-074 D3: registers ONE addExpiration clock rounds=4800 (8 hours × 600, §38) per stamped target', async () => {
        emptyBuffsOnRead();

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

    it('SP-074 D3: custom durations encode hours×600 / minutes×10 / rounds×1, unparseable stays undefined', async () => {
        emptyBuffsOnRead();

        await applyMageArmor(makeAction({ spell: { duration: '1 hour' } }), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally1']);
        expect(expirations.addExpiration.mock.calls[0][0].rounds).toBe(600);

        await applyMageArmor(makeAction({ spell: { duration: '10 minutes' } }), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally2']);
        expect(expirations.addExpiration.mock.calls[1][0].rounds).toBe(100);

        await applyMageArmor(makeAction({ spell: { duration: '2 rounds' } }), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally3']);
        expect(expirations.addExpiration.mock.calls[2][0].rounds).toBe(2);

        await applyMageArmor(makeAction({ spell: { duration: 'special' } }), makePlayerStats(), CAMPAIGN_NAME, null, ['Ally4']);
        expect(expirations.addExpiration.mock.calls[3][0].rounds).toBeUndefined();
    });

    it('posts an exact ability_use log entry for each target', async () => {
        emptyBuffsOnRead();

        await applyMageArmor(
            makeAction(),
            makePlayerStats(),
            CAMPAIGN_NAME,
            null,
            ['Ally1', 'Ally2'],
        );

        expect(logService.addEntry).toHaveBeenCalledTimes(2);
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
            type: 'ability_use',
            characterName: PLAYER_NAME,
            abilityName: 'Mage Armor',
            description: `${PLAYER_NAME} cast Mage Armor on Ally1. Target's base AC becomes 13 + Dexterity modifier.`,
        });
        expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
            type: 'ability_use',
            characterName: PLAYER_NAME,
            abilityName: 'Mage Armor',
            description: `${PLAYER_NAME} cast Mage Armor on Ally2. Target's base AC becomes 13 + Dexterity modifier.`,
        });
    });
});
