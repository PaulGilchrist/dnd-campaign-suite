// @maintained-by-ai
// CLA-311 Share Spells SERVICE (base) lane. Owns the trigger GATES of primalCompanionSpellShareService.js:
// passive-absent / self-target / cantrip / AoE-cast / companion-exists / companion-alive refusals, exact
// action-construction envelopes (disk-fronted fallbacks), the :0-swallow census on spellSlotLevel, executeHandler
// result pass-through by identity, rejection-swallow with exact console byte, and the golden TypeError pinned at
// service :16 via :34 (spell.range deref OUTSIDE try :69 — the chain lane's 'report only, not re-owned' note
// points HERE; it lives in 'golden TypeError' below).
// Owned elsewhere per the #1395 split — never re-grow here:
//   handler lane primalCompanionSpellShareHandler.test.js: guard popups, seeded dedupe, applySpellShare
//     modal-confirm, its :32 direct-call pin.
//   chain lane primalCompanionSpellShare.share-chain.test.js (cites this file at its :5): service->handler
//     composition seam — action.spell identity live-through-handler, real rangeToFeet gate, 6-read +
//     write-order store censuses, idempotent re-share.
// Zero dice, zero clocks, zero log writes in this lane: the service is read-only dispatch and console.errors
// only on guard/error paths. Write budget: zero writes (writes belong to the handler/chain lanes).
// Dead exports (0 prod callers): useCustomHandlers.js:168 and execution/index.js:531 call ONLY
// triggerPrimalCompanionSpellShare; hasShareSpells/getShareSpellsFeature keep their internal-lookup contract
// smoke here behind the trigger chokepoint.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    triggerPrimalCompanionSpellShare,
    hasShareSpells,
    getShareSpellsFeature,
} from './primalCompanionSpellShareService.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'TestRanger';
const COMPANION_TYPE = 'Beast of the Forest';
const TYPE_KEY = `${CASTER}.primalCompanionType`;
const ALIVE_KEY = `${CASTER}.primalCompanionAlive`;

// ---- disk canon (programmatic; loud preflight on drift, never silently defaulted) ----------------
function diskRow(file, predicate, what) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const row = data.find(predicate);
    if (!row) throw new Error(`disk preflight: missing ${what} in ${file}`);
    return row;
}
const SPELL = name => diskRow('public/data/spells.json', s => s.name === name, `spell '${name}'`);
const SHIELD = SPELL('Shield');               // L1 'Self' — golden share-front row
const PRODUCE_FLAME = SPELL('Produce Flame'); // L0 'Self' — REAL disk cantrip: passes range gate, dies at level===0
const GUIDANCE = SPELL('Guidance');           // L0 'Touch' — doubly refused (not self, cantrip)
const CURE_WOUNDS = SPELL('Cure Wounds');    // L1 'Touch' — isolates the self-target gate at leveled tier: disk 'Touch' is not 'Self'
const BLESS = SPELL('Bless');                 // L1 '30 feet' — fixed-range near-miss
// Disk passive row fronts the hardcoded fallback literals (service :58/:61/:62): fallback == disk canon is
// asserted against these bytes, not a test-local duplicate (chokepoint inline-dup watch #1357).
const SHARE_DISK = (() => {
    const classes = JSON.parse(readFileSync('public/data/2024/classes.json', 'utf8'));
    for (const cls of classes) {
        for (const major of cls.majors ?? []) {
            for (const feature of major.features ?? []) {
                if (feature.automation?.type === 'primal_companion_spell_share') return feature;
            }
        }
    }
    throw new Error('disk preflight: no primal_companion_spell_share row in public/data/2024/classes.json');
})();
// Flattened as the passive loader presents it (service reads type/name/description/range/casting_time).
const SHARE_PASSIVE = {
    type: 'primal_companion_spell_share',
    name: SHARE_DISK.name,
    description: SHARE_DISK.description,
    range: SHARE_DISK.automation.range,
    casting_time: SHARE_DISK.automation.casting_time,
};

