// @maintained-by-ai
// MA-0268 BASE lane: the generic staged-roar engine in roarService.js on the
// Androsphinx-canonical path — hardcoded ROAR_STAGES default-table bytes
// (DC 18 ladder), the stage parser (roarStageNumber), stage swap/escalation,
// the isStagedRoarAction gate, STAGED_ROAR_MAX_DEFAULT (export has
// NO external importer — pinned live only via stagedRoarMaxUses' ?? arm;
// recommendation to source owner: drop the `export` keyword, #1370/81 method)
// and the LOUD console.error arm of resolveRoarStageAction (exact bytes).
// PRESERVED-CITED-BY MonsterCardModal.staged-roar.test.jsx ("stage leg table
// bytes + exhausted→null owned by roarService.test.js") — kept: the per-stage
// canonical envelope bytes and the exhausted→null arms below.
// FIREWALL vs MA-1502 ticket lane (roarService.ma1502-sphinx-of-valor.test.js,
// maintained one lane ago; #1410 face): Valor row bytes, roar_stages[]
// payload, stage-4 guards on authored rows and the loud/silent split on the
// Valor row live THERE — re-cited, not re-grown here. Disk overlap is
// fixture-distinguishable (#1348): that lane owns the Valor DC 20 ladder and
// only shallow-pins the androsphinx default-table selection (name/DC/type/
// repeat_save + key absence); THIS lane owns the verbatim stage sentence
// bytes, exact envelope key-sets and the stateful spend/log tuples for
// 'Androsphinx 1'.
// repeat_save seam (verbatim ownership): round-seam clock = MA-0048 owner
// (saveProcessing.armRepeatSaveClause → trackFrightfulPresence; the FP
// minutes×10 CLA-334 encoding lives in frightfulPresenceService.js), zone
// maturation owner #1332, generic repeat roller owner repeatSaveService
// #1405. This lane STAMPS the repeat_save bytes and pins the seam shape
// only: absent `effect` key ⇒ never dispatches to #1405's generic roller,
// never a rounds/seconds/expiry clock here (NO-CLOCK mandatory — the
// minutes×10 recipe is NOT executed in roarService.js: verified).
// Dice census: ZERO dice on this lane (pure data swap — rollers belong to
// the modal/saveProcessing lanes), so no fixed-stub queue is seeded.
// Quirk pinned honestly (residual MA-1502 NaN class in the GENERIC parser):
// `?? STAGED_ROAR_MAX_DEFAULT` catches null but NOT NaN — a legacy
// uses:"3/Day" string row (gate side: monsterAbilityUses.js:26
// Number.isFinite → null, enforced nowhere) still walks the resolver as
// "Roar 1 of NaN", silent, never exhausting. Current behavior pinned.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneDeep } from 'lodash';
import monstersData from '../../../../public/data/monsters.json';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { addEntry } from '../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import {
    isStagedRoarAction,
    roarStageNumber,
    buildRoarStageAction,
    resolveRoarStageAction,
    stagedRoarMaxUses,
} from './roarService.js';
import {
    monsterAbilitySaveUsesGate,
    spendMonsterAbilityUse,
    MONSTER_SPELL_USES_KEY,
} from '../../encounters/monsterAbilityUses.js';
import { extractConditionsFromSaveEffect } from '../../../components/encounter/MonsterCardHelpers.js';
import { extractDamageDiceFromDescription } from '../../../components/encounter/MonsterCardModal.jsx';

const monsterName = 'Androsphinx 1';
const campaignName = 'test-campaign';
const STAMP_MS = 1700000000000;

function rawRoarRow() {
    return monstersData.find(m => m.index === 'androsphinx').actions.find(a => a.name === 'Roar');
}

// REAL disk near-miss name (#1352 guards-real-tables): lion's plain 'Roar'
// carries no staged_roar flag.
function lionRoarRow() {
    return monstersData.find(m => m.index === 'lion').actions.find(a => a.name === 'Roar');
}

