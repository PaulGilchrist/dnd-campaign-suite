// @maintained-by-ai
// MA-0298 Soul Tome trap SERVICE lane (self-owned bytes only). Provenance:
// attacker 'Arcanaloth' + action 'Banishing Claw (Requires Soul Tome)' live at
// public/data/monsters.json:20373/:20386 (disk grep 2026-10-21; no items.json
// artifact row — the trap rides the monster action, parsed upstream). te key
// 'banished_demiplane' is registry-owned at targetEffectDefinitions.js:618
// (label 'Banished (Demiplane)', group 'Spells' → GM-adder visible, #1373 OK).
// SEAM (verified against navigationHandlers.js): applySoulTomeTrapTurnEnd rides
// applyOutgoingTurnEndPasses at :229, BEFORE MA-0610 applyRepeatSaveTurnEnd :238
// and zoneRepeat :247 — the #1405 'soulTome -> repeatSave -> zoneRepeat' order,
// quoted verbatim from the citation, held. Upstream arm/consumer lane is owned
// by useLoggedDiceRollEventHandlers.ma0298-soul-tome.test.js (this lane pins
// the service behind that mocked call, not the seam routing); parse clause owned
// by MonsterCardHelpers.soul-tome-trap.test.js.
// NO-CLOCK: grant emits ZERO addExpiration imports/calls — the te is
// duration:'indefinite_until_repeat_save' with soulTome:true, NO rounds field;
// terminator is the turn-END repeat save only. Bound-at-3 is advisory GM prose
// (no fail-counter consumer — CLA-325 precedent).
// Write-budget audited HERE: production registerTargetEffect writes
// setRuntimeValue(..., campaignName, true) — skipSync=true POSITION 5
// (targetEffectDefinitions.js:1510, mirrored by the fake); the service's own
// writes (soulTomeTrapService.js:36/:44/:52) are arity-4 WITHOUT skipSync —
// original writes, no SSE-echo loop risk.
// Pinned AS-IS source smells: (1) fix#353 FIXED (#1419): the PC prompt no
// longer hard-codes 'CHA' — resolveRepeatSave takes the te-threaded saveType
// (:141/:146 caller bytes) and mirrors the NPC-leg idiom above it (:96
// `saveTypeAbbr(csCreature?.saveType)`), normalizing via the SAME saveTypeAbbr
// whose silent 'cha' default (:27/:29) IS the NPC leg's only fallback law —
// zero console.error on the fallback, none invented. WIS-honored and
// absent-te->silent-CHA arms pinned below; prose interpolates the honored
// abbr (repo idiom: baneService.js:96/:113 'CHA save'). NPC leg still reads
// the COMBAT SUMMARY row (quirk 3, byte-pinned at :303); (2) service calls
// getRuntimeValue with 3 args while production is arity-2 (:63) — 3rd arg
// inert by design, arity censused on every read; (3) NPC auto-roll reads
// saveType/saveBonuses from the COMBAT SUMMARY row, not from the te (:96-97),
// with `?? 0` bonus fallback; (4) saveDc uses `te.dc ?? 17` (dc:0 would pass
// through — DC 0 is not an authored RAW value, not exercised); (5) grant logs
// condition-applied even when the condition dedup skips the write (:35 vs :81).
// Cross-file overlap NOTE (report-only): grantSoulTomeTrap is vi.mock'd no-op
// in THREE sibling consumer suites — service internals live solely here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const C = 'test-campaign';
const ARC = 'Arcanaloth';
const V = 'Wild_Sage_Druid';
const B = 'Bystander_Rogue';
const LABEL = 'Banishing Claw (Requires Soul Tome)';
const STEEL = new Error('log service down');

const runtimeStore = {};
const writes = [];      // `${owner}.${key}/${arity}[:skipSync]`
const reads = [];       // `${owner}.${key}/${arity}`
const logs = [];        // full addEntry entry objects (campaign validated in fake)
const listeners = [];   // createSaveListener opts
const registryCalls = []; // direct registry-lane records
let csCreatures = [];
let saveOutcome = { roll: 19, saveBonus: -1, success: true };
let denyTeWrite = false; // honesty leg: register becomes no-op
let rejectLogs = false;

