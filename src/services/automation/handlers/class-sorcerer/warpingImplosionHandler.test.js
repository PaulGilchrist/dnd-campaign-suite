import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 30, rolls: [10, 10, 10], modifier: 0 })),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../../hooks/useRuntimeState.js', () => {
    const mockFn = vi.fn((_playerName, _key, _campaignName) => {
        if (_key === 'aquaticAffinityEmanationRange') return null;
        return 1;
    });
    return { getRuntimeValue: mockFn, setRuntimeValue: vi.fn().mockResolvedValue(undefined) };
});

vi.mock('../../../../hooks/useMetamagic.js', () => ({
    getCurrentSorceryPoints: vi.fn(() => 10),
    spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => ({ maxSorceryPoints: 10 })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 15),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(() => null),
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

import { handle, applyWarpingImplosion } from './warpingImplosionHandler.js';
import * as runtimeState from '../../../../hooks/useRuntimeState.js';
import * as metamagic from '../../../../hooks/useMetamagic.js';

// ── Helpers ───────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        level: 18,
        proficiencyBonus: 6,
        abilities: [
            { name: 'Charisma', bonus: 4 },
        ],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Warping Implosion',
        automation: {
            type: 'save_attack',
            action: 'action',
            casting_time: '1 action',
            damage: '3d10',
            damageType: 'Force',
            saveType: 'STR',
            saveDc: 'ability',
            saveAbility: 'CHA',
            shape: 'emanation_30ft',
            range: '30_ft',
            uses: 1,
            recharge: 'long_rest',
            resourceCost: 'sorcery_points',
            restoreCost: 5,
            hasOptions: true,
            optionDetails: {},
            ...overrides,
        },
    };
}

describe('warpingImplosionHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns modal with correct payload', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();
            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('warpingImplosion');
            expect(result.payload.saveType).toBe('STR');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.rangeFeet).toBe(30);
            expect(result.payload.teleportRange).toBe(120);
            expect(result.payload.damageType).toBe('Force');
            expect(result.payload.canRestore).toBe(true);
            expect(result.payload.hasRemaining).toBe(true);
        });

        it('returns popup when no uses and cannot restore', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();
            runtimeState.getRuntimeValue.mockReturnValue(0);
            metamagic.getCurrentSorceryPoints.mockReturnValue(2);

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No remaining uses');
        });
    });

    describe('applyWarpingImplosion', () => {
        it('returns popup when no uses remaining', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await applyWarpingImplosion(
                action,
                playerStats,
                campaignName,
                [],
                null,
                false
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No remaining uses');
        });

        it('spends sorcery points when restoring', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats();
            runtimeState.getRuntimeValue.mockReturnValue(1);
            metamagic.getCurrentSorceryPoints.mockReturnValue(10);

            const result = await applyWarpingImplosion(
                action,
                playerStats,
                campaignName,
                ['Enemy1'],
                { gridX: 5, gridY: 5 },
                true
            );

            expect(metamagic.spendSorceryPoints).toHaveBeenCalled();
            expect(result.type).toBe('roll');
            expect(result.payload.rollType).toBe('damage');
            expect(result.payload.name).toBe('Warping Implosion');
        });
    });
});
