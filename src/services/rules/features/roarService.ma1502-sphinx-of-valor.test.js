// @maintained-by-ai
// MA-1502: Sphinx of Valor "Roar" launcher — row-authored staged roar payload.
// Pre-fix the row was ['name','description','uses'] ONLY with uses:"3/Day"
// STRING (Number()=NaN → no gate) and no staged_roar key → byte-inert prose
// launcher (zero affordance, zero enforcement; §949 fingerprint). The fix
// reuses the MA-0268 canonical staged-roar path, generalized via a
// ROW-AUTHORED structured `roar_stages[]` payload (§88 rays[] / §MA-1436
// variants[] convention) carrying Valor's own DC 20 ladder prose:
//   stage 1 (WIS DC 20): fail → frightened 1 minute, ZERO damage;
//   stage 2 (WIS DC 20): fail → paralyzed 1 minute + prose repeat-save clause
//     (turn-END repeater §70 GM-enforced — repeat_save:null authored on ALL
//     three stages on purpose: the MA-0048 fallback arms the frightened FP te
//     and would over-grant Frightened/Paralysis machinery Valor doesn't own);
//   stage 3 (CON DC 20): fail → 8d10 thunder + prone / success half.
// PRESERVED-CITED-BY MonsterCardModal.ma1502-staged-roar.test.jsx:8 — this
// lane owns the stage leg bytes (buildRoarStageAction envelopes) and the
// exhausted→null return (roarStageNumber/resolveRoarStageAction).
// Androsphinx byte-inertia: its disk row carries NO roar_stages key and
// resolves from the hardcoded ROAR_STAGES default table (canonical stage
// bytes owned by roarService.test.js MA-0268 base lane — only the
// payload-absence firewall is pinned here). Refusal popup/log builder copy
// owned by monsterAbilityUses.test.js; picker threading by the modal lane.
// Dual-ruleset note: monsters.json is shared data (no 2024/ monster corpus —
// public/data/2024/ holds classes/spells/etc only), so DC/legs are disk-
// identical under both rulesets; nothing here branches on rules version.
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const monsterName = 'Sphinx of Valor 1';
const campaignName = 'test-campaign';

function valorRoarRow() {
    return monstersData.find(m => m.index === 'sphinx-of-valor').actions.find(a => a.name === 'Roar');
}

function androsphinxRoarRow() {
    return monstersData.find(m => m.index === 'androsphinx').actions.find(a => a.name === 'Roar');
}

// REAL disk near-miss names (zero invented rows): lion's plain 'Roar' and
// Valor's coexisting manual 'First Roar' carry no staged_roar flag.
const lionRoarRow = () => monstersData.find(m => m.index === 'lion').actions.find(a => a.name === 'Roar');
const valorFirstRoarRow = () => monstersData.find(m => m.index === 'sphinx-of-valor').actions.find(a => a.name === 'First Roar');

// Argument-keyed STATEFUL store fake: throws on unknown owner/key/campaign or
// wrong arity; reads return a snapshot so the escalation composes against
// what prior spends actually wrote (no hand-maintained counter).
function installStore() {
    const state = {};
    getRuntimeValue.mockImplementation(function (...args) {
        const [target, key] = args;
        if (args.length !== 2 || target !== monsterName || key !== MONSTER_SPELL_USES_KEY) {
            throw new Error(`[MA-1502 test] unexpected getRuntimeValue call: ${JSON.stringify(args)}`);
        }
        // reads return the stored uses-map itself (copy), like the real store
        return { ...(state[key] ?? {}) };
    });
    setRuntimeValue.mockImplementation(async function (...args) {
        const [target, key, value, campaign] = args;
        if (args.length !== 4 || target !== monsterName || key !== MONSTER_SPELL_USES_KEY || campaign !== campaignName) {
            throw new Error(`[MA-1502 test] unexpected setRuntimeValue call: ${JSON.stringify(args)}`);
        }
        if (!value || typeof value !== 'object') {
            throw new Error(`[MA-1502 test] setRuntimeValue payload must be the uses map, got ${JSON.stringify(value)}`);
        }
        state[key] = value;
    });
    return state;
}

beforeEach(() => {
    vi.resetAllMocks();
    installStore();
});

