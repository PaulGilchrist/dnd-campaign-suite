// @maintained-by-ai
// MA-1584: Thri-Kreen Bite — save_effect carried the deep-band word
// "paralyzed" AND the repeat-save prose ungated, so extractConditionsFromSaveEffect
// (§1105 whole-prose harvest) sprayed poisoned AND paralyzed on EVERY failed
// save and the EOT repeat never fired (§622: prose repeat clause has no parser).
// Fix (DATA, thri-kreen Bite ONLY): shallow-band save_effect "Failure: poisoned
// for 1 minute." + structured save_margin {fails_by:5, also:"paralyzed"}
// (snake_case byte-shape, pseudodragon Sting / drow Hand Crossbow twins
// §MA-1351/MA-0642) + first-in-repo row-level repeat_save WITH an `effect`
// key — the generic MA-0048 lane: armRepeatSaveClause (saveProcessing.js
// :825-832) forks on repeatSave.effect to grantRepeatSaveEffect (te
// thri_kreen_bite_poison, registered Attack group), consumed at turn-END by
// applyRepeatSaveTurnEnd (navigationHandlers :163). NO-effect legacy shapes
// stay on the FP-only trackFrightfulPresence leg byte-identical — never
// route this row there (fork no-op pinned generically by
// repeatSaveService.test.js; FP lane owned by saveProcessing.frightful-presence.test.js).
// Parser truth table for parseSaveMarginClause is owned by
// MonsterCardHelpers.save-margin.test.js — only the thri-kreen disk anchor
// rides live here. Spellcasting row owned by ma1591 sibling.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractConditionsFromSaveEffect, parseSaveMarginClause } from './MonsterCardHelpers.js';
import { buildSaveOptions, saveChipPlan } from './MonsterCardModal.jsx';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

const runtimeStore = {};
const logs = [];

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
  setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
  default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: (campaignName, entry) => { logs.push(entry); return Promise.resolve(); },
}));

let npcConBonus = 19;
vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: async () => ({ creatures: [{ name: 'Bandit 1', type: 'npc', saveBonuses: { constitution: npcConBonus } }], activeCreatureName: 'Bandit 1' }),
  getCurrentCombatRound: () => 1,
  getCombatSummary: () => ({ creatures: [{ name: 'Bandit 1', type: 'npc', saveBonuses: { constitution: npcConBonus } }] }),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasIgnoreResistance: vi.fn(() => false),
  playerIsImmuneToCondition: vi.fn(() => false),
}));

const addExpiration = vi.fn();
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from '../../hooks/combat/saveProcessing.js';
import { applyRepeatSaveTurnEnd } from '../../services/rules/features/repeatSaveService.js';

const campaignName = 'test-campaign';
const ATTACKER = 'Thri-Kreen 1';
const TARGET = 'Bandit 1';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const findAction = (monster, name) => monsters.find((m) => m.name === monster).actions.find((a) => a.name === name);
const BITE = () => findAction('Thri-Kreen', 'Bite');

// Pseudodragon Sting / drow elite warrior Hand Crossbow byte-twins — siblings
// stay byte-locked (fix scope: thri-kreen Bite row ONLY). Owner cite:
// MonsterCardHelpers.save-margin.test.js cites THIS lane for these twin pins.
const STING = () => findAction('Pseudodragon', 'Sting');
const HAND_CROSSBOW = () => findAction('Drow Elite Warrior', 'Hand Crossbow');

const biteContext = (total) => ({
  ...buildSaveOptions(BITE()),
  saveDc: 11,
  saveType: 'CON',
  attackerName: ATTACKER,
  actionName: 'Bite',
  effectiveD20: total,
  effectiveBonus: 0,
});

async function resolveNpcSave(total) {
  return await processSaveRoll({
    rollType: 'save',
    target: { name: TARGET, type: 'npc' },
    characterName: TARGET,
    campaignName,
    context: biteContext(total),
    bonus: 0,
    r1: total,
    r2: null,
    logEntry: vi.fn(),
    setPopupHtml: vi.fn(),
  });
}

const appliedLogs = () => logs.filter(e => e.type === 'condition' && e.action === 'applied');
const tes = () => runtimeStore['campaign.targetEffects'] || [];

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
  logs.length = 0;
  npcConBonus = 19;
});