function rtGet(owner, key, arity) {
    const k = `${owner}.${key}`;
    reads.push(`${k}/${arity}`);
    if (!(k in runtimeStore)) throw new Error(`unexpected runtime read ${k}`);
    return runtimeStore[k];
}
function rtSet(owner, key, value, arity, skipSync) {
    const k = `${owner}.${key}`;
    if (!(owner === 'campaign' ? key === 'targetEffects' : key === 'activeConditions')) {
        throw new Error(`unexpected runtime write ${k}`);
    }
    writes.push(`${k}/${arity}${skipSync === true ? ':skipSync' : ''}`);
    runtimeStore[k] = value;
}

// Production getRuntimeValue is arity-2 (useRuntimeState.js:63) — service
// passes a 3rd campaign arg; censused inert. Production setRuntimeValue is
// arity-4 (:78); registry mirrors arity-5 skipSync=true (:1510).
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (owner, key, campaign) => {
        if (campaign !== undefined && campaign !== C) throw new Error(`campaign arg drift: ${campaign}`);
        return rtGet(owner, key, campaign === undefined ? 2 : 3);
    },
    setRuntimeValue: (owner, key, value, campaign, skipSync) => {
        if (campaign !== C) throw new Error(`write ${owner}.${key} campaign drift: ${campaign}`);
        if (skipSync !== undefined && skipSync !== true) throw new Error(`skipSync drift: ${skipSync}`);
        rtSet(owner, key, value, skipSync === undefined ? 4 : 5, skipSync);
    },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (campaign, entry) => {
        if (campaign !== C) throw new Error(`log campaign drift: ${campaign}`);
        logs.push(entry);
        return rejectLogs ? Promise.reject(STEEL) : Promise.resolve();
    },
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: () => ({ creatures: csCreatures }),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: (campaign, opts) => {
        if (campaign !== C) throw new Error(`listener campaign drift: ${campaign}`);
        listeners.push(opts);
        return { promptId: 'soul-prompt-1', promise: Promise.resolve(saveOutcome) };
    },
}));

// Mirrors production registerTargetEffect exactly (targetEffectDefinitions.js
// :1492-1511): dedupe by (target, effect, source), duration:'concentration'
// default OVERWRITTEN by extraProps, arity-5 skipSync=true store write.
vi.mock('../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: (campaign, targetName, effectKey, source, extra = {}) => {
        registryCalls.push({ lane: 'register', targetName, effectKey, source });
        if (campaign !== C) throw new Error(`register campaign drift: ${campaign}`);
        if (denyTeWrite) return;
        const stored = runtimeStore['campaign.targetEffects'] || [];
        const i = stored.findIndex(te => te.target === targetName && te.effect === effectKey && te.source === source);
        const row = { target: targetName, effect: effectKey, source, duration: 'concentration', ...extra };
        const updated = [...stored];
        if (i >= 0) updated[i] = row; else updated.push(row);
        rtSet('campaign', 'targetEffects', updated, 5, true);
    },
    getActiveTargetEffect: (campaign, targetName, effectKey) => {
        registryCalls.push({ lane: 'active-read', targetName, effectKey });
        const stored = runtimeStore['campaign.targetEffects'] || [];
        return stored.find(te => te.target === targetName && te.effect === effectKey) || null;
    },
}));

import { grantSoulTomeTrap, applySoulTomeTrapTurnEnd } from './soulTomeTrapService.js';

const TE = (overrides = {}) => ({
    target: V, effect: 'banished_demiplane', source: ARC,
    duration: 'indefinite_until_repeat_save', soulTome: true,
    condition: 'incapacitated', dc: 17, saveType: 'CHA', actionName: LABEL,
    ...overrides,
});
// MA-0104 legendary-Banish decoy — same effect key, NO soulTome flag,
// rounds:2 clock (matches registry row :618 'until start of attacker next turn').
const MA104 = (target = V) => ({
    target, effect: 'banished_demiplane', source: 'Ancient Gold Dragon',
    duration: 'until_start_of_attacker_next_turn', rounds: 2,
});
const grantedDesc = (target = V, dc = 17) => `${target} failed ${ARC}'s ${LABEL} save (DC ${dc}) — trapped in a demiplane inside the Soul Tome with the Incapacitated condition (indefinite until a repeat save succeeds at the end of its turn; becoming bound to the tome after three cumulative fails is GM-enforced — no fail-counter consumer).`;
// fix#353: prose carries the HONORED abbr (te-threaded), default 'CHA' keeps
// every pre-existing byte-pinned call site identical.
const repeatDesc = (target, dc, abbr = 'CHA') => `${target} repeats its ${abbr} save (DC ${dc}) at the end of its turn to escape the Soul Tome.`;
const successDesc = (target, dc, roll, bonus, total, abbr = 'CHA') => `${target} succeeded its repeat ${abbr} save (DC ${dc}, rolled ${roll} + ${bonus} = ${total}) — escapes the Soul Tome, appearing in the space it left or the nearest unoccupied space (placement GM-enforced).`;
const failDesc = (target, dc, roll, bonus, total, abbr = 'CHA') => `${target} failed its repeat ${abbr} save (DC ${dc}, rolled ${roll} + ${bonus} = ${total}) — remains trapped (Incapacitated); cumulative fails toward becoming bound to the tome (3) are GM-enforced — no fail-counter consumer.`;

