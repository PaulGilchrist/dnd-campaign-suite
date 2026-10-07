// FT-107: Mounted Combatant (2024) — consumers (conditionEffectsInternal
// mountedAndTargetSmaller, reactionBonusHandler Leap Aside/Veer, hitResolution
// runVeerRedirect) existed with ZERO producers. mountService is the
// producer seam: one merged rider-store write (mountName + mountSize, §39),
// mountedBy on the mount store, full-store combatSummary stamp
// (isMounted/mountSize), ability_use `Mount`/`Dismount` logs, and
// `mount_refused`/`dismount_refused` automation refusals (§41). The
// advantage-fold legs drive the REAL saveModifierApplies through the
// stamped combatSummary.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getMountCandidates,
    mountRider,
    dismountRider,
} from './mountService.js';
import { saveModifierApplies } from '../../combat/conditions/conditionEffectsInternal.js';

const runtimeStore = new Map();
let combatSummary = null;
let loggedEntries = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((characterKey, propertyName) => {
        const store = runtimeStore.get(characterKey) || {};
        return store[propertyName] ?? null;
    }),
    setRuntimeObject: vi.fn((characterKey, fullObject) => {
        const store = runtimeStore.get(characterKey) || {};
        runtimeStore.set(characterKey, { ...store, ...fullObject });
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
        const store = runtimeStore.get(characterKey) || {};
        store[propertyName] = value;
        runtimeStore.set(characterKey, store);
    }),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => combatSummary),
    setCombatSummaryCache: vi.fn((summary) => { combatSummary = summary; }),
}));

vi.mock('../../ui/storage.js', () => ({
    default: { set: vi.fn(() => Promise.resolve()) },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn((campaignName, entry) => {
        loggedEntries.push(entry);
        return Promise.resolve();
    }),
}));

import storage from '../../ui/storage.js';
import { setRuntimeObject } from '../../../hooks/runtime/useRuntimeState.js';

const RIDER = 'EvasiveFighter';
const CAMPAIGN = 'test-campaign';

function board() {
    combatSummary = {
        round: 1,
        creatures: [
            { name: RIDER, type: 'player', targetName: 'Goblin' },
            { name: 'Pony', type: 'npc', monsterType: 'Beast', size: 'Medium', targetName: null },
            { name: 'Goblin', type: 'npc', monsterType: 'humanoid', size: 'Small', targetName: null },
        ],
    };
}

function mountedStrikeModifier() {
    return {
        source: 'Mounted Combatant',
        target: 'attack_rolls_vs_unmounted_near_mount',
        condition: 'mounted_and_target_one_size_smaller',
        effect: 'advantage',
        abilities: [],
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    runtimeStore.clear();
    loggedEntries = [];
    board();
});

describe('getMountCandidates', () => {
    it('lists non-player combatants with size and monsterType', () => {
        const candidates = getMountCandidates(CAMPAIGN);
        expect(candidates.map(c => c.name)).toEqual(['Pony', 'Goblin']);
        expect(candidates[0]).toEqual({ name: 'Pony', size: 'Medium', monsterType: 'Beast' });
    });

    it('excludes mounts already mountedBy another rider', () => {
        runtimeStore.set('Pony', { mountedBy: 'SomeoneElse' });
        expect(getMountCandidates(CAMPAIGN).map(c => c.name)).toEqual(['Goblin']);
    });
});