describe('MA-1584 monsters.json data lock: Thri-Kreen Bite two-band + generic repeat lane', () => {
  it('Bite disk row two-band shape: shallow save_effect harvests POISONED ONLY, save_margin arms the deep band, repeat_save names its te, RAW prose intact', () => {
    const row = BITE();
    // shallow band: NO "paralyzed" word and no repeat prose — the §1105
    // whole-prose harvest must not spray the deep condition (live call)
    expect(row.save_effect).toBe('Failure: poisoned for 1 minute.');
    expect(row.save_effect.toLowerCase()).not.toContain('paralyzed');
    expect(row.save_effect.toLowerCase()).not.toContain('repeat');
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual(['poisoned']);
    // deep band rides ONLY the structured snake_case key (twins §MA-1351/MA-0642);
    // live parser forward pinned here, truth table owned by save-margin.test.js
    expect(row.save_margin).toEqual({ fails_by: 5, also: 'paralyzed' });
    expect(row.save_margin.failsBy).toBeUndefined();
    expect(parseSaveMarginClause(row)).toEqual({ failsBy: 5, also: 'paralyzed' });
    // first-in-repo row-level repeat_save WITH effect key — the `effect`
    // fork separates it from the frightened-hardcoded FP legacy shape
    expect(row.repeat_save).toEqual({
      effect: 'thri_kreen_bite_poison',
      save_type: 'Constitution',
      dc: 11,
      condition: 'poisoned',
    });
    // fix#172 family: rider-only save leg (formula null, saveChipPlan pin
    // below) — dc_success:"none" authored after save_type (MA-0030 placement)
    // kills the MV-20 fabricated half-damage copy; RAW success = nothing.
    expect(row.dc_success).toBe('none');
    expect(Object.keys(row).indexOf('dc_success')).toBe(Object.keys(row).indexOf('save_type') + 1);
    // housekeeping + rules provenance stay in the description
    expect(row.description).toContain('DC 11 Constitution');
    expect(row.description).not.toContain('DC 1 1');
    expect(row.description).toMatch(/fails by 5 or more/);
    expect(row.description).toMatch(/repeat the saving throw at the end of each of its turns/);
  });

  it('te thri_kreen_bite_poison registered Attack group, repeat-save badge copy', () => {
    const def = getEffectDefinition('thri_kreen_bite_poison');
    expect(def).toBeTruthy();
    expect(def).toMatchObject({ label: 'Poisoned', group: 'Attack', cls: 'effect-debuff' });
    expect(def.fields).toEqual(['source', 'dc', 'saveType']);
    expect(def.description).toMatch(/repeats the CON save/i);
    expect(def.description).toMatch(/ending the Poisoned condition on itself on a success/);
  });

  it('modal seams forward the row: save transport threads conditions + margin + repeatSave, save chip stays a clickable condition rider', () => {
    const opts = buildSaveOptions(BITE());
    expect(opts.saveConditions).toEqual(['poisoned']);
    expect(opts.saveMargin).toEqual({ failsBy: 5, also: 'paralyzed' });
    expect(opts.repeatSave).toEqual(BITE().repeat_save);
    expect(saveChipPlan(BITE(), false)).toEqual({ riderOnly: true, formula: null, rollable: false, clickable: true });
  });

  it('siblings byte-locked: Pseudodragon Sting + Drow Elite Warrior Hand Crossbow', () => {
    expect(STING().save_effect).toBe('Failure: 5 (2d4) Poison damage, and the target has the <strong>Poisoned</strong> condition for 1 hour.');
    expect(STING().save_margin).toEqual({ fails_by: 5, also: 'unconscious' });
    expect(STING().repeat_save).toBeUndefined();
    expect(HAND_CROSSBOW().save_effect).toBe('Failure: be poisoned for 1 hour.');
    expect(HAND_CROSSBOW().save_margin).toEqual({ fails_by: 5, also: 'unconscious' });
    expect(HAND_CROSSBOW().repeat_save).toBeUndefined();
    // fix#172 family: both siblings authored dc_success:"none" (MA-0030
    // placement) — RAW success takes nothing on either row.
    expect(STING().dc_success).toBe('none');
    expect(HAND_CROSSBOW().dc_success).toBe('none');
  });
});

