import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    __esModule: true,
    default: {
        get: vi.fn(),
        set: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(),
}));

vi.mock('../../../encounters/encounterToInitiative.js', () => ({
    getMonsterSaveBonuses: vi.fn().mockReturnValue({}),
    getNextUniqueMonsterName: (baseName, creatures) => {
        const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const numberedPattern = new RegExp(`^${escaped} (\\d+)$`);
        let maxNum = 0;
        let hasExact = false;
        for (const c of creatures) {
            if (c.name === baseName) hasExact = true;
            const m = c.name.match(numberedPattern);
            if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
        }
        if (hasExact && maxNum === 0) return `${baseName} 1`;
        return `${baseName} ${maxNum + 1}`;
    },
}));

import { confirmAnimateDead } from './animateDeadHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import storage from '../../../ui/storage.js';

describe('SP-004 confirmAnimateDead - multi-cast name collision + te marker loss', () => {
    const mockSkeleton = {
        index: 'skeleton', name: 'Skeleton', type: 'Undead',
        armor_class: 13, hit_points: 13, damage_resistances: [],
        damage_immunities: [], immunities: [], saving_throws: {}, initiative_details: '+2',
    };
    const mockZombie = {
        index: 'zombie', name: 'Zombie', type: 'Undead',
        armor_class: 8, hit_points: 22, damage_resistances: [],
        damage_immunities: [], immunities: [], saving_throws: {}, initiative_details: '-1',
    };

    const caster = { name: 'DivinationWizard', level: 20 };
    const campaign = 'test-campaign';

    let cs;
    let storedTe;
    let teWrites;
    let writeOrder;

    function makeAction(slotLevel) {
        return { name: 'Animate Dead', automation: { type: 'animate_dead', slotLevel } };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        setRuntimeValue.mockResolvedValue(undefined);
        storage.set.mockResolvedValue(undefined);
        cs = { round: 1, creatures: [{ name: 'DivinationWizard', type: 'player', initiative: '10' }] };
        storedTe = [];
        teWrites = [];
        writeOrder = [];

        getCombatSummary.mockReturnValue(cs);
        getRuntimeValue.mockImplementation(() => storedTe);
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);

        storage.set.mockImplementation((key, value) => {
            writeOrder.push(`storage.set:${key}`);
            if (key === 'combatSummary') {
                cs = value;
            }
            return Promise.resolve();
        });
        setRuntimeValue.mockImplementation((characterKey, propertyName, value) => {
            writeOrder.push(`setRuntimeValue:${propertyName}`);
            teWrites.push(value);
            return Promise.resolve();
        });
    });

    function csNames() {
        return cs.creatures.map(c => c.name);
    }

    it('lv3 cast names distinct from existing bare-name combatant and te carries its marker', async () => {
        cs.creatures.push({ name: 'Skeleton', type: 'npc', initiative: '10' });
        storedTe = [{ target: 'Skeleton', source: 'DivinationWizard', effect: 'summoned' }];

        await confirmAnimateDead(makeAction(3), caster, campaign, { skeletonCount: 1 });

        const spawned = csNames().filter(n => n.startsWith('Skeleton') && n !== 'Skeleton');
        expect(spawned).toEqual(['Skeleton 1']);
        expect(teWrites).toHaveLength(1);
        expect(teWrites[0]).toContainEqual({ target: 'Skeleton 1', source: 'DivinationWizard', effect: 'summoned' });
    });

    it('second lv4 cast spawns 3 uniquely-numbered Skeletons, no duplicate bare name', async () => {
        await confirmAnimateDead(makeAction(3), caster, campaign, { skeletonCount: 1 });
        await confirmAnimateDead(makeAction(4), caster, campaign, { skeletonCount: 3 });

        const skeletonNames = csNames().filter(n => n.startsWith('Skeleton'));
        expect(skeletonNames).toEqual(['Skeleton 1', 'Skeleton 2', 'Skeleton 3', 'Skeleton 4']);
        expect(new Set(csNames()).size).toBe(csNames().length);
    });

    it('te keeps one summoned marker per spawned combatant across casts', async () => {
        await confirmAnimateDead(makeAction(3), caster, campaign, { skeletonCount: 1 });
        storedTe = teWrites[teWrites.length - 1];
        await confirmAnimateDead(makeAction(4), caster, campaign, { skeletonCount: 3 });

        const finalTe = teWrites[teWrites.length - 1];
        const summoned = finalTe.filter(te => te.effect === 'summoned' && te.source === 'DivinationWizard');
        expect(summoned.map(te => te.target)).toEqual(['Skeleton 1', 'Skeleton 2', 'Skeleton 3', 'Skeleton 4']);
    });

    it('te write is a new array, never an in-place mutation of the stored reference', async () => {
        storedTe = [{ target: 'Goblin', source: 'Other', effect: 'bleeding' }];
        const storedRef = storedTe;

        await confirmAnimateDead(makeAction(3), caster, campaign, { skeletonCount: 1 });

        const written = teWrites[0];
        expect(written).not.toBe(storedRef);
        expect(storedRef).toHaveLength(1);
        expect(written).toHaveLength(2);
    });

    it('writes combatSummary before targetEffects, sequentially awaited', async () => {
        await confirmAnimateDead(makeAction(4), caster, campaign, { skeletonCount: 3 });

        expect(writeOrder).toEqual(['storage.set:combatSummary', 'setRuntimeValue:targetEffects']);
    });

    it('mixed skeleton+zombie cast keeps unique names and per-spawn te for both types', async () => {
        await confirmAnimateDead(makeAction(3), caster, campaign, { skeletonCount: 1 });
        storedTe = teWrites[teWrites.length - 1];
        await confirmAnimateDead(makeAction(4), caster, campaign, { skeletonCount: 1, zombieCount: 2 });

        const names = csNames();
        expect(names.filter(n => n.startsWith('Skeleton'))).toEqual(['Skeleton 1', 'Skeleton 2']);
        expect(names.filter(n => n.startsWith('Zombie'))).toEqual(['Zombie 1', 'Zombie 2']);
        expect(new Set(names).size).toBe(names.length);

        const summonedTargets = teWrites[teWrites.length - 1]
            .filter(te => te.effect === 'summoned')
            .map(te => te.target);
        expect(summonedTargets).toEqual(expect.arrayContaining(['Skeleton 1', 'Skeleton 2', 'Zombie 1', 'Zombie 2']));
    });
});