describe('MA-1502 disk: Valor Roar launcher row arms the numeric gate (NaN-string fix)', () => {
    it('exact row key-set, numeric uses:3 (NaN-string fingerprint locked out), DC 20 stage-neutral row, live gate', () => {
        const row = valorRoarRow();
        expect(Object.keys(row)).toEqual(['name', 'description', 'uses', 'maxUses', 'staged_roar', 'save_dc', 'save_type', 'save_effect', 'damage_dice_primary', 'damage_type_primary', 'range', 'usage', 'roar_stages']);
        expect(row.uses).toBe(3);
        expect(row.maxUses).toBe(3);
        expect(row.staged_roar).toBe(true);
        expect(row.save_dc).toBe(20);
        expect(row.usage).toEqual({ type: 'per day', times: 3 });
        // §MA-1436: row-level fields stay stage-neutral (union prose, first-stage save).
        expect(row.save_type).toBe('Wisdom');
        expect(row.range).toBe('500-foot Emanation');
        expect(stagedRoarMaxUses(row)).toBe(3);

        // regression fingerprint: the OLD shape (uses:"3/Day" string, no maxUses)
        // produced NO gate at all — Number('3/Day')=NaN → null.
        expect(monsterAbilitySaveUsesGate({ name: 'Roar', save_dc: 20, uses: '3/Day' }, {})).toBeNull();
        const fresh = monsterAbilitySaveUsesGate(row, {});
        expect(fresh).toEqual({ useKey: 'Roar', maxUses: 3, used: 0, remaining: 3, exhausted: false });
        expect(monsterAbilitySaveUsesGate(row, { Roar: 3 }).exhausted).toBe(true);
    });
});

describe('MA-1502 authored roar_stages[] payload (row beats hardcoded table)', () => {
    it('3-deep DC 20 ladder with Valor legs, repeat_save:null on ALL stages (FP fallback barred), zero clock keys', () => {
        const stages = valorRoarRow().roar_stages;
        expect(stages.length).toBe(3);
        expect(stages.map(s => s.stage)).toEqual([1, 2, 3]);
        expect(stages.map(s => s.label)).toEqual(['First Roar (1 of 3)', 'Second Roar (2 of 3)', 'Third Roar (3 of 3)']);
        expect(stages.map(s => s.save_dc)).toEqual([20, 20, 20]);
        expect(stages.map(s => s.save_type)).toEqual(['Wisdom', 'Wisdom', 'Constitution']);
        expect(stages.map(s => s.dc_success)).toEqual(['none', 'none', 'half']);
        // Exact dict key-sets (stages 1/2 share one shape; only stage 3 authors damage):
        expect(Object.keys(stages[0])).toEqual(['stage', 'label', 'description', 'save_dc', 'save_type', 'dc_success', 'save_effect', 'repeat_save']);
        expect(Object.keys(stages[1])).toEqual(['stage', 'label', 'description', 'save_dc', 'save_type', 'dc_success', 'save_effect', 'repeat_save']);
        expect(Object.keys(stages[2])).toEqual(['stage', 'label', 'description', 'save_dc', 'save_type', 'dc_success', 'damage_dice_primary', 'damage_type_primary', 'save_effect', 'repeat_save']);
        expect(stages[2].damage_dice_primary).toBe('8d10');
        expect(stages[2].damage_type_primary).toBe('Thunder');
        // MA-0048 armer stays barred for the WHOLE ladder (§70 GM-enforced):
        expect(stages.map(s => s.repeat_save)).toEqual([null, null, null]);
        // NO-CLOCK policy: no numeric duration field anywhere in the payload —
        // "1 minute" is combat-scoped prose only, never a minutes×10 countdown.
        for (const s of stages) {
            expect(Object.keys(s).filter(k => /_?(minutes|rounds|seconds|expiry|until)/.test(k))).toEqual([]);
        }
        // §67: stage texts carry ONLY their own condition words (order-stable —
        // extractor walks the canonical CONDITIONS registry, no .sort() needed):
        expect(extractConditionsFromSaveEffect(stages[0].save_effect)).toEqual(['frightened']);
        expect(extractConditionsFromSaveEffect(stages[1].save_effect)).toEqual(['paralyzed']);
        expect(extractConditionsFromSaveEffect(stages[2].save_effect)).toEqual(['prone']);
        expect(extractDamageDiceFromDescription(stages[0].description, stages[0].damage_dice_primary)).toBeNull();
        expect(extractDamageDiceFromDescription(stages[1].description, stages[1].damage_dice_primary)).toBeNull();
        expect(extractDamageDiceFromDescription(stages[2].description, stages[2].damage_dice_primary)).toBe('8d10');
    });

    it('coexisting manual sibling rows stay on disk UNTOUCHED and un-staged (step-5, single staged entrypoint)', () => {
        const actions = monstersData.find(m => m.index === 'sphinx-of-valor').actions;
        expect(actions.map(a => a.name)).toEqual(['Multiattack', 'Claw', 'Roar', 'First Roar', 'Second Roar', 'Third Roar', 'Spellcasting']);
        const first = actions.find(a => a.name === 'First Roar');
        const second = actions.find(a => a.name === 'Second Roar');
        const third = actions.find(a => a.name === 'Third Roar');
        expect(first.save_dc).toBe(20);
        expect(first.save_effect).toBe('The target has the Frightened condition for 1 minute.');
        expect(second.save_effect).toMatch(/Paralyzed condition and repeats the save/);
        expect(third.save_type).toBe('Constitution');
        // Exactly ONE staged entrypoint on Valor — the launcher; the manual
        // siblings must never double-arm the stage resolver.
        expect(actions.filter(a => a.staged_roar === true).map(a => a.name)).toEqual(['Roar']);
        for (const sib of [first, second, third]) {
            expect(sib.staged_roar).toBeUndefined();
            expect(sib.roar_stages).toBeUndefined();
        }
    });
});

