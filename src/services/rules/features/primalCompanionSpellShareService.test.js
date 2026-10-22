// @maintained-by-ai
// CLA-311 Share Spells SERVICE (base) lane. Owns the trigger GATES of primalCompanionSpellShareService.js:
// passive-absent / self-target / cantrip / unresolvable-level / AoE-cast / companion-exists / companion-alive
// refusals, exact action-construction envelopes (disk-fronted fallbacks), executeHandler result pass-through by
// identity, rejection-swallow with exact console byte, and the golden TypeError at the spell.range deref
// (spell.range deref happens in the self-target gate, OUTSIDE the executeHandler try — the chain lane's
// 'report only, not re-owned' note points HERE; it lives in 'golden TypeError' below).
// Owned elsewhere per the #1395 split — never re-grow here:
//   handler lane primalCompanionSpellShareHandler.test.js: guard popups, seeded dedupe, applySpellShare
//     modal-confirm, its :32 direct-call pin.
//   chain lane primalCompanionSpellShare.share-chain.test.js (cites this file at its :5): service->handler
//     composition seam — action.spell identity live-through-handler, real rangeToFeet gate, 6-read +
//     write-order store censuses, idempotent re-share.
// Zero dice, zero clocks, zero log writes in this lane: the service is read-only dispatch and console.errors
// only on guard/error paths. Write budget: zero writes (writes belong to the handler/chain lanes).
// #1396 dead exports DELETED (fix#82 precedent): useCustomHandlers.js and execution/index.js call ONLY
// triggerPrimalCompanionSpellShare; hasShareSpells was removed outright and getShareSpellsFeature demoted to
// module-internal. Import-clean proof: this lane imports ONLY triggerPrimalCompanionSpellShare — the removed
// names have zero remaining references repo-wide outside historical plan docs.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { triggerPrimalCompanionSpellShare } from './primalCompanionSpellShareService.js';

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
// Disk passive row fronts the hardcoded fallback literals (service description/range/casting_time fallbacks):
// fallback == disk canon is asserted against these bytes, not a test-local duplicate (chokepoint inline-dup watch #1357).
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

    describe('passive lookup (internal contract behind every gate — #1396 exports removed, trigger-only surface)', () => {
        it('first-match wins: earliest primal_companion_spell_share passive supplies the envelope bytes', async () => {
            const share = { ...SHARE_PASSIVE };
            const later = { ...SHARE_PASSIVE, name: 'Share Spells v2', range: '60_ft' };
            const hitStats = { name: CASTER, automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }, share, later] } };
            executeHandler.mockClear();
            await trigger(SHIELD, {}, hitStats);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const action = executeHandler.mock.calls[0][0];
            expect(action.description).toBe(share.description); // first match supplies, never the later clone
            expect(action.automation.range).toBe(share.range); // '30_ft' (disk), not later's '60_ft'
        });

        it('passive-absent shapes still refuse via the trigger; missing automation.passives THROWS golden guard per falsy shape, each logged once', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            // miss and empty-array shapes return null at the passive gate (covered above too; kept as lookup smoke)
            expect(await trigger(SHIELD, {}, { name: CASTER, automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] } })).toBeNull();
            expect(await trigger(SHIELD, {}, { name: CASTER, automation: { passives: [] } })).toBeNull();
            // falsy passives trip the loud array guard INSIDE the trigger — exact bytes
            await expect(trigger(SHIELD, {}, { automation: { passives: null } })).rejects.toThrow('Expected array, got null');
            await expect(trigger(SHIELD, {}, { automation: {} })).rejects.toThrow('Expected array, got undefined');
            await expect(trigger(SHIELD, {}, {})).rejects.toThrow('Expected array, got undefined');
            expect(consoleSpy).toHaveBeenCalledTimes(3);
            expect(consoleSpy).toHaveBeenCalledWith('[primalCompanionSpellShareService] Missing array:', null);
            expect(executeHandler).not.toHaveBeenCalled();
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

        it('companion gates: absent type refuses (never reads alive); alive is STRICT === true — false/null/undefined all refuse (#1396)', async () => {
            for (const absent of [null, undefined, '']) { // falsy triple at the type gate
                reads = [];
                store[TYPE_KEY] = absent;
                expect(await trigger()).toBeNull();
                expect(reads).toEqual([TYPE_KEY]); // gate order: alive key never consulted when type is absent
            }
            store[TYPE_KEY] = COMPANION_TYPE;

            // #1396 fix: unknown-alive was the ===false defect (null/undefined dispatched shares onto a
            // possibly-dead companion). Truth source is the runtime 'primalCompanionAlive' key, written
            // true only at summon/restore (primalCompanionHandler.js); anything else is NOT alive.
            for (const notAlive of [false, null, undefined]) {
                reads = [];
                executeHandler.mockClear();
                store[ALIVE_KEY] = notAlive;
                expect(await trigger()).toBeNull();
                expect(reads).toEqual([TYPE_KEY, ALIVE_KEY]); // read happens, dispatch does not
                expect(executeHandler).not.toHaveBeenCalled();
            }

            // the ONLY dispatching alive state is explicit true
            executeHandler.mockClear();
            store[ALIVE_KEY] = true;
            await trigger();
            expect(executeHandler).toHaveBeenCalledTimes(1);
        });

        it('case-gate: range lowercased before compare — disk-ships-only bare Self dispatches; disk-zero shapes refuse', async () => {
            // Disk census (#1396): 'Self' is the ONLY self-range token on disk (5e 68/68, 2024 94/94) —
            // the old 'self (5-foot radius)'/'self (30-foot cone)'/'self (60-foot cone)' literals matched
            // ZERO rows and are deleted. Negative arms pin the exact-match decision against a future
            // startsWith('self') widening for shapes no disk row ships.
            for (const range of ['Self', 'self', 'SELF']) {
                reads = [];
                executeHandler.mockClear();
                await trigger({ ...SHIELD, range });
                expect(executeHandler).toHaveBeenCalledTimes(1);
                expect(reads).toEqual([TYPE_KEY, ALIVE_KEY]);
            }
            for (const range of ['Self (5-foot radius)', 'Self (30-foot cone)', 'Self (60-foot cone)']) {
                expect(await trigger({ name: 'Disk-Zero Cone', level: 1, range })).toBeNull();
            }
            expect(executeHandler).toHaveBeenCalledTimes(1); // the three disk-zero refusals dispatched nothing
            expect(reads).toEqual([TYPE_KEY, ALIVE_KEY]); // negatives never reached the store gates
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
            await triggerPrimalCompanionSpellShare(SHIELD, null, bareStats, CAMPAIGN); // null metaCtx: optional-chain guards hold; slot falls back to spell.level

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

        it('#1396 unresolvable level: refused LOUD — exact console byte + throw, never a fabricated slotLevel 0; metaCtx.slotLevel resolves exactly', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            // spell.level absent + metaCtx empty: nothing to resolve -> throw, zero dispatch, zero store reads
            await expect(trigger({ name: 'Levelless Self', range: 'Self' })).rejects.toThrow('spell slot level is required for primal companion spell share');
            // consumer sentinel: useCustomHandlers.js stamps slotLevel:0 on an absent pending.spellLevel — equally unresolvable
            await expect(trigger({ name: 'Levelless Self', range: 'Self' }, { slotLevel: 0 })).rejects.toThrow('spell slot level is required for primal companion spell share');
            expect(consoleSpy).toHaveBeenCalledTimes(2);
            expect(consoleSpy).toHaveBeenCalledWith('[primalCompanionSpellShare] Missing spell slot level for Levelless Self: metaCtx.slotLevel and spell.level are both absent — refusing to share.');
            expect(executeHandler).not.toHaveBeenCalled();
            expect(reads).toEqual([]); // refuse precedes the store gates (no reads, no dispatch)

            // resolved: a leveled metaCtx slot supplies the paid level for a level-less spell, stamped exactly
            executeHandler.mockClear();
            await trigger({ name: 'Levelless Self', range: 'Self' }, { slotLevel: 3 });
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(executeHandler.mock.calls[0][0].spellSlotLevel).toBe(3);

            // explicit disk cantrip still silently refused at level===0, even with a leveled slot in metaCtx
            expect(await trigger(PRODUCE_FLAME, { slotLevel: 3 })).toBeNull();
            expect(executeHandler).toHaveBeenCalledTimes(1); // no extra dispatch
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

        it('golden TypeError: null/undefined spell derefs spell.range in the self-target gate, OUTSIDE the executeHandler try — exact V8 message', async () => {
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
