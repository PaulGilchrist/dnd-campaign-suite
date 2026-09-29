// MA-1584: Thri-Kreen Bite — save_effect carried the deep-band word
// "paralyzed" AND the repeat-save prose ungated, so extractConditionsFromSaveEffect
// (§1105 whole-prose harvest) sprayed poisoned AND paralyzed on EVERY failed
// save and the EOT repeat never fired (§622: prose repeat clause has no parser).
// Fix (DATA, thri-kreen Bite ONLY): shallow-band save_effect "Failure: poisoned
// for 1 minute." + structured save_margin {fails_by:5, also:"paralyzed"}
// (snake_case byte-shape, pseudodragon Sting / drow Hand Crossbow twins
// §MA-1351/MA-0642) + first-in-repo row-level repeat_save WITH an `effect`
// key — the generic MA-0048 lane: armRepeatSaveClause (:638-645) forks on
// repeatSave.effect to grantRepeatSaveEffect (te thri_kreen_bite_poison,
// registered Attack group), consumed at turn-END by applyRepeatSaveTurnEnd
// (navigationHandlers :163). NO-effect legacy shapes stay on the FP-only
// trackFrightfulPresence leg byte-identical — never route this row there.
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

vi.mock('../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: () => ({ promise: new Promise(() => {}) }),
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
const BITE = () => monsters.find((m) => m.name === 'Thri-Kreen').actions[1];

// Pseudodragon Sting / drow elite warrior Hand Crossbow byte-twins — siblings
// stay byte-locked (fix scope: thri-kreen Bite row ONLY).
const STING = () => monsters.find((m) => m.name === 'Pseudodragon').actions[2];
const HAND_CROSSBOW = () => monsters.find((m) => m.name === 'Drow Elite Warrior').actions[2];

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
  it('save_effect byte-pinned to the shallow band — NO "paralyzed" substring', () => {
    expect(BITE().save_effect).toBe('Failure: poisoned for 1 minute.');
    expect(BITE().save_effect.toLowerCase()).not.toContain('paralyzed');
    expect(BITE().save_effect.toLowerCase()).not.toContain('repeat');
  });

  it('extractConditionsFromSaveEffect harvests POISONED ONLY (live call)', () => {
    expect(extractConditionsFromSaveEffect(BITE().save_effect)).toEqual(['poisoned']);
  });

  it('save_margin byte-shape toEqual — snake_case fails_by (pseudodragon/drow twins)', () => {
    expect(BITE().save_margin).toEqual({ fails_by: 5, also: 'paralyzed' });
    expect(BITE().save_margin.failsBy).toBeUndefined();
  });

  it('parseSaveMarginClause forwards {failsBy:5, also:"paralyzed"} on the save transport', () => {
    expect(parseSaveMarginClause(BITE())).toEqual({ failsBy: 5, also: 'paralyzed' });
  });

  it('repeat_save names its te — generic MA-0048 lane, NOT the FP legacy shape', () => {
    expect(BITE().repeat_save).toEqual({
      effect: 'thri_kreen_bite_poison',
      save_type: 'Constitution',
      dc: 11,
      condition: 'poisoned',
    });
    // FP legacy shape (no effect key) would route armRepeatSaveClause to the
    // frightened-hardcoded trackFrightfulPresence leg — never this row.
    expect(BITE().repeat_save.effect).toBe('thri_kreen_bite_poison');
  });

  it('buildSaveOptions forwards shallow-band conditions + margin + repeatSave', () => {
    const opts = buildSaveOptions(BITE());
    expect(opts.saveConditions).toEqual(['poisoned']);
    expect(opts.saveMargin).toEqual({ failsBy: 5, also: 'paralyzed' });
    expect(opts.repeatSave).toEqual(BITE().repeat_save);
  });

  it('save chip stays a clickable condition rider on the composite attack+save row', () => {
    const plan = saveChipPlan(BITE(), false);
    expect(plan.riderOnly).toBe(true);
    expect(plan.formula).toBeNull();
    expect(plan.clickable).toBe(true);
  });

  it('description typo housekeeping: "DC 11 Constitution", deep band stays in prose', () => {
    expect(BITE().description).toContain('DC 11 Constitution');
    expect(BITE().description).not.toContain('DC 1 1');
    expect(BITE().description).toContain('fails by 5 or more');
    expect(BITE().description).toContain('repeat the saving throw at the end of each of its turns');
  });

  it('te thri_kreen_bite_poison registered Attack group, whirlwind repeat-save byte-shape', () => {
    const def = getEffectDefinition('thri_kreen_bite_poison');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Poisoned');
    expect(def.group).toBe('Attack');
    expect(def.cls).toBe('effect-debuff');
    expect(def.fields).toEqual(['source', 'dc', 'saveType']);
    expect(def.description).toMatch(/repeats the CON save/i);
    expect(def.description).toMatch(/ending the Poisoned condition on itself on a success/);
  });

  it('siblings byte-locked: Pseudodragon Sting + Drow Elite Warrior Hand Crossbow', () => {
    expect(STING().save_effect).toBe('Failure: 5 (2d4) Poison damage, and the target has the <strong>Poisoned</strong> condition for 1 hour.');
    expect(STING().save_margin).toEqual({ fails_by: 5, also: 'unconscious' });
    expect(STING().repeat_save).toBeUndefined();
    expect(HAND_CROSSBOW().save_effect).toBe('Failure: be poisoned for 1 hour.');
    expect(HAND_CROSSBOW().save_margin).toEqual({ fails_by: 5, also: 'unconscious' });
    expect(HAND_CROSSBOW().repeat_save).toBeUndefined();
  });
});