function seedCond(owner, conditions) { runtimeStore[`${owner}.activeConditions`] = conditions; }
function seedTes(...tes) { runtimeStore['campaign.targetEffects'] = tes; }
const tes = () => runtimeStore['campaign.targetEffects'];
const cond = owner => runtimeStore[`${owner}.activeConditions`];
const clearCalls = () => { writes.length = reads.length = logs.length = listeners.length = registryCalls.length = 0; };

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T12:00:00Z')); // STAMP_MS freeze for Date.now() envelopes
    Object.keys(runtimeStore).forEach(k => delete runtimeStore[k]);
    clearCalls();
    csCreatures = [{ name: V, type: 'player' }];
    saveOutcome = { roll: 19, saveBonus: -1, success: true };
    denyTeWrite = false;
    rejectLogs = false;
    seedCond(V, []);
    seedTes();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('grantSoulTomeTrap — soulTome failed-save producer (NO expiry clock)', () => {
    it('writes the full registered te envelope + condition through the production registry merge (skipSync:5, condition arity:4) and logs both entries byte-exact, no prompt fired at grant time', async () => {
        await grantSoulTomeTrap({ campaignName: C, attackerName: ARC, targetName: V, saveDc: 17, saveType: 'cha', actionName: LABEL });

        expect(tes()).toHaveLength(1);
        expect(tes()[0]).toEqual(TE()); // key-set exact: NO rounds/expiry — indefinite
        expect(cond(V)).toEqual(['incapacitated']);
        expect(registryCalls).toEqual([
            { lane: 'register', targetName: V, effectKey: 'banished_demiplane', source: ARC },
            { lane: 'active-read', targetName: V, effectKey: 'banished_demiplane' }, // honest post-write verify feeds the 'unconfirmed' suffix
        ]);
        expect(reads).toEqual(['Wild_Sage_Druid.activeConditions/3']); // 3rd campaign arg censused inert (production arity 2)
        expect(writes).toEqual(['campaign.targetEffects/5:skipSync', 'Wild_Sage_Druid.activeConditions/4']);
        expect(listeners).toEqual([]); // grant never prompts — the turn-END seam owns the save
        expect(logs).toEqual([
            {
                type: 'automation', automationType: 'banished_demiplane_granted', characterName: V, sourceName: ARC,
                abilityName: LABEL, description: grantedDesc(), timestamp: 1792584000000,
            },
            {
                type: 'condition', action: 'applied', characterName: V, condition: 'Incapacitated',
                sourceName: ARC, sourceAbility: LABEL, timestamp: 1792584000000,
            },
        ]);
    });

    it('capitalized seed dedups WITHOUT a condition write yet STILL logs applied (quirk 5); unknown saveType coerces to CHA; omitted dc stores undefined', async () => {
        const seeded = ['Incapacitated', 'blinded'];
        seedCond(V, seeded);
        await grantSoulTomeTrap({ campaignName: C, attackerName: ARC, targetName: V, saveType: 'xyz' });

        expect(cond(V)).toBe(seeded); // zero writes for activeConditions: pure identity, unmutated + length stable
        expect(writes.filter(w => w.endsWith('activeConditions/4'))).toEqual([]);
        expect(tes()[0]).toStrictEqual(TE({ dc: undefined, saveType: 'CHA' })); // saveTypeAbbr fallback :29; dc key present-undefined (strict-checked) → turn-END `?? 17`
        expect(logs).toEqual([
            { type: 'automation', automationType: 'banished_demiplane_granted', characterName: V, sourceName: ARC, abilityName: LABEL, description: grantedDesc(V, 'undefined'), timestamp: 1792584000000 },
            { type: 'condition', action: 'applied', characterName: V, condition: 'Incapacitated', sourceName: ARC, sourceAbility: LABEL, timestamp: 1792584000000 },
        ]); // applied log fires despite the deduped write (quirk 5); honest 'DC undefined' prose pinned
    });

    it('denied te write is NOT swallowed: granted log carries the exact " (te write unconfirmed)" suffix; addEntry rejections surface with pinned console.error prefixes and zero throw', async () => {
        denyTeWrite = true;
        rejectLogs = true;
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});

        await grantSoulTomeTrap({ campaignName: C, attackerName: ARC, targetName: V, saveDc: 17, saveType: 'cha' });

        expect(tes()).toEqual([]);
        expect(logs[0].description).toBe(`${grantedDesc()} (te write unconfirmed)`);
        expect(cond(V)).toEqual(['incapacitated']); // condition lane still lands
        expect(err.mock.calls.map(c => c[0])).toEqual(['[soulTomeTrapService:granted]', '[soulTomeTrapService:condition-applied]']);
        expect(err.mock.calls.map(c => c[1])).toEqual([STEEL, STEEL]); // identical Error identity
    });
});