describe('MA-1502 stage swap: payload beats default table (cited stage leg bytes)', () => {
    it('stages 1-3 resolve exact full envelopes from the authored payload — zero-damage stages shed the union 8d10', () => {
        const row = valorRoarRow();
        const pristine = cloneDeep(row);
        // Per-stage literal canaries lock STAGE ALIGNMENT (which dict lands on
        // which click); the derived envelope locks SWAP COMPLETENESS.
        const CANARY = [
            { name: 'First Roar (1 of 3)', saveType: 'Wisdom', dcSuccess: 'none', damage: null, conditions: ['frightened'] },
            { name: 'Second Roar (2 of 3)', saveType: 'Wisdom', dcSuccess: 'none', damage: null, conditions: ['paralyzed'] },
            { name: 'Third Roar (3 of 3)', saveType: 'Constitution', dcSuccess: 'half', damage: '8d10', conditions: ['prone'] },
        ];
        CANARY.forEach((c, i) => {
            const stage = i + 1;
            const authored = row.roar_stages[i];
            const s = buildRoarStageAction(row, stage);
            expect(s).not.toBe(row);
            // dc_success + repeat_save are NEW keys absent from the row and
            // append after the spread's 13 keys — exact set AND order pinned.
            expect(Object.keys(s)).toEqual([...Object.keys(pristine), 'dc_success', 'repeat_save']);
            expect(s).toEqual({
                ...pristine,
                name: c.name,
                description: authored.description,
                save_dc: 20,
                save_type: c.saveType,
                dc_success: c.dcSuccess,
                damage_dice_primary: c.damage,
                damage_type_primary: c.damage ? 'Thunder' : null,
                save_effect: authored.save_effect,
                repeat_save: null,
            });
            // the row itself authors union 8d10 — stages 1/2 MUST null it and
            // the description fallback MUST NOT re-extract it (pre-fix union):
            expect(extractDamageDiceFromDescription(s.description, s.damage_dice_primary)).toBe(c.damage);
            expect(extractConditionsFromSaveEffect(s.save_effect)).toEqual(c.conditions);
        });
        // input purity: building never mutates the disk row.
        expect(row).toEqual(pristine);
    });

    it('guards on REAL disk rows + exhausted→null (cited) + loud overrun bytes + androsphinx default-table firewall', () => {
        const row = valorRoarRow();
        // real-name near-misses never qualify — flag is the ONLY qualifier:
        expect(isStagedRoarAction(lionRoarRow())).toBe(false);
        expect(isStagedRoarAction(valorFirstRoarRow())).toBe(false);
        expect(isStagedRoarAction({ name: 'Roar', uses: 3 })).toBe(false);
        expect(isStagedRoarAction({ name: 'Roar', roar_stages: row.roar_stages })).toBe(false);
        expect(roarStageNumber({ name: 'Roar', save_dc: 20 }, {})).toBeNull();
        expect(resolveRoarStageAction({ action: lionRoarRow(), usesGate: null })).toBeNull();

        // exhausted→null: counter at 3 gives no stage (defensive, gate refuses first):
        expect(roarStageNumber(row, { Roar: 3 })).toBeNull();
        const err = vi.spyOn(console, 'error').mockImplementation(() => { });
        expect(resolveRoarStageAction({ action: row, usesGate: { used: 3, maxUses: 3 } })).toBeNull();
        expect(err).toHaveBeenCalledWith('[roarService] MA-0268 stage overrun: Roar stage 4 > max 3 — no stage resolution.');
        // out-of-index authored stage: build returns silent null — loudness is
        // resolve()'s job only (documented split, never a phantom stage).
        err.mockClear();
        expect(buildRoarStageAction(row, 4)).toBeNull();
        expect(err).not.toHaveBeenCalled();
        err.mockRestore();

        // androsphinx byte-inertia firewall: disk row authors NO payload key,
        // so it resolves from ROAR_STAGES defaults (canonical bytes owned by
        // roarService.test.js; only key-absence + branch selection pinned here):
        const andro = androsphinxRoarRow();
        expect(andro.roar_stages).toBeUndefined();
        expect(andro.uses).toBeUndefined();
        const a1 = buildRoarStageAction(andro, 1);
        expect(a1.name).toBe('Roar 1 of 3');
        expect(a1.save_dc).toBe(18);
        expect(a1.save_type).toBe('Wisdom');
        // default table arms the FP repeat_save that Valor's payload bars:
        expect(a1.repeat_save).toEqual({ condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 });
    });
});