describe('MA-1584 margin bands via processSaveRoll (rider-only DC chip seam)', () => {
  it('SUCCESS (total 11 vs DC 11): zero conditions, zero te, zero clock', async () => {
    await resolveNpcSave(11);
    expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
    expect(appliedLogs()).toHaveLength(0);
    expect(tes()).toHaveLength(0);
    expect(addExpiration).not.toHaveBeenCalled();
  });

  it('shallow FAIL margin 4 (total 7 vs DC 11): POISONED ONLY — no paralyzed over-grant', async () => {
    await resolveNpcSave(7);
    expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned']);
    expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned']);
    expect(runtimeStore[`${TARGET}.activeConditionMeta`].poisoned).toMatchObject({ source: ATTACKER });
    expect(addExpiration).not.toHaveBeenCalled();
  });

  it('deep FAIL margin 5 boundary (total 6 vs DC 11): Poisoned + Paralyzed + rider log', async () => {
    await resolveNpcSave(6);
    expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'paralyzed']);
    const conds = appliedLogs().map(e => e.condition);
    expect(conds).toContain('Poisoned');
    expect(conds).toContain('Paralyzed');
    const para = appliedLogs().find(e => e.condition === 'Paralyzed');
    expect(para.sourceName).toBe(ATTACKER);
    expect(para.sourceAbility).toBe('Bite');
    expect(para.description).toMatch(/failed the save by 5/);
  });

  it('deep FAIL beyond the band (total 2, margin 9): Poisoned + Paralyzed, ONE merged rounds:600 clock', async () => {
    await resolveNpcSave(2);
    expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'paralyzed']);
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

describe('MA-1584 generic repeat-save lane (grantRepeatSaveEffect + applyRepeatSaveTurnEnd)', () => {
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

  it('legacy FP shape (no effect key) never reaches the generic lane', async () => {
    await processSaveRoll({
      rollType: 'save',
      target: { name: TARGET, type: 'npc' },
      characterName: TARGET,
      campaignName,
      context: { ...biteContext(6), repeatSave: { condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 } },
      bonus: 0,
      r1: 6,
      r2: null,
      logEntry: vi.fn(),
      setPopupHtml: vi.fn(),
    });
    expect(tes().find(t => t.effect === 'thri_kreen_bite_poison')).toBeUndefined();
  });

  it('turn-END repeat SUCCESS (+19): save-repeat log, te stripped, poisoned ends', async () => {
    await resolveNpcSave(7);
    npcConBonus = 19;
    const out = await applyRepeatSaveTurnEnd(campaignName, TARGET);
    expect(out.handled).toBe(true);
    expect(out.results[0]).toMatchObject({ effect: 'thri_kreen_bite_poison', success: true });
    const res = logs.find(e => e.type === 'save_result' && e.rollType === 'save-repeat');
    expect(res).toBeTruthy();
    expect(res.saveDc).toBe(11);
    expect(res.success).toBe(true);
    expect(tes().find(t => t.effect === 'thri_kreen_bite_poison')).toBeUndefined();
    expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual([]);
    expect(logs.some(e => e.type === 'condition' && e.action === 'removed' && e.condition === 'Poisoned')).toBe(true);
  });

  it('turn-END repeat FAIL (-19): remains Poisoned, te persists, repeat owed', async () => {
    await resolveNpcSave(7);
    npcConBonus = -19;
    const out = await applyRepeatSaveTurnEnd(campaignName, TARGET);
    expect(out.handled).toBe(true);
    expect(out.results[0].success).toBe(false);
    const res = logs.find(e => e.type === 'save_result' && e.rollType === 'save-repeat');
    expect(res.success).toBe(false);
    expect(tes().find(t => t.effect === 'thri_kreen_bite_poison')).toBeTruthy();
    expect(runtimeStore[`${TARGET}.activeConditions`]).toContain('poisoned');
  });

  it('turn-END without the te is byte-inert (handled:false)', async () => {
    const out = await applyRepeatSaveTurnEnd(campaignName, TARGET);
    expect(out.handled).toBe(false);
  });
});
