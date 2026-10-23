// @maintained-by-ai
// FT-107 Mounted Combatant (2024) — PRODUCER lane audit.
// Disk identity: public/data/2024/feats.json feat row "Mounted Combatant"
// (benefit "Mounted Strike"); NOT a spell — the affordance is the char-sheet
// Mount/Dismount buttons (CharSummary.jsx useMountAffordances, the ONLY live
// importer of getMountCandidates/mountRider/dismountRider).
// This lane pins bytes THIS module composes: one merged rider-store write
// (mountName + mountSize, §39), mountedBy on the mount store, full-store
// combatSummary clone+POST (isMounted/mountSize/mountName/mountedBy), the
// Mount/Dismount ability_use and *_refused log envelopes (§41), and ONE
// end-to-end fold through the REAL saveModifierApplies (the consumer-side
// size-order census lives in conditionEffectsInternal.test.js and is not
// duplicated here).
// Export map: getMountCandidates/mountRider/dismountRider — live (CharSummary).
// MOUNTED_BY_KEY/MOUNT_NAME_KEY — demoted to module-locals #1388 (export-keyword
// drop, zero external importers); consumers read the raw literals ('mountedBy'
// hitResolution.js:90, 'mountName' reactionBonusHandler.js:511/581 and
// CharSheet.jsx:451) — the string contract is pinned BEHAVIORALLY below via the
// exact store-write tuples (raw literals in every assertion), so the former
// constant-identity pin block retires honest, not silently.
// No-clock scan: CLEAN — mount state is a turn-based latch (booleans/nulls
// cleared by the dismount seam); the only Date.now() bytes are log-entry
// timestamps (allowlisted logging category), frozen here for determinism.
// HP-pair scan: N/A — module writes no HP keys (mount HP stays on the mount's
// own row; grep 'HitPoints' this file: zero writes).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getMountCandidates,
    mountRider,
    dismountRider,
} from './mountService.js';
import { saveModifierApplies } from '../../combat/conditions/conditionEffectsInternal.js';
import { setRuntimeObject, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { setCombatSummaryCache } from '../../encounters/combatData.js';
import storage from '../../ui/storage.js';
import { addEntry } from '../../ui/logService.js';

const CAMPAIGN = 'test-campaign';
const RIDER = 'EvasiveFighter';
const FROZEN_TS = 1700000000000;

const runtimeStore = new Map();
let combatSummary = null;
let loggedEntries = [];

// Argument-keyed STATEFUL strict fakes: unknown campaign THROWS (source always
// threads campaignName through; a silently-wrong campaign is a cross-campaign
// write). Reader returns null for missing char/key, matching the real
// getRuntimeValue byte semantics (`hasKey ? store.get(...) : null`).
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((characterKey, propertyName) => {
        const store = runtimeStore.get(characterKey);
        return store && store.has(propertyName) ? store.get(propertyName) : null;
    }),
    setRuntimeObject: vi.fn((characterKey, fullObject, campaignName) => {
        if (campaignName !== CAMPAIGN) throw new Error(`strict fake: unknown campaign "${campaignName}"`);
        const store = runtimeStore.get(characterKey) || new Map();
        for (const [k, v] of Object.entries(fullObject)) store.set(k, v);
        runtimeStore.set(characterKey, store);
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value, campaignName) => {
        if (campaignName !== CAMPAIGN) throw new Error(`strict fake: unknown campaign "${campaignName}"`);
        const store = runtimeStore.get(characterKey) || new Map();
        store.set(propertyName, value);
        runtimeStore.set(characterKey, store);
    }),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn((campaignName) => {
        if (campaignName !== CAMPAIGN) throw new Error(`strict fake: unknown campaign "${campaignName}"`);
        return combatSummary;
    }),
    setCombatSummaryCache: vi.fn((summary, campaignName) => {
        if (campaignName !== CAMPAIGN) throw new Error(`strict fake: unknown campaign "${campaignName}"`);
        combatSummary = summary;
    }),
}));

vi.mock('../../ui/storage.js', () => ({
    default: {
        set: vi.fn((key, value, campaignName) => {
            if (campaignName !== CAMPAIGN) throw new Error(`strict fake: unknown campaign "${campaignName}"`);
            return Promise.resolve();
        }),
    },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn((campaignName, entry) => {
        if (campaignName !== CAMPAIGN) throw new Error(`strict fake: unknown campaign "${campaignName}"`);
        loggedEntries.push(entry);
        return Promise.resolve();
    }),
}));