// Argument-keyed STATEFUL store fake (#1372/93/1400): THROW on unknown
// owner/key/campaign/arity; reads return snapshots so escalation composes
// against what prior spends actually wrote.
function installStore() {
    const state = {};
    getRuntimeValue.mockImplementation(function (...args) {
        const [target, key] = args;
        if (args.length !== 2 || target !== monsterName || key !== MONSTER_SPELL_USES_KEY) {
            throw new Error(`[MA-0268 base test] unexpected getRuntimeValue call: ${JSON.stringify(args)}`);
        }
        return { ...(state[key] ?? {}) };
    });
    setRuntimeValue.mockImplementation(async function (...args) {
        const [target, key, value, campaign] = args;
        if (args.length !== 4 || target !== monsterName || key !== MONSTER_SPELL_USES_KEY || campaign !== campaignName) {
            throw new Error(`[MA-0268 base test] unexpected setRuntimeValue call: ${JSON.stringify(args)}`);
        }
        if (!value || typeof value !== 'object') {
            throw new Error(`[MA-0268 base test] setRuntimeValue payload must be the uses map, got ${JSON.stringify(value)}`);
        }
        state[key] = value;
    });
    return state;
}

// Verbatim ROAR_STAGES canonical bytes (the base lane OWNS these strings —
// the modal lane cites them, the Valor lane never sees them).
const CANON_STAGES = [
    {
        name: 'Roar 1 of 3',
        saveType: 'Wisdom',
        dcSuccess: 'none',
        damage: null,
        damageType: null,
        description: 'First Roar (1 of 3). The sphinx emits a magical roar. Each creature within 500 feet of the sphinx and able to hear the roar must make a saving throw. Each creature that fails a DC 18 Wisdom saving throw is frightened for 1 minute. A frightened creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. This roar deals no damage.',
        saveEffect: 'First Roar (1 of 3): Failure: frightened for 1 minute. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. Success: no effect. This effect deals no damage.',
        conditions: ['frightened'],
        repeatSave: { condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 },
    },
    {
        name: 'Roar 2 of 3',
        saveType: 'Wisdom',
        dcSuccess: 'none',
        damage: null,
        damageType: null,
        description: 'Second Roar (2 of 3). The sphinx emits a louder magical roar. Each creature within 500 feet of the sphinx and able to hear the roar must make a saving throw. Each creature that fails a DC 18 Wisdom saving throw is deafened and frightened for 1 minute. A frightened creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. This roar deals no damage.',
        saveEffect: 'Second Roar (2 of 3): Failure: deafened and frightened for 1 minute. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. Success: no effect. This effect deals no damage.',
        conditions: ['deafened', 'frightened'],
        repeatSave: { condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 },
    },
    {
        name: 'Roar 3 of 3',
        saveType: 'Constitution',
        dcSuccess: 'half',
        damage: '8d10',
        damageType: 'Thunder',
        description: 'Third Roar (3 of 3). The sphinx emits its loudest magical roar. Each creature within 500 feet of the sphinx and able to hear the roar must make a saving throw. Each creature makes a DC 18 Constitution saving throw. On a failed save, a creature takes 44 (8d10) thunder damage and is knocked prone. On a successful save, the creature takes half as much damage and isn\'t knocked prone.',
        saveEffect: 'Third Roar (3 of 3): Failure: 44 (8d10) thunder damage and knocked prone. Success: half damage and not knocked prone.',
        conditions: ['prone'],
        repeatSave: null,
    },
];

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(STAMP_MS);
    installStore();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('MA-0268 disk: Androsphinx Roar row arms the base engine (DC 18, maxUses 3)', () => {
    it('exact row key-set + numeric gate with both-sides boundary; stage-neutral row, union 8d10 on disk for the swap to shed', () => {
        const row = rawRoarRow();
        expect(Object.keys(row)).toEqual(['name', 'description', 'save_dc', 'maxUses', 'staged_roar', 'usage', 'save_type', 'save_effect', 'damage_dice_primary', 'damage_type_primary']);
        expect(row.staged_roar).toBe(true);
        expect(row.maxUses).toBe(3);
        expect(row.save_dc).toBe(18);
        expect(row.save_type).toBe('Wisdom');
        expect(row.usage).toEqual({ type: 'per day', times: 3 });
        // Row-level save fields stay stage-neutral (§MA-1436): the CON leg and
        // the 8d10 live ONLY in ROAR_STAGES / the row's union prose.
        expect(row.damage_dice_primary).toBe('8d10');
        expect(row.damage_type_primary).toBe('Thunder');
        expect(row.description).toMatch(/First Roar\. Each creature that fails a DC 18 Wisdom/);
        expect(row.description).toMatch(/Third Roar\. Each creature makes a DC 18 Constitution/);
        // default-table branch is selected by payload ABSENCE — roar_stages
        // key-absence itself is pinned by the MA-1502 lane firewall (reciprocal).
        expect(row.roar_stages).toBeUndefined();

        expect(monsterAbilitySaveUsesGate(row, {})).toEqual({ useKey: 'Roar', maxUses: 3, used: 0, remaining: 3, exhausted: false });
        expect(monsterAbilitySaveUsesGate(row, { Roar: 2 })).toEqual({ useKey: 'Roar', maxUses: 3, used: 2, remaining: 1, exhausted: false });
        expect(monsterAbilitySaveUsesGate(row, { Roar: 3 }).exhausted).toBe(true);
    });
});