describe('MA-1584 margin bands via processSaveRoll (rider-only DC chip seam)', () => {
  it('SUCCESS boundary (total 11 = DC 11): zero conditions, zero te, zero clock', async () => {
    await resolveNpcSave(11);
    expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
    expect(appliedLogs()).toHaveLength(0);
    expect(tes()).toHaveLength(0);
    expect(addExpiration).not.toHaveBeenCalled();
  });

  it('shallow FAIL margin 4 (total 7 vs DC 11): POISONED ONLY — no paralyzed over-grant, no clock', async () => {
    await resolveNpcSave(7);
    expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned']);
    expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned']);
    expect(runtimeStore[`${TARGET}.activeConditionMeta`].poisoned).toMatchObject({ source: ATTACKER });
    expect(addExpiration).not.toHaveBeenCalled();
  });

  it('deep FAIL at the margin-5 boundary (total 6 vs DC 11): Poisoned + Paralyzed with source meta, log, ONE merged rounds:600 clock', async () => {
    await resolveNpcSave(6);
    expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'paralyzed']);
    const conds = appliedLogs().map(e => e.condition);
    expect(conds).toContain('Poisoned');
    expect(conds).toContain('Paralyzed');
    const para = appliedLogs().find(e => e.condition === 'Paralyzed');
    expect(para.sourceName).toBe(ATTACKER);
    expect(para.sourceAbility).toBe('Bite');
    expect(para.description).toMatch(/failed the save by 5/);
    expect(addExpiration).toHaveBeenCalledTimes(1);
    expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
      attackerName: ATTACKER,
      targetName: TARGET,
      campaignName,
      rounds: 600,
      effects: [
        { type: 'condition', condition: 'poisoned' },
        { type: 'condition', condition: 'paralyzed' },
      ],
    }));
  });
});

describe('MA-1584 generic repeat-save lane (disk-row arm through turn-END consumption)', () => {
  it('failed save arms te thri_kreen_bite_poison with repeatSave descriptor + armed log', async () => {
    await resolveNpcSave(7);
    const te = tes().find(t => t.effect === 'thri_kreen_bite_poison');
    expect(te).toBeTruthy();
    expect(te.target).toBe(TARGET);
    expect(te.source).toBe(ATTACKER);
    expect(te.dc).toBe(11);
    expect(te.saveType).toBe('Constitution');
    expect(te.repeatSave).toEqual({ saveType: 'Constitution', dc: 11, condition: 'poisoned' });
    expect(te.duration).toBe('until_repeat_save_succeeds');
    expect(logs.some(e => e.type === 'automation' && e.automationType === 'thri_kreen_bite_poison_repeat_save_armed')).toBe(true);
  });

  it('full turn-END cycle: FAIL keeps te + Poisoned, SUCCESS strips te and ends Poisoned', async () => {
    await resolveNpcSave(7);

    npcConBonus = -19; // any d20 totals ≤ 1 < DC 11 — owed repeat stays failed
    const fail = await applyRepeatSaveTurnEnd(campaignName, TARGET);
    expect(fail.handled).toBe(true);
    expect(fail.results[0]).toMatchObject({ effect: 'thri_kreen_bite_poison', success: false });
    const failLog = logs.find(e => e.type === 'save_result' && e.rollType === 'save-repeat');
    expect(failLog.success).toBe(false);
    expect(tes().find(t => t.effect === 'thri_kreen_bite_poison')).toBeTruthy();
    expect(runtimeStore[`${TARGET}.activeConditions`]).toContain('poisoned');

    npcConBonus = 19; // any d20 totals ≥ 11 — repeat succeeds, effect ends on itself
    const ok = await applyRepeatSaveTurnEnd(campaignName, TARGET);
    expect(ok.handled).toBe(true);
    expect(ok.results[0]).toMatchObject({ effect: 'thri_kreen_bite_poison', success: true });
    const okLog = logs.filter(e => e.type === 'save_result' && e.rollType === 'save-repeat').at(-1);
    expect(okLog.success).toBe(true);
    expect(okLog.saveDc).toBe(11);
    expect(tes().find(t => t.effect === 'thri_kreen_bite_poison')).toBeUndefined();
    expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual([]);
    expect(logs.some(e => e.type === 'condition' && e.action === 'removed' && e.condition === 'Poisoned')).toBe(true);
  });
});