describe('MA-1502 4-click escalation on the launcher: spends advance the stage, 4th refuses', () => {
    it('clicks 1-3 spend one use each (stateful store, exact write tuples, stage-labelled logs); click 4 refuses with zero write', async () => {
        const row = valorRoarRow();
        const state = installStore();
        expect(isStagedRoarAction(row)).toBe(true);

        const STAGE_NAMES = ['First Roar (1 of 3)', 'Second Roar (2 of 3)', 'Third Roar (3 of 3)'];
        for (let click = 1; click <= 3; click++) {
            const usesGate = monsterAbilitySaveUsesGate(row, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY));
            expect(usesGate.exhausted).toBe(false);
            expect(roarStageNumber(row, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY))).toBe(click);
            const stageAction = resolveRoarStageAction({ action: row, usesGate });
            expect(stageAction.name).toBe(STAGE_NAMES[click - 1]);
            const spend = await spendMonsterAbilityUse({
                monsterName,
                use: { useKey: usesGate.useKey, maxUses: usesGate.maxUses, actionName: stageAction.name },
                campaignName,
                deps: { getRuntimeValue, setRuntimeValue, addEntry },
            });
            expect(spend).toBe(3 - click);
            // store advanced through the fake's write path, not by hand:
            expect(state[MONSTER_SPELL_USES_KEY]).toEqual({ Roar: click });
        }

        // stage-labelled spend logs, exact ordered set (label from context.actionName):
        const spendLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use');
        expect(spendLogs.map(l => l.abilityName)).toEqual(STAGE_NAMES);

        // write-budget: exactly 3 writes, full tuples audited:
        expect(setRuntimeValue.mock.calls).toEqual([
            [monsterName, MONSTER_SPELL_USES_KEY, { Roar: 1 }, campaignName],
            [monsterName, MONSTER_SPELL_USES_KEY, { Roar: 2 }, campaignName],
            [monsterName, MONSTER_SPELL_USES_KEY, { Roar: 3 }, campaignName],
        ]);

        // click 4: gate exhausted — no stage, no prompt, no spend, no 4th write.
        const finalGate = monsterAbilitySaveUsesGate(row, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY));
        expect(finalGate.exhausted).toBe(true);
        expect(roarStageNumber(row, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY))).toBeNull();
        addEntry.mockClear();
        const err = vi.spyOn(console, 'error').mockImplementation(() => { });
        expect(resolveRoarStageAction({ action: row, usesGate: finalGate })).toBeNull();
        // bypass-the-gate double-spend defense: refused loudly, returns null.
        expect(await spendMonsterAbilityUse({
            monsterName,
            use: { useKey: finalGate.useKey, maxUses: finalGate.maxUses, actionName: 'Fourth click' },
            campaignName,
            deps: { getRuntimeValue, setRuntimeValue, addEntry },
        })).toBeNull();
        expect(err).toHaveBeenCalledWith('[monsterAbilityUses] Double-spend guard: Sphinx of Valor 1 Roar already at 3/3 — no spend.');
        err.mockRestore();
        const logs = addEntry.mock.calls.map(c => c[1]);
        // refused click: exactly one log, the refusal — the refused click never
        // logs a spend and never writes.
        expect(logs).toHaveLength(1);
        expect(logs[0].type).toBe('automation');
        expect(logs[0].automationType).toBe('roar_refused');
        expect(logs[0].abilityName).toBe('Roar');
        expect(setRuntimeValue.mock.calls.length).toBe(3);
    });
});