describe('MA-0268 canonical stage swap — exact envelope bytes (cited by MonsterCardModal.staged-roar lane)', () => {
    it('stages 1-3 build full envelopes verbatim; damageless stages shed the union 8d10 including the description fallback; repeat_save stamps the MA-0048 seam shape with no clock keys', () => {
        const row = rawRoarRow();
        const pristine = cloneDeep(row);
        const rowKeys = Object.keys(pristine);
        CANON_STAGES.forEach((c, i) => {
            const stage = i + 1;
            const s = buildRoarStageAction(row, stage);
            expect(s).not.toBe(row);
            // dc_success + repeat_save are NEW keys appended after the 10-key
            // spread (save_dc stays row-level: defaultTable mech.saveDc is null):
            expect(Object.keys(s)).toEqual([...rowKeys, 'dc_success', 'repeat_save']);
            expect(s).toEqual({
                ...pristine,
                name: c.name,
                description: c.description,
                save_dc: 18,
                save_type: c.saveType,
                dc_success: c.dcSuccess,
                damage_dice_primary: c.damage,
                damage_type_primary: c.damageType,
                save_effect: c.saveEffect,
                repeat_save: c.repeatSave,
            });
            // the swap MUST defeat extractDamageDiceFromDescription's fallback
            // (pre-fix union re-extraction of 8d10 on the damageless stages):
            expect(extractDamageDiceFromDescription(s.description, s.damage_dice_primary)).toBe(c.damage);
            expect(extractConditionsFromSaveEffect(s.save_effect)).toEqual(c.conditions);
        });
        // NO-CLOCK census on the stamped repeat_save bytes: exact key-set with
        // NO rounds/seconds/expiry keys and NO `effect` key ⇒ saveProcessing
        // routes to the FP-specific MA-0048 leg, never the generic
        // repeatSaveService (#1405); the minute→rounds conversion is NOT here.
        expect(Object.keys(buildRoarStageAction(row, 1).repeat_save)).toEqual(['condition', 'save_type', 'duration_minutes']);
        expect(buildRoarStageAction(row, 3).repeat_save).toBeNull();
        // input purity: building never mutates the disk row.
        expect(row).toEqual(pristine);
    });
});

describe('MA-0268 stage parser + gate — ladder, byte-inertia, strict flag', () => {
    it('roarStageNumber derives stage from the persisted counter (0→1, 2→3, exhausted→null, garbage→0); resolve agrees name-per-name; un-staged rows are byte-inert', () => {
        const row = rawRoarRow();
        expect(roarStageNumber(row, {})).toBe(1);
        expect(roarStageNumber(row, { Roar: 1 })).toBe(2);
        expect(roarStageNumber(row, { Roar: 2 })).toBe(3);
        expect(roarStageNumber(row, { Roar: 3 })).toBeNull();
        expect(roarStageNumber(row, { Roar: 5 })).toBeNull();
        // :0-swallow census: non-numeric stored counter coerces to 0 → stage 1.
        expect(roarStageNumber(row, { Roar: 'junk' })).toBe(1);

        // chokepoint consistency (#1357): the resolver's chosen stage and the
        // parser's counter-derived stage never disagree — same state, same N.
        for (const used of [0, 1, 2]) {
            const gate = monsterAbilitySaveUsesGate(row, { Roar: used });
            const s = resolveRoarStageAction({ action: row, usesGate: gate });
            expect(s.name).toBe(`Roar ${roarStageNumber(row, { Roar: used })} of 3`);
            expect(s.save_type).toBe(CANON_STAGES[used].saveType);
            expect(s.dc_success).toBe(CANON_STAGES[used].dcSuccess);
        }

        // strict flag is the ONLY qualifier — REAL disk near-miss + falsy triples:
        expect(isStagedRoarAction(lionRoarRow())).toBe(false);
        expect(isStagedRoarAction({ name: 'Roar' })).toBe(false);
        expect(isStagedRoarAction({ name: 'Roar', staged_roar: 'true' })).toBe(false);
        expect(isStagedRoarAction({ name: 'Roar', staged_roar: 1 })).toBe(false);
        expect(roarStageNumber({ name: 'Roar', save_dc: 18 }, {})).toBeNull();
        expect(resolveRoarStageAction({ action: lionRoarRow(), usesGate: null })).toBeNull();
    });

    it('golden unguarded-deref quirk (#1360 class): build(undefined, 1) SUCCEEDS from the default table but build(undefined, 3) TypeErrors mid-spread — console untouched either way', () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const s1 = buildRoarStageAction(undefined, 1);
        expect(s1).not.toBeNull();
        expect(s1.name).toBe('Roar 1 of 3');
        expect(s1.save_dc).toBeUndefined();
        expect(() => buildRoarStageAction(undefined, 3)).toThrow(TypeError);
        expect(() => resolveRoarStageAction()).toThrow(TypeError);
        expect(err).not.toHaveBeenCalled();
        err.mockRestore();
    });
});