// ---- strict argument-keyed store fake (#1372/93/95): unknown owner/key/campaign/arity THROWS ----
const store = {};
let reads = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, key, campaignName) => {
        if (typeof name !== 'string' || typeof key !== 'string') {
            throw new Error(`store fake: bad read args (${String(name)}, ${String(key)})`);
        }
        if (campaignName !== CAMPAIGN) {
            throw new Error(`store fake: read ${name}.${key} for off-target campaign ${String(campaignName)}`);
        }
        const ck = `${name}.${key}`;
        reads.push(ck);
        if (!(ck in store)) throw new Error(`store fake: unknown read ${ck}`);
        return store[ck];
    }),
    // service never writes; exporting an arity-throwing setRuntimeValue proves any new write is loud
    setRuntimeValue: vi.fn(() => {
        throw new Error('store fake: service lane must never write');
    }),
}));

// Dispatch fake: default resolves null (passthrough tests override with Once queues).
vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(() => Promise.resolve(null)),
}));

import { executeHandler } from '../../automation/index.js';

const stats = (passives = [SHARE_PASSIVE]) => ({ name: CASTER, automation: { passives } });
const trigger = (spell = SHIELD, metaCtx = {}, playerStats = stats(), mapName = 'test-map') =>
    triggerPrimalCompanionSpellShare(spell, metaCtx, playerStats, CAMPAIGN, mapName);

