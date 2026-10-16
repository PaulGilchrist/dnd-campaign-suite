// @maintained-by-ai
/**
 * animateDead SEXTET lane #1866 multicast — per the seam map in
 * animateDeadHandler.confirm.details.test.js, this lane owns the MULTI-cast
 * behaviour of confirmAnimateDead (repeated confirms against one campaign):
 *  - getNextUniqueMonsterName seam: bare-name collision resolves to
 *    '<base> 1', numbering continues monotonically across casts — exact
 *    name-array equality + Set-size pins (REPO SOLE HOME of the uniqueness
 *    canon; shed from #1865 confirm.main as its deletion reason)
 *  - te marker ACCUMULATION across casts through the runtime store: every
 *    spawned combatant keeps exactly one summoned marker, cs↔te parity
 *    (markers == spawned names), prior-cast markers preserved — the fake
 *    store round-trips setRuntimeValue writes back into the read side so
 *    accumulation flows through the mock, never manual re-arming
 *  - te write is a fresh array, never an in-place mutation of the stored ref
 *    (te-side guard; the combatSummary detached-clone pin is #1864)
 *  - write ORDER across multi-cast: each cast awaits storage.set('combatSummary')
 *    strictly before setRuntimeValue('targetEffects') — exact 4-step
 *    cs,te,cs,te sequence, no interleaving, zero turnState writes (off ⇒
 *    complements #1864's single-cast zero-write pin)
 *  - mixed skeleton+zombie multi-cast: per-type unique numbering + exact
 *    cross-type te order (skeletons-then-zombies per cast, appended)
 *
 * NOT this lane: write CONTENT / exact 4-arg / log / dispatch / metadata /
 * turnLock-on (#1864 storage), initiative share/fallback/sort (#1863),
 * spawn stat assembly + popup prose (details lane), zero-total + field
 * spot-checks (#1865), modal dispatch + upcast table (#1867).
 *
 * Deterministic: every external seam mocked; enforcement router returns
 * undefined → resolveEnforcement defaults (turnLock off, zero turnState
 * writes); caster's stated initiative '10' keeps resolveCasterInitiative
 * roll-free; V8 stable sort keeps insertion order across ties.
 * makeAction takes ONLY slotLevel — counts flow through confirm's 4th arg;
 * there is no overrides parameter, so no replace-wholesale hazard (checked
 * per house rule). No game timers.
 */
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
        cs = { round: 1, creatures: [{ name: 'DivinationWizard', type: 'player', initiative: '10' }] };
        storedTe = [];
        teWrites = [];
        writeOrder = [];

        getCombatSummary.mockReturnValue(cs);
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);

        // Router over propertyName — never answer-everything: enforcement falls
        // through to undefined → resolveEnforcement defaults (turnLock off).
        getRuntimeValue.mockImplementation((_entity, key) =>
            key === 'targetEffects' ? storedTe : undefined);

        storage.set.mockImplementation((key, value) => {
            writeOrder.push(`storage.set:${key}`);
            if (key === 'combatSummary') {
                cs = value;
            }
            return Promise.resolve();
        });
        // Honest fake runtime store: te writes round-trip into the read side,
        // so multi-cast accumulation flows through persistence (never manual
        // re-arming — that re-arm once hid the marker-loss bug itself).
        setRuntimeValue.mockImplementation((characterKey, propertyName, value) => {
            writeOrder.push(`setRuntimeValue:${propertyName}`);
            teWrites.push(value);
            if (propertyName === 'targetEffects') {
                storedTe = value;
            }
            return Promise.resolve();
        });
    });

    function csNames() {
        return cs.creatures.map(c => c.name);
    }

    function summonedTargets(teArray) {
        return teArray
            .filter(te => te.effect === 'summoned' && te.source === caster.name)
            .map(te => te.target);
    }

    it('lv3 cast names distinct from existing bare-name combatant, te pins stored marker + new marker exactly', async () => {
        cs.creatures.push({ name: 'Skeleton', type: 'npc', initiative: '10' });
        storedTe = [{ target: 'Skeleton', source: caster.name, effect: 'summoned' }];

        await confirmAnimateDead(makeAction(3), caster, campaign, { skeletonCount: 1 });

        const spawned = csNames().filter(n => n.startsWith('Skeleton') && n !== 'Skeleton');
        expect(spawned).toEqual(['Skeleton 1']);
        expect(teWrites).toHaveLength(1);
        // Strict table: bare-name marker preserved verbatim, spawn marker appended —
        // toContainEqual once passed while reordering/duplicating slipped through.
        expect(teWrites[0]).toEqual([
            { target: 'Skeleton', source: caster.name, effect: 'summoned' },
            { target: 'Skeleton 1', source: caster.name, effect: 'summoned' },
        ]);
    });

    it('second lv4 cast spawns 3 uniquely-numbered Skeletons, no duplicate bare name', async () => {
        await confirmAnimateDead(makeAction(3), caster, campaign, { skeletonCount: 1 });
        await confirmAnimateDead(makeAction(4), caster, campaign, { skeletonCount: 3 });

        // Same cs object survives both casts (handler mutates + storage re-arms),
        // so cast 2's getNextUniqueMonsterName must continue cast 1's numbering.
        const skeletonNames = csNames().filter(n => n.startsWith('Skeleton'));
        expect(skeletonNames).toEqual(['Skeleton 1', 'Skeleton 2', 'Skeleton 3', 'Skeleton 4']);
        expect(new Set(csNames()).size).toBe(csNames().length);
    });

    it('te accumulates one summoned marker per spawned combatant across casts, matching cs', async () => {
        await confirmAnimateDead(makeAction(3), caster, campaign, { skeletonCount: 1 });
        // No manual re-arm: the fake store carried cast 1's marker into cast 2's read.
        await confirmAnimateDead(makeAction(4), caster, campaign, { skeletonCount: 3 });

        const summoned = summonedTargets(teWrites[teWrites.length - 1]);
        expect(summoned).toEqual(['Skeleton 1', 'Skeleton 2', 'Skeleton 3', 'Skeleton 4']);
        // cs↔te parity: exactly one marker per spawned combatant, none lost, none doubled.
        expect(summoned).toEqual(csNames().filter(n => n !== caster.name));
        expect(new Set(summoned).size).toBe(4);
    });

    it('te write is a new array, never an in-place mutation of the stored reference', async () => {
        storedTe = [{ target: 'Goblin', source: 'Other', effect: 'bleeding' }];
        const storedRef = storedTe;

        await confirmAnimateDead(makeAction(3), caster, campaign, { skeletonCount: 1 });

        const written = teWrites[0];
        expect(written).not.toBe(storedRef);
        expect(storedRef).toHaveLength(1);
        expect(written).toHaveLength(2);
        expect(storedTe).toBe(written);
    });

    it('multi-cast write order: each cast awaits combatSummary before targetEffects, never interleaved', async () => {
        await confirmAnimateDead(makeAction(3), caster, campaign, { skeletonCount: 1 });
        await confirmAnimateDead(makeAction(4), caster, campaign, { skeletonCount: 3 });

        // Serialised cs→te per cast: cast 2's te is built only after cast 1 is
        // fully persisted; turnLock off ⇒ zero turnState writes throughout.
        expect(writeOrder).toEqual([
            'storage.set:combatSummary',
            'setRuntimeValue:targetEffects',
            'storage.set:combatSummary',
            'setRuntimeValue:targetEffects',
        ]);
    });

    it('mixed skeleton+zombie cast keeps unique names and per-spawn te for both types', async () => {
        await confirmAnimateDead(makeAction(3), caster, campaign, { skeletonCount: 1 });
        await confirmAnimateDead(makeAction(4), caster, campaign, { skeletonCount: 1, zombieCount: 2 });

        const names = csNames();
        expect(names.filter(n => n.startsWith('Skeleton'))).toEqual(['Skeleton 1', 'Skeleton 2']);
        expect(names.filter(n => n.startsWith('Zombie'))).toEqual(['Zombie 1', 'Zombie 2']);
        expect(new Set(names).size).toBe(names.length);

        // Exact cross-type order (summonSwarm order: skeletons then zombies, appended).
        expect(summonedTargets(teWrites[teWrites.length - 1])).toEqual(['Skeleton 1', 'Skeleton 2', 'Zombie 1', 'Zombie 2']);
    });
});