function board(mounts = []) {
    combatSummary = {
        round: 1,
        activeCreatureName: RIDER,
        creatures: [
            { name: RIDER, type: 'player', targetName: 'Goblin' },
            { name: 'Pony', type: 'npc', monsterType: 'Beast', size: 'Medium', targetName: null },
            { name: 'Goblin', type: 'npc', monsterType: 'humanoid', size: 'Small', targetName: null },
            ...mounts,
        ],
    };
}

// Mounted Strike modifier shape as folded from the 2024 feats.json row.
const mountedStrike = {
    source: 'Mounted Combatant',
    target: 'attack_rolls_vs_unmounted_near_mount',
    condition: 'mounted_and_target_one_size_smaller',
    effect: 'advantage',
    abilities: [],
};
const foldOpts = () => ({
    modifier: mountedStrike,
    saveType: null,
    abilityName: null,
    combatContext: combatSummary,
});

function clearWrites() {
    setRuntimeObject.mockClear();
    setRuntimeValue.mockClear();
    setCombatSummaryCache.mockClear();
    storage.set.mockClear();
    loggedEntries = [];
}

beforeEach(() => {
    vi.clearAllMocks(); // impls are inline in vi.fn(impl) — retained (vitest 4)
    runtimeStore.clear();
    loggedEntries = [];
    board();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_TS);
});

afterEach(() => {
    vi.restoreAllMocks();
});

// #1388: 'exported store-key contract' pin retired — the two store-key
// constants are module-local now. The literal byte contract 'mountedBy'/
// 'mountName' is pinned by every behavior row below (setRuntimeObject/
// setRuntimeValue tuples + runtimeStore peeks use the raw literals).

describe('getMountCandidates', () => {
    it('filters players and mountedBy-latched combatants, coerces missing size/type to null, exact row shape', () => {
        runtimeStore.set('Pony', new Map([['mountedBy', 'Other']]));
        board([{ name: 'Mule', type: 'npc' }]); // no size, no monsterType
        expect(getMountCandidates(CAMPAIGN)).toEqual([
            { name: 'Goblin', size: 'Small', monsterType: 'humanoid' },
            { name: 'Mule', size: null, monsterType: null },
        ]);
        expect(() => getMountCandidates('not-a-campaign')).toThrow('strict fake: unknown campaign');
    });
});

