// @ai-generated
// SP-020 B2/B4: resolveCalmEmotionsEligibility — Humanoid-only + sphere gate.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    __esModule: true,
    default: { set: vi.fn() },
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../../../rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

import { resolveCalmEmotionsEligibility, CALM_EMOTIONS_DURATION_ROUNDS } from './calmEmotionsHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import { loadMapData } from '../../../maps/mapsService.js';

const campaignName = 'test-campaign';
const CASTER = 'Divine_Cleric';

const creatures = [
    { name: CASTER, type: 'player' },
    { name: 'Bandit 1', type: 'npc' },
    { name: 'Ogre 1', type: 'npc' },
    { name: 'Pseudodragon 1', type: 'npc' },
];

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation((entity, key) => {
        if (entity === '__map__' && key === 'activeMapName') return undefined;
        return undefined;
    });
    getMonsterData.mockImplementation(async (name) => {
        const n = String(name).toLowerCase();
        if (n.startsWith('pseudodragon')) return { name: 'Pseudodragon', type: 'Dragon' };
        if (n.startsWith('ogre')) return { name: 'Ogre', type: 'Giant' };
        if (n.startsWith('bandit')) return { name: 'Bandit', type: 'Humanoid' };
        return null;
    });
});

describe('resolveCalmEmotionsEligibility (SP-020 B2/B4)', () => {
    it('without an active map: everyone passes humanoid filter, sphere is lenient advisory', async () => {
        const res = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures });

        expect(res.eligible).toEqual([CASTER, 'Bandit 1']);
        expect(res.ineligible).toEqual(expect.arrayContaining([
            { name: 'Ogre 1', reason: 'not_humanoid' },
            { name: 'Pseudodragon 1', reason: 'not_humanoid' },
        ]));
        expect(res.advisory).toContain('no_map_lenient');
    });

    it('B2: keeps Humanoids, rejects non-Humanoids even when inside the sphere', async () => {
        getRuntimeValue.mockImplementation((entity, key) => {
            if (entity === '__map__' && key === 'activeMapName') return 'map1';
            return undefined;
        });
        loadMapData.mockResolvedValue({
            players: [{ name: CASTER, gridX: 0, gridY: 0 }, { name: 'Bandit 1', gridX: 1, gridY: 0 }],
            placedItems: [
                { name: 'Ogre 1', gridX: 1, gridY: 0 },
                { name: 'Pseudodragon 1', gridX: 1, gridY: 0 },
            ],
        });

        const res = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures });

        expect(res.eligible).toContain('Bandit 1');
        expect(res.ineligible.find(t => t.name === 'Pseudodragon 1').reason).toBe('not_humanoid');
        expect(res.ineligible.find(t => t.name === 'Ogre 1').reason).toBe('not_humanoid');
    });

    it('B4: applies the 20-foot sphere (4 cells) and records the out-of-sphere distance', async () => {
        getRuntimeValue.mockImplementation((entity, key) => {
            if (entity === '__map__' && key === 'activeMapName') return 'map1';
            return undefined;
        });
        loadMapData.mockResolvedValue({
            players: [{ name: CASTER, gridX: 0, gridY: 0 }],
            placedItems: [
                { name: 'Bandit 1', gridX: 4, gridY: 0 },
                { name: 'Ogre 1', gridX: 5, gridY: 0 },
            ],
        });
        getMonsterData.mockImplementation(async () => ({ type: 'Humanoid' }));

        const res = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures });

        expect(res.eligible).toContain('Bandit 1');
        expect(res.ineligible.find(t => t.name === 'Bandit 1')).toBeUndefined();
        expect(res.ineligible.find(t => t.name === 'Ogre 1').reason).toBe('out_of_sphere_25ft');
        expect(res.advisory).not.toContain('no_map_lenient');
    });

    it('B4: unplaced token on a positioned map passes with an advisory (playbook §42)', async () => {
        getRuntimeValue.mockImplementation((entity, key) => {
            if (entity === '__map__' && key === 'activeMapName') return 'map1';
            return undefined;
        });
        loadMapData.mockResolvedValue({
            players: [{ name: CASTER, gridX: 0, gridY: 0 }],
            placedItems: [{ name: 'Bandit 1', gridX: 2, gridY: 0 }],
        });

        const unplacedCreatures = [...creatures, { name: 'Cultist 1', type: 'npc' }];
        getMonsterData.mockImplementation(async (name) => {
            const n = String(name).toLowerCase();
            if (n.startsWith('cultist')) return { name: 'Cultist', type: 'Humanoid' };
            if (n.startsWith('bandit')) return { name: 'Bandit', type: 'Humanoid' };
            return null;
        });

        const res = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures: unplacedCreatures });

        expect(res.eligible).toContain('Bandit 1');
        expect(res.eligible).toContain('Cultist 1');
        expect(res.advisory).toContain('Cultist 1:unplaced_lenient');
        expect(res.ineligible.find(t => t.name === 'Cultist 1')).toBeUndefined();
    });

    it('lenient when the caster has no token on an active map', async () => {
        getRuntimeValue.mockImplementation((entity, key) => {
            if (entity === '__map__' && key === 'activeMapName') return 'map1';
            return undefined;
        });
        loadMapData.mockResolvedValue({
            players: [],
            placedItems: [{ name: 'Bandit 1', gridX: 9, gridY: 9 }],
        });

        const res = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures });

        expect(res.eligible).toEqual([CASTER, 'Bandit 1']);
        expect(res.advisory).toContain('caster_unplaced_lenient');
        expect(res.ineligible.find(t => t.name === 'Bandit 1')).toBeUndefined();
    });

    it('duration clock constant is 10 rounds (1 minute)', () => {
        expect(CALM_EMOTIONS_DURATION_ROUNDS).toBe(10);
    });
});