describe('primalCompanionSpellShareService', () => {
    beforeEach(() => {
        vi.resetAllMocks(); // factory-supplied implementations survive; once-queues + call records cleared
        reads = [];
        for (const k of Object.keys(store)) delete store[k];
        store[TYPE_KEY] = COMPANION_TYPE; // explicit re-seed (#1312)
        store[ALIVE_KEY] = true;
    });

    afterEach(() => {
        vi.restoreAllMocks(); // every console spy restored here, never mid-test-only
    });

    describe('passive lookup (internal contract behind every gate)', () => {
        it('finds the first Share Spells passive by identity; boolean wrapper mirrors hit/miss/empty', () => {
            const share = { ...SHARE_PASSIVE };
            const later = { ...SHARE_PASSIVE, name: 'Share Spells v2', range: '60_ft' };
            const hitStats = { name: CASTER, automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }, share, later] } };
            expect(getShareSpellsFeature(hitStats)).toBe(share); // first match, returned by identity
            expect(hasShareSpells(hitStats)).toBe(true);

            const miss = { name: CASTER, automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] } };
            expect(getShareSpellsFeature(miss)).toBeUndefined();
            expect(hasShareSpells(miss)).toBe(false);
            expect(hasShareSpells({ name: CASTER, automation: { passives: [] } })).toBe(false);
        });

        it('missing automation.passives THROWS golden guard message per falsy shape, each logged once', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            expect(() => hasShareSpells({ automation: { passives: null } })).toThrow('Expected array, got null');
            expect(() => hasShareSpells({ automation: {} })).toThrow('Expected array, got undefined');
            expect(() => hasShareSpells({})).toThrow('Expected array, got undefined');
            expect(consoleSpy).toHaveBeenCalledTimes(3);
            expect(consoleSpy).toHaveBeenCalledWith('[primalCompanionSpellShareService] Missing array:', null);
        });
    });

    describe('triggerPrimalCompanionSpellShare', () => {
        it('gate: no Share Spells passive -> null, store untouched, nothing dispatched', async () => {
            expect(await trigger(SHIELD, {}, stats([]))).toBeNull();
            expect(await trigger(SHIELD, {}, stats([{ type: 'post_cast_rider', name: 'Some Rider' }]))).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
            expect(reads).toEqual([]);
        });

        it('gate: non-self-range disk rows refused before any store read (Touch is NOT Self — disk decides)', async () => {
            for (const spell of [CURE_WOUNDS, BLESS, { name: 'Blank Range', level: 1, range: '' }, { name: 'No Range', level: 1 }]) {
                expect(await trigger(spell)).toBeNull();
            }
            expect(executeHandler).not.toHaveBeenCalled();
            expect(reads).toEqual([]);
        });

        it('gate: cantrips die at level===0 even when the range gate passes (real rows: Produce Flame, Guidance)', async () => {
            expect(await trigger(PRODUCE_FLAME)).toBeNull(); // disk-true: L0 + 'Self' -> only the cantrip gate can refuse it
            expect(await trigger(GUIDANCE)).toBeNull();        // L0 + 'Touch' -> refused at the range gate first
            expect(executeHandler).not.toHaveBeenCalled();
            expect(reads).toEqual([]);
        });

        it('gate: AoE casting (multiTarget or aoeTarget) refused before the companion store is read', async () => {
            expect(await trigger(SHIELD, { multiTarget: 'Goblin' })).toBeNull();
            expect(await trigger(SHIELD, { aoeTarget: 'area' })).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
            expect(reads).toEqual([]);
        });

        it('companion gates: absent type refuses (never reads alive); explicit-false refuses; null/undefined alive dispatches', async () => {
            for (const absent of [null, undefined, '']) { // falsy triple at service :47
                reads = [];
                store[TYPE_KEY] = absent;
                expect(await trigger()).toBeNull();
                expect(reads).toEqual([TYPE_KEY]); // gate order: alive key never consulted when type is absent
            }
            store[TYPE_KEY] = COMPANION_TYPE;
            reads = [];
            store[ALIVE_KEY] = false;
            expect(await trigger()).toBeNull();
            expect(reads).toEqual([TYPE_KEY, ALIVE_KEY]);
            expect(executeHandler).not.toHaveBeenCalled();

            // honest RAW-adjacent quirk: the gate is === false — unknown-alive (null/undefined) still dispatches
            for (const unknownAlive of [null, undefined]) {
                reads = [];
                executeHandler.mockClear();
                store[ALIVE_KEY] = unknownAlive;
                await trigger();
                expect(executeHandler).toHaveBeenCalledTimes(1);
                expect(reads).toEqual([TYPE_KEY, ALIVE_KEY]);
            }
        });

        it('case-gate: range lowercased before compare — Self/self/SELF all dispatch the full 2-read census', async () => {
            // service-only strings 'self (5-foot radius)'/'self (30-foot cone)'/'self (60-foot cone)' (service :17)
            // are NEVER-EXECUTED guards: zero disk rows carry them (all self rows are bare 'Self') — declared,
            // not pinned with fabricated spell rows (old Acid Splash/Frostbite cones were disk-false: both 60-ft cantrips).
            for (const range of ['Self', 'self', 'SELF']) {
                reads = [];
                executeHandler.mockClear();
                await trigger({ ...SHIELD, range });
                expect(executeHandler).toHaveBeenCalledTimes(1);
                expect(reads).toEqual([TYPE_KEY, ALIVE_KEY]);
            }
        });

        it('golden envelope: disk-fronted passive -> exact action bytes, exact key sets, arg identity, pure inputs, zero writes', async () => {
            const casterStats = stats();
            const spellBefore = JSON.stringify(SHIELD);
            const statsBefore = JSON.stringify(casterStats);

            const result = await trigger(SHIELD, { slotLevel: 3 }, casterStats, 'test-map');

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, argStats, argCampaign, argMap] = executeHandler.mock.calls[0];
            expect(Object.keys(action)).toEqual(['name', 'description', 'automation', 'spell', 'spellSlotLevel']);
            expect(Object.keys(action.automation)).toEqual(['type', 'range', 'casting_time', 'companionType']);
            expect(action).toEqual({
                name: 'Share Spells',
                description: SHARE_DISK.description,
                automation: {
                    type: 'primal_companion_spell_share',
                    range: SHARE_DISK.automation.range,
                    casting_time: SHARE_DISK.automation.casting_time,
                    companionType: COMPANION_TYPE,
                },
                spell: SHIELD,
                spellSlotLevel: 3, // metaCtx.slotLevel wins over spell.level (2-slot spell upcast to 3)
            });
            expect(argStats).toBe(casterStats);
            expect(argCampaign).toBe(CAMPAIGN);
            expect(argMap).toBe('test-map');
            expect(reads).toEqual([TYPE_KEY, ALIVE_KEY]);
            expect(result).toBeNull(); // default dispatch fake resolves null -> returned untouched
            expect(JSON.stringify(SHIELD)).toBe(spellBefore);
            expect(JSON.stringify(casterStats)).toBe(statsBefore);
        });

        it('fallback envelope: bare passive + null metaCtx + omitted map — fallbacks equal disk canon, slot falls back to spell.level', async () => {
            const bareStats = stats([{ type: 'primal_companion_spell_share', name: 'Share Spells' }]);
            // direct call (not the helper): the helper's mapName default would re-inject 'test-map' on explicit undefined
            await triggerPrimalCompanionSpellShare(SHIELD, null, bareStats, CAMPAIGN); // null metaCtx: optional-chain guards at :42/:66 hold

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, argStats, argCampaign, argMap] = executeHandler.mock.calls[0];
            expect(Object.keys(action)).toEqual(['name', 'description', 'automation', 'spell', 'spellSlotLevel']);
            expect(Object.keys(action.automation)).toEqual(['type', 'range', 'casting_time', 'companionType']);
            expect(action).toEqual({
                name: 'Share Spells',
                description: SHARE_DISK.description, // hardcoded fallback literal must match disk canon byte-for-byte
                automation: {
                    type: 'primal_companion_spell_share',
                    range: SHARE_DISK.automation.range, // fallback '30_ft' pinned against disk, not a duplicate literal
                    casting_time: 'passive',
                    companionType: COMPANION_TYPE,
                },
                spell: SHIELD,
                spellSlotLevel: SHIELD.level,
            });
            expect(argStats).toBe(bareStats);
            expect(argCampaign).toBe(CAMPAIGN);
            expect(argMap).toBeUndefined();
        });

        it(':0-swallow census: a spell with undefined level slips the ===0 gate and stamps spellSlotLevel 0', async () => {
            await trigger({ name: 'Levelless Self', range: 'Self' }); // no level: undefined === 0 is false -> passes gate :38
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(executeHandler.mock.calls[0][0].spellSlotLevel).toBe(0); // honest quirk: fires with slot 0
        });

        it('passthrough: resolves executeHandler by identity; default null resolves null', async () => {
            const sentinel = { type: 'popup', payload: { whatever: true } };
            executeHandler.mockResolvedValueOnce(sentinel);
            expect(await trigger()).toBe(sentinel); // service returns the awaited result object untouched
            expect(await trigger()).toBeNull();     // queue spent -> default null passthrough
        });

        it('executeHandler rejection: swallowed to null, console.error exact prefix + the SAME Error instance', async () => {
            const err = new Error('Handler failed');
            executeHandler.mockRejectedValueOnce(err);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            expect(await trigger()).toBeNull();
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith('[primalCompanionSpellShare] Failed to execute spell share for Shield:', err);
            expect(consoleSpy.mock.calls[0][1]).toBe(err); // identical-Error discrimination (#1385)
        });

        it('golden TypeError: null/undefined spell derefs spell.range at service :16 via :34, OUTSIDE try :69 — exact V8 message', async () => {
            // direct calls: helper defaults (spell = SHIELD) would swallow explicit undefined
            await expect(triggerPrimalCompanionSpellShare(undefined, {}, stats(), CAMPAIGN)).rejects.toThrow(TypeError);
            await expect(triggerPrimalCompanionSpellShare(undefined, {}, stats(), CAMPAIGN)).rejects.toThrow("Cannot read properties of undefined (reading 'range')");
            await expect(triggerPrimalCompanionSpellShare(null, {}, stats(), CAMPAIGN)).rejects.toThrow("Cannot read properties of null (reading 'range')");
            expect(executeHandler).not.toHaveBeenCalled();
            expect(reads).toEqual([]); // dies before the store gates

            // gate precedence: with the passive absent the trigger returns null BEFORE dereferencing the spell (:29-32 beats :34)
            expect(await triggerPrimalCompanionSpellShare(null, {}, stats([]), CAMPAIGN)).toBeNull();
        });
    });
});