describe('applySoulTomeTrapTurnEnd — MA-0048 turn-END repeat-save consumer (navigationHandlers seam :229)', () => {
    it('does not fire on an empty store nor on near-miss tes: MA-0104 unflagged, soulTome:"true" STRING non-strict, bystander-flagged — handled:false byte-inert', async () => {
        const res0 = await applySoulTomeTrapTurnEnd(C, V);
        expect(res0).toEqual({ handled: false }); // exact envelope
        expect(writes).toEqual([]);
        expect(logs).toEqual([]);

        const decoys = [MA104(), TE({ soulTome: 'true' }), TE({ target: B })];
        seedTes(...decoys);
        const seededArr = tes();
        clearCalls();
        const res = await applySoulTomeTrapTurnEnd(C, V);
        expect(res).toEqual({ handled: false });
        expect(tes()).toBe(seededArr); // zero writes: byte-identical, unmutated, length stable
        expect(writes).toEqual([]);
        expect(logs).toEqual([]);
        expect(listeners).toEqual([]);
        expect(reads).toEqual(['campaign.targetEffects/3']);
    });

    it('repeat-save SUCCESS strips ONLY soulTome-flagged tes: exact return envelope, surviving-row census, survivor triple (bystander te+cond byte-identical and never logged), all three logs byte-exact', async () => {
        csCreatures = [{ name: V, type: 'player' }, { name: B, type: 'player' }];
        const ma104 = MA104();
        const bystander = TE({ target: B });
        const victim = TE();
        seedTes(ma104, bystander, victim);
        const victimCond = ['incapacitated', 'blinded'];
        const bystanderCond = ['incapacitated'];
        seedCond(V, victimCond);
        seedCond(B, bystanderCond);
        saveOutcome = { roll: 18, saveBonus: 0, success: true };
        clearCalls();

        const res = await applySoulTomeTrapTurnEnd(C, V);

        expect(res).toEqual({ handled: true, success: true, roll: 18, total: 18 }); // exact envelope, NO key extras
        expect(listeners).toEqual([{ targetName: V, saveType: 'CHA', saveDc: 17, dcSuccess: 'none', sourceName: ARC, condition: `${LABEL} (repeat save)` }]);
        expect(tes()).toEqual([ma104, bystander]); // MA-0104 clock te + bystander survive byte-exact
        expect(tes()[0]).toBe(ma104); // identity-carry, no reconstruct/clobber
        expect(cond(V)).toEqual(['blinded']);
        expect(cond(B)).toBe(bystanderCond); // untouched array
        expect(writes).toEqual(['campaign.targetEffects/4', 'Wild_Sage_Druid.activeConditions/4']);
        expect(logs).toEqual([
            { type: 'ability_use', characterName: ARC, abilityName: LABEL, description: repeatDesc(V, 17), promptId: 'soul-prompt-1' },
            {
                type: 'save_result', characterName: ARC, rollType: 'save-soul-tome-repeat', targetName: V, saveDc: 17, saveType: 'CHA',
                success: true, roll: 18, total: 18, saveBonus: 0, description: successDesc(V, 17, 18, 0, 18), timestamp: 1792584000000,
            },
            {
                type: 'condition', action: 'removed', characterName: V, condition: 'Incapacitated',
                reason: 'Escaped the Soul Tome (repeat save succeeded)', sourceName: ARC, timestamp: 1792584000000,
            },
        ]);
        expect(logs.some(l => JSON.stringify(l).includes(B))).toBe(false); // survivor never logged
    });

    it('repeat-save FAIL keeps trap bytes with ZERO writes and logs the bound-at-3 GM advisory byte-exact (roll+bonus<dc)', async () => {
        seedTes(TE());
        const conds = ['incapacitated'];
        seedCond(V, conds);
        saveOutcome = { roll: 3, saveBonus: -1, success: false };
        clearCalls();

        const res = await applySoulTomeTrapTurnEnd(C, V);

        expect(res).toEqual({ handled: true, success: false, roll: 3, total: 2 });
        expect(tes()).toHaveLength(1);
        expect(tes()[0]).toBe(runtimeStore['campaign.targetEffects'][0]); // same row object, no rebuild
        expect(tes()[0]).toEqual(TE()); // te + soulTome flag kept
        expect(cond(V)).toBe(conds); // zero condition writes: byte-identical array survives the fail
        expect(writes).toEqual([]);
        expect(listeners).toEqual([{ targetName: V, saveType: 'CHA', saveDc: 17, dcSuccess: 'none', sourceName: ARC, condition: `${LABEL} (repeat save)` }]);
        expect(logs).toEqual([
            { type: 'ability_use', characterName: ARC, abilityName: LABEL, description: repeatDesc(V, 17), promptId: 'soul-prompt-1' },
            {
                type: 'save_result', characterName: ARC, rollType: 'save-soul-tome-repeat', targetName: V, saveDc: 17, saveType: 'CHA',
                success: false, roll: 3, total: 2, saveBonus: -1, description: failDesc(V, 17, 3, -1, 2), timestamp: 1792584000000,
            },
        ]);
    });

    // fix#353 arms (#1419): PC leg honors the te-threaded saveType; fallback
    // law is the NPC leg's OWN silent 'cha' default in saveTypeAbbr (:27/:29)
    // — zero console.error on the fallback path is ITSELF pinned (no invented
    // loud law) — while :78's granted-prose 'DC undefined' leg stays byte-
    // honest as pinned in the grant lane above (fix#353 adjudication: the sole
    // production caller threads saveDc through detail.saveDc ?? pending.saveDc,
    // useLoggedDiceRollEventHandlers.js:455; no fabricated numeric default).
    it('te-saveType-honored: WIS-stamped te prompts WIS and every PC-leg log byte carries WIS (retired hardcoded CHA impossible)', async () => {
        seedTes(TE({ saveType: 'WIS' }));
        seedCond(V, ['incapacitated']);
        saveOutcome = { roll: 18, saveBonus: 0, success: true };
        clearCalls();

        const res = await applySoulTomeTrapTurnEnd(C, V);

        expect(res).toEqual({ handled: true, success: true, roll: 18, total: 18 });
        expect(listeners).toEqual([{ targetName: V, saveType: 'WIS', saveDc: 17, dcSuccess: 'none', sourceName: ARC, condition: `${LABEL} (repeat save)` }]);
        expect(logs).toEqual([
            { type: 'ability_use', characterName: ARC, abilityName: LABEL, description: repeatDesc(V, 17, 'WIS'), promptId: 'soul-prompt-1' },
            {
                type: 'save_result', characterName: ARC, rollType: 'save-soul-tome-repeat', targetName: V, saveDc: 17, saveType: 'WIS',
                success: true, roll: 18, total: 18, saveBonus: 0, description: successDesc(V, 17, 18, 0, 18, 'WIS'), timestamp: 1792584000000,
            },
            {
                type: 'condition', action: 'removed', characterName: V, condition: 'Incapacitated',
                reason: 'Escaped the Soul Tome (repeat save succeeded)', sourceName: ARC, timestamp: 1792584000000,
            },
        ]);
    });

    it('absent te.saveType: silent CHA fallback via the NPC-leg saveTypeAbbr law (prompt + field + prose all CHA, ZERO console.error — loud arm not invented)', async () => {
        const teNoType = TE();
        delete teNoType.saveType;
        seedTes(teNoType);
        seedCond(V, ['incapacitated']);
        saveOutcome = { roll: 3, saveBonus: -1, success: false };
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        clearCalls();

        const res = await applySoulTomeTrapTurnEnd(C, V);

        expect(res).toEqual({ handled: true, success: false, roll: 3, total: 2 });
        expect(listeners).toEqual([{ targetName: V, saveType: 'CHA', saveDc: 17, dcSuccess: 'none', sourceName: ARC, condition: `${LABEL} (repeat save)` }]);
        expect(logs).toEqual([
            { type: 'ability_use', characterName: ARC, abilityName: LABEL, description: repeatDesc(V, 17), promptId: 'soul-prompt-1' },
            {
                type: 'save_result', characterName: ARC, rollType: 'save-soul-tome-repeat', targetName: V, saveDc: 17, saveType: 'CHA',
                success: false, roll: 3, total: 2, saveBonus: -1, description: failDesc(V, 17, 3, -1, 2), timestamp: 1792584000000,
            },
        ]);
        expect(err).not.toHaveBeenCalled();
    });

    it('malformed te.saveType normalizes through saveTypeAbbr (echoed verbatim into the log field BEFORE fix#353; coerced to CHA with it)', async () => {
        seedTes(TE({ saveType: 'ChA' }));
        seedCond(V, ['incapacitated']);
        saveOutcome = { roll: 19, saveBonus: 0, success: true };
        clearCalls();

        await applySoulTomeTrapTurnEnd(C, V);

        expect(listeners[0].saveType).toBe('CHA'); // saveTypeAbbr('ChA') -> 'cha' -> 'CHA'
        expect(logs.find(l => l.type === 'save_result').saveType).toBe('CHA');
    });

    it('NPC leg auto-rolls inline (NO prompt) off the COMBAT-SUMMARY save row: missing saveType/saveBonuses chain to bonus 0 and the >= dc boundary decides', async () => {
        const N1 = 'Ice_Mephit', N2 = 'Dust_Mephit';
        csCreatures = [{ name: N1, type: 'npc', saveBonuses: { cha: -1 } }, { name: N2, type: 'npc' }];
        const teN1 = TE({ target: N1 }), teN2 = TE({ target: N2 });
        seedTes(teN1, teN2);
        seedCond(N1, []);
        seedCond(N2, []);
        vi.spyOn(Math, 'random').mockReturnValue(0.8); // fixed stub: exact natural 17 every roll
        clearCalls();

        const fail = await applySoulTomeTrapTurnEnd(C, N1);
        expect(fail).toEqual({ handled: true, success: false, roll: 17, total: 16 });
        const ok = await applySoulTomeTrapTurnEnd(C, N2);
        expect(ok).toEqual({ handled: true, success: true, roll: 17, total: 17 }); // 17 + (saveBonuses-absent ?? 0) >= 17 inclusive boundary

        expect(listeners).toEqual([]); // NPCs never prompt
        expect(tes()).toEqual([teN1]); // only the flag-matched N2 row stripped
        expect(cond(N1)).toEqual([]);
        expect(cond(N2)).toEqual([]);
        expect(writes).toEqual(['campaign.targetEffects/4']);
        expect(logs).toEqual([
            {
                type: 'save_result', characterName: ARC, rollType: 'save-soul-tome-repeat', targetName: N1, saveDc: 17, saveType: 'CHA',
                success: false, roll: 17, total: 16, saveBonus: -1, description: failDesc(N1, 17, 17, -1, 16), timestamp: 1792584000000,
            },
            {
                type: 'save_result', characterName: ARC, rollType: 'save-soul-tome-repeat', targetName: N2, saveDc: 17, saveType: 'CHA',
                success: true, roll: 17, total: 17, saveBonus: 0, description: successDesc(N2, 17, 17, 0, 17), timestamp: 1792584000000,
            },
            { type: 'condition', action: 'removed', characterName: N2, condition: 'Incapacitated', reason: 'Escaped the Soul Tome (repeat save succeeded)', sourceName: ARC, timestamp: 1792584000000 },
        ]); // full-set: NPC lane logs NO ability_use prompt entry
    });
});