describe('mountRider', () => {
    it('success writes the exact full-set envelope: one merged rider write (no skipSync), mountedBy on mount store, cloned stamped combatSummary POST + cache identity, Mount log without trailing period', async () => {
        const before = combatSummary;
        const res = await mountRider(RIDER, 'Pony', CAMPAIGN, 'Small');
        expect(res).toEqual({ ok: true, mountSize: 'Medium', advisory: '' });

        expect(setRuntimeObject).toHaveBeenCalledTimes(1);
        expect(setRuntimeObject).toHaveBeenCalledWith(RIDER, { mountName: 'Pony', mountSize: 'Medium' }, CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('Pony', 'mountedBy', RIDER, CAMPAIGN);
        expect(runtimeStore.get(RIDER).get('mountName')).toBe('Pony');
        expect(runtimeStore.get(RIDER).get('mountSize')).toBe('Medium');
        expect(runtimeStore.get('Pony').get('mountedBy')).toBe(RIDER);

        expect(storage.set).toHaveBeenCalledTimes(1);
        const posted = storage.set.mock.calls[0][1];
        expect(storage.set.mock.calls[0][0]).toBe('combatSummary');
        expect(posted).toEqual({
            round: 1,
            activeCreatureName: RIDER,
            creatures: [
                { name: RIDER, type: 'player', targetName: 'Goblin', isMounted: true, mountSize: 'Medium', mountName: 'Pony' },
                { name: 'Pony', type: 'npc', monsterType: 'Beast', size: 'Medium', targetName: null, mountedBy: RIDER },
                { name: 'Goblin', type: 'npc', monsterType: 'humanoid', size: 'Small', targetName: null },
            ],
        });
        expect(setCombatSummaryCache).toHaveBeenCalledTimes(1);
        expect(setCombatSummaryCache.mock.calls[0][0]).toBe(posted); // same ref POSTed and cached
        expect(posted).not.toBe(before); // clone contract: pre-mount cache untouched
        expect(before.creatures[0].isMounted).toBeUndefined();

        expect(loggedEntries).toEqual([{
            type: 'ability_use',
            characterName: RIDER,
            abilityName: 'Mount',
            description: 'EvasiveFighter mounts Pony',
            timestamp: FROZEN_TS,
        }]);
    });

    it.each([
        [
            'Medium mount vs Medium rider: size advisory, advantage still folds vs Small target',
            { name: 'Pony', type: 'npc', monsterType: 'Beast', size: 'Medium' }, 'Medium',
            ' Advisory: a mount should be at least one size larger than the rider (GM-advisory).', true,
        ],
        [
            'non-Beast humanoid mount: both advisories joined with "; "',
            { name: 'Orc', type: 'npc', monsterType: 'humanoid', size: 'Medium' }, 'Medium',
            ' Advisory: Orc is not a Beast or Vehicle (GM-advisory); a mount should be at least one size larger than the rider (GM-advisory).', true,
        ],
        [
            'missing size: coercion census stamps Medium and silently skips the size advisory (mount && guard)',
            { name: 'Mule', type: 'npc', monsterType: 'Beast' }, 'Medium', '', true,
        ],
        [
            'lowercase size: monsterType gate is toLowerCase-lenient but SIZE_ORDER.indexOf is case-strict — no advisory, size stamped VERBATIM, consumer silently sees no advantage',
            { name: 'Llama', type: 'npc', monsterType: 'beast', size: 'large' }, 'Medium', '', false,
        ],
    ])('%s', async (_name, mount, riderSize, expectedAdvisory, consumerApplies) => {
        board([mount]);
        const res = await mountRider(RIDER, mount.name, CAMPAIGN, riderSize);
        expect(res.ok).toBe(true);
        expect(res.advisory).toBe(expectedAdvisory);
        expect(loggedEntries[loggedEntries.length - 1].description).toBe(`${RIDER} mounts ${mount.name}${expectedAdvisory}`);
        expect(saveModifierApplies(foldOpts())).toBe(consumerApplies);
    });

    it.each([
        [
            'no mount chosen (empty template interpolation byte)', '', null, 'no_target', 'no_target',
            `${RIDER} tried to mount — refused (no_target). Zero mount state written.`,
        ],
        [
            'mount absent from initiative', 'Dragon', null, 'mount_not_in_initiative', 'mount_not_in_initiative',
            `${RIDER} tried to mount Dragon — refused (mount_not_in_initiative). Zero mount state written.`,
        ],
        [
            'mount already latched: raw rider name embedded in detail token (spaces included)', 'Pony',
            ['Pony', 'Other Rider'], 'already_mounted', 'already_mounted_by_Other Rider',
            `${RIDER} tried to mount Pony — refused (already_mounted_by_Other Rider). Zero mount state written.`,
        ],
    ])('refuses: %s', async (_name, mountArg, preset, reason, detail, description) => {
        if (preset) runtimeStore.set(preset[0], new Map([['mountedBy', preset[1]]]));
        const res = await mountRider(RIDER, mountArg, CAMPAIGN);
        expect(res).toEqual({ ok: false, reason });

        expect(loggedEntries).toEqual([{
            type: 'automation',
            automationType: 'mount_refused',
            automationDetail: detail,
            characterName: RIDER,
            abilityName: 'Mount',
            description,
            timestamp: FROZEN_TS,
        }]);
        expect(setRuntimeObject).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummaryCache).not.toHaveBeenCalled();
        expect(runtimeStore.has(RIDER)).toBe(false);
        if (preset) expect(runtimeStore.get(preset[0]).get('mountedBy')).toBe(preset[1]); // existing latch untouched
    });

    it('quirk: rider is NOT validated against initiative — Ghost mounts with runtime state + success log but zero combatSummary POST (Mounted Strike leg silently dead)', async () => {
        const res = await mountRider('Ghost', 'Pony', CAMPAIGN, 'Medium');
        expect(res).toEqual({ ok: true, mountSize: 'Medium', advisory: ' Advisory: a mount should be at least one size larger than the rider (GM-advisory).' });
        expect(runtimeStore.get('Ghost').get('mountName')).toBe('Pony');
        expect(runtimeStore.get('Pony').get('mountedBy')).toBe('Ghost');
        expect(storage.set).not.toHaveBeenCalled(); // stampCombatSummaryRider rider-miss aborts the whole POST
        expect(setCombatSummaryCache).not.toHaveBeenCalled();
        expect(combatSummary.creatures.find(c => c.name === 'Pony').mountedBy).toBeUndefined();
        expect(loggedEntries[0].description).toBe('Ghost mounts Pony Advisory: a mount should be at least one size larger than the rider (GM-advisory).');
    });
});