describe('mountRider', () => {
    it('stamps mountName+mountSize on the rider in ONE merged store write and mountedBy on the mount store', async () => {
        const res = await mountRider(RIDER, 'Pony', CAMPAIGN);
        expect(res.ok).toBe(true);
        expect(setRuntimeObject).toHaveBeenCalledTimes(1);
        expect(setRuntimeObject).toHaveBeenCalledWith(RIDER, { mountName: 'Pony', mountSize: 'Medium' }, CAMPAIGN);
        expect(runtimeStore.get('Pony').mountedBy).toBe(RIDER);
        expect(runtimeStore.get(RIDER).mountName).toBe('Pony');
    });

    it('stamps isMounted + mountSize on the rider combatSummary entry and mountedBy on the mount entry (full-store POST)', async () => {
        await mountRider(RIDER, 'Pony', CAMPAIGN);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), CAMPAIGN);
        const posted = storage.set.mock.calls[0][1];
        const rider = posted.creatures.find(c => c.name === RIDER);
        const mount = posted.creatures.find(c => c.name === 'Pony');
        expect(rider.isMounted).toBe(true);
        expect(rider.mountSize).toBe('Medium');
        expect(mount.mountedBy).toBe(RIDER);
    });

    it('logs an ability_use Mount entry carrying rider and mount names', async () => {
        await mountRider(RIDER, 'Pony', CAMPAIGN);
        const mountLog = loggedEntries.find(e => e.abilityName === 'Mount');
        expect(mountLog.type).toBe('ability_use');
        expect(mountLog.characterName).toBe(RIDER);
        expect(mountLog.description).toContain('EvasiveFighter mounts Pony');
    });

    it('rides an advisory when the mount is not at least one size larger than the rider', async () => {
        const res = await mountRider(RIDER, 'Pony', CAMPAIGN, 'Medium');
        expect(res.ok).toBe(true);
        expect(res.advisory).toContain('at least one size larger');
        expect(loggedEntries.find(e => e.abilityName === 'Mount').description).toContain('Advisory');
    });

    it('refuses with mount_refused + no_target when no mount is chosen, zero writes', async () => {
        const res = await mountRider(RIDER, '', CAMPAIGN);
        expect(res.ok).toBe(false);
        const refusal = loggedEntries[0];
        expect(refusal.type).toBe('automation');
        expect(refusal.automationType).toBe('mount_refused');
        expect(refusal.automationDetail).toBe('no_target');
        expect(storage.set).not.toHaveBeenCalled();
        expect(setRuntimeObject).not.toHaveBeenCalled();
        expect(runtimeStore.get(RIDER)).toBeUndefined();
    });

    it('refuses mount_not_in_initiative for a mount absent from the combatSummary', async () => {
        const res = await mountRider(RIDER, 'Dragon', CAMPAIGN);
        expect(res.ok).toBe(false);
        expect(loggedEntries[0].automationDetail).toBe('mount_not_in_initiative');
        expect(storage.set).not.toHaveBeenCalled();
    });

    it('refuses an already-mounted mount, zero writes', async () => {
        runtimeStore.set('Pony', { mountedBy: 'Other Rider' });
        const res = await mountRider(RIDER, 'Pony', CAMPAIGN);
        expect(res.ok).toBe(false);
        expect(loggedEntries[0].automationType).toBe('mount_refused');
        expect(loggedEntries[0].automationDetail).toBe('already_mounted_by_Other Rider');
        expect(storage.set).not.toHaveBeenCalled();
    });

    it('stamps a clone and leaves the pre-mount cached entry unmutated', async () => {
        const before = combatSummary;
        await mountRider(RIDER, 'Pony', CAMPAIGN);
        const posted = storage.set.mock.calls[0][1];
        expect(posted).not.toBe(before);
        expect(before.creatures.find(c => c.name === RIDER).isMounted).toBeUndefined();
    });
});

describe('dismountRider', () => {
    it('clears mountName/mountSize/mountedBy on runtime and the combatSummary stamp, logging Dismount', async () => {
        await mountRider(RIDER, 'Pony', CAMPAIGN);
        vi.clearAllMocks();
        loggedEntries = [];

        const res = await dismountRider(RIDER, CAMPAIGN);
        expect(res.ok).toBe(true);
        expect(runtimeStore.get(RIDER).mountName).toBeNull();
        expect(runtimeStore.get(RIDER).mountSize).toBeNull();
        expect(runtimeStore.get('Pony').mountedBy).toBeNull();
        const posted = storage.set.mock.calls.at(-1)[1];
        const rider = posted.creatures.find(c => c.name === RIDER);
        expect(rider.isMounted).toBe(false);
        expect(rider.mountSize).toBeNull();
        const dismountLog = loggedEntries.find(e => e.abilityName === 'Dismount');
        expect(dismountLog.type).toBe('ability_use');
        expect(dismountLog.description).toContain('EvasiveFighter dismounts Pony');
    });

    it('refuses dismount_refused + no_mount_active when nothing is mounted, zero writes', async () => {
        const res = await dismountRider(RIDER, CAMPAIGN);
        expect(res.ok).toBe(false);
        expect(loggedEntries[0].automationType).toBe('dismount_refused');
        expect(loggedEntries[0].automationDetail).toBe('no_mount_active');
        expect(storage.set).not.toHaveBeenCalled();
        expect(setRuntimeObject).not.toHaveBeenCalled();
    });
});

describe('attack-time advantage fold through conditionEffectsInternal', () => {
    const opts = () => ({
        modifier: mountedStrikeModifier(),
        saveType: null,
        abilityName: null,
        combatContext: combatSummary,
        attackerName: RIDER,
    });

    it('mounted rider vs smaller unmounted target within 5ft: mount stamp makes the modifier apply', async () => {
        await mountRider(RIDER, 'Pony', CAMPAIGN);
        combatSummary.activeCreatureName = RIDER;
        expect(saveModifierApplies(opts())).toBe(true);
    });

    it('control: after dismount the same modifier no longer applies', async () => {
        await mountRider(RIDER, 'Pony', CAMPAIGN);
        combatSummary.activeCreatureName = RIDER;
        expect(saveModifierApplies(opts())).toBe(true);
        await dismountRider(RIDER, CAMPAIGN);
        expect(saveModifierApplies(opts())).toBe(false);
    });

    it('no advantage before mounting (zero-producer fingerprint this ticket fixes)', () => {
        combatSummary.activeCreatureName = RIDER;
        expect(saveModifierApplies(opts())).toBe(false);
    });

    it('no advantage when the target is the same size as the mount', async () => {
        await mountRider(RIDER, 'Pony', CAMPAIGN);
        combatSummary.activeCreatureName = RIDER;
        combatSummary.creatures.find(c => c.name === RIDER).targetName = 'Pony';
        // target lookup resolves the mount itself — same size, no advantage
        expect(saveModifierApplies(opts())).toBe(false);
    });
});