describe('MA-0268 loud-vs-silent split (base row) — resolve is loud, build is silent', () => {
    it('overrun refusal prints exact console.error bytes (em-dash included), never a phantom stage; out-of-index build stays silent — even via the negative-used loud-guard bypass', () => {
        const row = rawRoarRow();
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(resolveRoarStageAction({ action: row, usesGate: { used: 3, maxUses: 3 } })).toBeNull();
        expect(err).toHaveBeenCalledWith('[roarService] MA-0268 stage overrun: Roar stage 4 > max 3 — no stage resolution.');
        expect(resolveRoarStageAction({ action: row, usesGate: { used: 5, maxUses: 3 } })).toBeNull();
        expect(err).toHaveBeenNthCalledWith(2, '[roarService] MA-0268 stage overrun: Roar stage 6 > max 3 — no stage resolution.');
        // silent arm (split pinned reciprocal at MA-1502 lane): out-of-index
        // build resolves null WITHOUT console:
        err.mockClear();
        expect(buildRoarStageAction(row, 4)).toBeNull();
        expect(buildRoarStageAction(row, 0)).toBeNull();
        expect(buildRoarStageAction(row, -1)).toBeNull();
        // loud-guard bypass quirk: used:-1 → stage 0 passes the `>` check and
        // dies silently inside build — still never a phantom stage.
        expect(resolveRoarStageAction({ action: row, usesGate: { used: -1, maxUses: 3 } })).toBeNull();
        expect(err).not.toHaveBeenCalled();
        err.mockRestore();
    });
});

describe('MA-0268 NaN residual pin (MA-1502 class, generic parser — honest current behavior)', () => {
    it('uses:"3/Day" STRING row: gate side self-nulls (Number.isFinite) but stagedRoarMaxUses passes NaN through ??, so the parser labels "Roar 1 of NaN" silently and never exhausts; STAGED_ROAR_MAX_DEFAULT only catches null', () => {
        // synthetic legacy shape — no such row survives on disk post-MA-1502
        // (Valor was the last carrier, fixed there; androsphinx was numeric).
        const legacyRow = { name: 'Roar', staged_roar: true, uses: '3/Day' };
        expect(monsterAbilitySaveUsesGate(legacyRow, {})).toBeNull();
        expect(stagedRoarMaxUses(legacyRow)).toBeNaN();
        expect(roarStageNumber(legacyRow, {})).toBe(1);
        expect(roarStageNumber(legacyRow, { Roar: 5 })).toBe(6); // NaN max never exhausts
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const s = resolveRoarStageAction({ action: legacyRow, usesGate: null });
        expect(s.name).toBe('Roar 1 of NaN');
        expect(s.save_dc).toBeUndefined();
        expect(buildRoarStageAction(legacyRow, 4)).toBeNull(); // default-table bound, silent
        expect(err).not.toHaveBeenCalled();
        err.mockRestore();
        // STAGED_ROAR_MAX_DEFAULT fallback is LIVE only for the null side of ?? :
        expect(stagedRoarMaxUses({})).toBe(3);
        expect(stagedRoarMaxUses(rawRoarRow())).toBe(3);
    });
});

