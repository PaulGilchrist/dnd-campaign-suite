import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    getCombatContext: vi.fn(),
    getResistanceNotice: vi.fn(),
    getAttackerTargetName: vi.fn(),
}));

vi.mock('../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
    computeRangeEffect: vi.fn(),
    computeMeleeProximityEffect: vi.fn(),
    getDistanceFeet: vi.fn(),
    isHostileNPC: vi.fn(),
    getNearestPlacedItem: vi.fn(),
    rangeToFeet: vi.fn(),
}));

vi.mock('../../rules/combat/coverService.js', () => ({
    computeCover: vi.fn(),
}));

vi.mock('../../npcs/npcsService.js', () => ({
    loadNPCs: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { buildAttackContextForDamage } from './damageRoll.js';
import * as damageUtils from '../../rules/combat/damageUtils.js';
import * as mapsService from '../../maps/mapsService.js';
import * as npcsService from '../../npcs/npcsService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as rangeValidation from '../../rules/combat/rangeValidation.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'Attacker';

// ── buildAttackContextForDamage (no map) ───────────────────────

describe('buildAttackContextForDamage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        damageUtils.getCombatContext.mockResolvedValue(null);
        damageUtils.getTargetFromAttacker.mockReturnValue(null);
        damageUtils.getResistanceNotice.mockReturnValue(null);
        damageUtils.getAttackerTargetName.mockReturnValue(undefined);
        mapsService.loadMapData.mockResolvedValue(null);
        npcsService.loadNPCs.mockResolvedValue([]);
        runtimeState.getRuntimeValue.mockReturnValue(null);
        rangeValidation.rangeToFeet.mockReturnValue(0);
        rangeValidation.getDistanceFeet.mockReturnValue(5);
    });

    function makeAttackContext(overrides = {}) {
        return {
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            saveSuccess: 0,
            ...overrides,
        };
    }

    describe('without map (mapName falsy)', () => {
        it('returns basic context with all expected fields', async () => {
            const attackContext = makeAttackContext();

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.damageType).toBe('fire');
            expect(result.resistanceNotice).toBeNull();
            expect(result.targetName).toBeUndefined();
            expect(result.saveDc).toBe(15);
            expect(result.saveType).toBe('DEX');
            expect(result.dcSuccess).toBe(0);
            expect(result.attackerName).toBe(playerName);
            expect(mapsService.loadMapData).not.toHaveBeenCalled();
            expect(npcsService.loadNPCs).not.toHaveBeenCalled();
        });

        it('falls back saveDc to 0 when not provided', async () => {
            const attackContext = makeAttackContext({ saveDc: undefined });

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.saveDc).toBe(0);
        });

        it('resolves target from combat context', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            const attackContext = makeAttackContext();

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.targetName).toBe('Goblin');
            expect(damageUtils.getTargetFromAttacker).toHaveBeenCalledWith({ creatures: [] }, playerName);
        });

        it('falls back to getAttackerTargetName when getTargetFromAttacker returns null', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue('Falling Victim');

            const attackContext = makeAttackContext();

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.targetName).toBe('Falling Victim');
        });

        it('returns null resistanceNotice when no target found', async () => {
            damageUtils.getCombatContext.mockResolvedValue(null);
            damageUtils.getTargetFromAttacker.mockReturnValue(null);

            const attackContext = makeAttackContext();

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.resistanceNotice).toBeNull();
        });

        it('includes resistanceNotice when target is resistant', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue({
                name: 'Goblin',
                resistances: ['fire'],
                immunities: [],
            });
            damageUtils.getResistanceNotice.mockReturnValue('Target is resistant to fire');

            const attackContext = makeAttackContext();

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.resistanceNotice).toBe('Target is resistant to fire');
            expect(damageUtils.getResistanceNotice).toHaveBeenCalledWith(
                ['fire'],
                ['fire'],
                [],
                'Goblin',
            );
        });

        it('passes saveSuccess from attackContext to result.dcSuccess', async () => {
            const attackContext = makeAttackContext({ saveSuccess: 0.5 });

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.dcSuccess).toBe(0.5);
        });
    });

    describe('buildSyncCtx fallback', () => {
        beforeEach(() => {
            damageUtils.getCombatContext.mockResolvedValue(null);
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getResistanceNotice.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
        });

        it('defaults saveDc to 0 when attackContext saveDc is undefined', async () => {
            const attackContext = makeAttackContext({ saveDc: undefined });
            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);
            expect(result.saveDc).toBe(0);
        });

        it('defaults saveDc to 0 when attackContext saveDc is 0', async () => {
            const attackContext = makeAttackContext({ saveDc: 0 });
            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);
            expect(result.saveDc).toBe(0);
        });
    });
});