describe('dismountRider', () => {
    it('clears the latch to NULL (not deleted — strict reader pair with reactionBonusHandler), exact summary + log envelope with trailing period', async () => {
        await mountRider(RIDER, 'Pony', CAMPAIGN, 'Small');
        const before = combatSummary;
        clearWrites();

        const res = await dismountRider(RIDER, CAMPAIGN);
        expect(res).toEqual({ ok: true, mountName: 'Pony' });
        expect(setRuntimeObject).toHaveBeenCalledTimes(1);
        expect(setRuntimeObject).toHaveBeenCalledWith(RIDER, { mountName: null, mountSize: null }, CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('Pony', 'mountedBy', null, CAMPAIGN);
        expect(runtimeStore.get(RIDER).get('mountName')).toBeNull();
        expect(runtimeStore.get('Pony').get('mountedBy')).toBeNull();

        expect(storage.set).toHaveBeenCalledTimes(1);
        const posted = storage.set.mock.calls[0][1];
        expect(posted).toEqual({
            round: 1,
            activeCreatureName: RIDER,
            creatures: [
                { name: RIDER, type: 'player', targetName: 'Goblin', isMounted: false, mountSize: null, mountName: null },
                { name: 'Pony', type: 'npc', monsterType: 'Beast', size: 'Medium', targetName: null, mountedBy: null },
                { name: 'Goblin', type: 'npc', monsterType: 'humanoid', size: 'Small', targetName: null },
            ],
        });
        expect(posted).not.toBe(before);
        expect(setCombatSummaryCache.mock.calls[0][0]).toBe(posted);

        expect(loggedEntries).toEqual([{
            type: 'ability_use',
            characterName: RIDER,
            abilityName: 'Dismount',
            description: 'EvasiveFighter dismounts Pony.',
            timestamp: FROZEN_TS,
        }]);
    });

    it('refuses no_mount_active with zero writes when the rider latch is unset', async () => {
        const res = await dismountRider(RIDER, CAMPAIGN);
        expect(res).toEqual({ ok: false, reason: 'no_mount_active' });
        expect(loggedEntries).toEqual([{
            type: 'automation',
            automationType: 'dismount_refused',
            automationDetail: 'no_mount_active',
            characterName: RIDER,
            abilityName: 'Dismount',
            description: `${RIDER} tried to dismount — refused (no_mount_active). Zero mount state cleared.`,
            timestamp: FROZEN_TS,
        }]);
        expect(setRuntimeObject).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
    });

    it('quirk: with no combatSummary cached the runtime latch still clears and ok:true returns, zero summary POST (cs?.creatures guard skips POST silently)', async () => {
        await mountRider(RIDER, 'Pony', CAMPAIGN, 'Small');
        combatSummary = null;
        clearWrites();

        const res = await dismountRider(RIDER, CAMPAIGN);
        expect(res).toEqual({ ok: true, mountName: 'Pony' });
        expect(runtimeStore.get(RIDER).get('mountName')).toBeNull();
        expect(runtimeStore.get('Pony').get('mountedBy')).toBeNull();
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummaryCache).not.toHaveBeenCalled();
        expect(loggedEntries[0].description).toBe('EvasiveFighter dismounts Pony.');
    });
});

describe('producer→consumer fold (real saveModifierApplies, no mocks)', () => {
    it('full latch cycle: false pre-mount (zero-producer fingerprint) → true via stamp vs Small target with unset rangeToTarget (§42 gridless-lenient) → false after dismount', async () => {
        expect(saveModifierApplies(foldOpts())).toBe(false);
        await mountRider(RIDER, 'Pony', CAMPAIGN, 'Small');
        expect(saveModifierApplies(foldOpts())).toBe(true);
        await dismountRider(RIDER, CAMPAIGN);
        expect(saveModifierApplies(foldOpts())).toBe(false);
    });
});

describe('log failure never rolls back or flips the verdict', () => {
    it('addEntry rejection is swallowed with exact prefix + identical Error; mount state stays stamped', async () => {
        const err = new Error('log-service-down');
        addEntry.mockRejectedValueOnce(err);
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await mountRider(RIDER, 'Pony', CAMPAIGN, 'Small');
        expect(res).toEqual({ ok: true, mountSize: 'Medium', advisory: '' });
        expect(spy).toHaveBeenCalledWith('[mountService] Error:', err);
        expect(runtimeStore.get(RIDER).get('mountName')).toBe('Pony');
        expect(storage.set).toHaveBeenCalledTimes(1);
    });
});