describe('MA-0268 4-click escalation — stateful compose: spends advance the stage, 4th refuses zero-write', () => {
    it('clicks 1-3 spend one use each through the store fake (exact write tuples, exact stage-labelled log envelopes); click 4: exhausted gate, loud overrun bytes, double-spend guard, one refusal log, zero 4th write', async () => {
        const row = rawRoarRow();
        const state = installStore();
        expect(isStagedRoarAction(row)).toBe(true);

        for (let click = 1; click <= 3; click++) {
            const stored = getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY);
            const usesGate = monsterAbilitySaveUsesGate(row, stored);
            expect(usesGate.exhausted).toBe(false);
            expect(roarStageNumber(row, stored)).toBe(click);
            const stageAction = resolveRoarStageAction({ action: row, usesGate });
            expect(stageAction.name).toBe(`Roar ${click} of 3`);
            expect(stageAction.save_type).toBe(CANON_STAGES[click - 1].saveType);
            const spend = await spendMonsterAbilityUse({
                monsterName,
                use: { useKey: usesGate.useKey, maxUses: usesGate.maxUses, actionName: stageAction.name },
                targetName: 'TestPC',
                campaignName,
                deps: { getRuntimeValue, setRuntimeValue, addEntry },
            });
            expect(spend).toBe(3 - click);
            // store advanced through the fake's WRITE path, not by hand:
            expect(state[MONSTER_SPELL_USES_KEY]).toEqual({ Roar: click });
        }

        // write-budget full tuples (#1341 — exactly 3, audited positionally):
        expect(setRuntimeValue.mock.calls).toEqual([
            [monsterName, MONSTER_SPELL_USES_KEY, { Roar: 1 }, campaignName],
            [monsterName, MONSTER_SPELL_USES_KEY, { Roar: 2 }, campaignName],
            [monsterName, MONSTER_SPELL_USES_KEY, { Roar: 3 }, campaignName],
        ]);

        // spend log full-set, exact bytes incl em-dash; stage label flows via
        // context.actionName while useKey stays the canonical 'Roar':
        const spendLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use');
        expect(spendLogs).toEqual([
            { type: 'ability_use', characterName: monsterName, abilityName: 'Roar 1 of 3', description: 'Androsphinx 1 uses Roar on TestPC — 1 use spent, 2 left today (resets at dawn, GM-enforced for monsters).', timestamp: STAMP_MS },
            { type: 'ability_use', characterName: monsterName, abilityName: 'Roar 2 of 3', description: 'Androsphinx 1 uses Roar on TestPC — 1 use spent, 1 left today (resets at dawn, GM-enforced for monsters).', timestamp: STAMP_MS },
            { type: 'ability_use', characterName: monsterName, abilityName: 'Roar 3 of 3', description: 'Androsphinx 1 uses Roar on TestPC — 1 use spent, 0 left today (resets at dawn, GM-enforced for monsters).', timestamp: STAMP_MS },
        ]);

        // click 4: exhausted gate — no stage, no spend, one refusal log, no 4th write.
        const finalGate = monsterAbilitySaveUsesGate(row, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY));
        expect(finalGate).toEqual({ useKey: 'Roar', maxUses: 3, used: 3, remaining: 0, exhausted: true });
        expect(roarStageNumber(row, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY))).toBeNull();
        addEntry.mockClear();
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(resolveRoarStageAction({ action: row, usesGate: finalGate })).toBeNull();
        expect(await spendMonsterAbilityUse({
            monsterName,
            use: { useKey: finalGate.useKey, maxUses: finalGate.maxUses, actionName: 'Fourth click' },
            targetName: 'TestPC',
            campaignName,
            deps: { getRuntimeValue, setRuntimeValue, addEntry },
        })).toBeNull();
        expect(err.mock.calls).toEqual([
            ['[roarService] MA-0268 stage overrun: Roar stage 4 > max 3 — no stage resolution.'],
            ['[monsterAbilityUses] Double-spend guard: Androsphinx 1 Roar already at 3/3 — no spend.'],
        ]);
        const logs = addEntry.mock.calls.map(c => c[1]);
        expect(logs).toHaveLength(1);
        // builder COPY owned by monsterAbilityUses.test.js — here only the
        // seam identity: roar_refused fired, abilityName canonical, no spend:
        expect(logs[0].type).toBe('automation');
        expect(logs[0].automationType).toBe('roar_refused');
        expect(logs[0].abilityName).toBe('Roar');
        expect(logs[0].timestamp).toBe(STAMP_MS);
        expect(setRuntimeValue.mock.calls.length).toBe(3);
    });
});
