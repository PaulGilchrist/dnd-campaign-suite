// @improved-by-ai
// MA-1577: Tarrasque "Frightful Presence" (aoe-save, DC 17 Wisdom, frightened) —
// FAIL(a): DC/save/Frightened grant was LIVE honest but the EOT repeat-save and the
// 24h success-immunity were prose-only. DATA fix: the row gains structured
//   success_immunity:{effect:'frightful_presence_immunity',duration:'24_hours',duration_minutes:1440}
//   repeat_save:{condition:'frightened',save_type:'Wisdom',duration_minutes:1}
// byte-shape copied from the VERIFIED live twin Adult Blue Dracolich FP row (MA-0048).
// Objects (NOT booleans — booleans kill the service, MA-0147). Key order mirrors the
// dracolich row: success_immunity then repeat_save, before save_effect.
// Lanes (zero code change): saveProcessing.js armRepeatSaveClause (:638-645) arms on
// structured context.repeat_save — NO `effect` key ⇒ legacy FP leg trackFrightfulPresence
// (:644), turn-END consumer navigationHandlers applyFrightfulPresenceTurnEnd LIVE;
// applyAuthoredClauseGrants (:339) grants parseSuccessImmunity te on save success.
// MonsterCardModal.buildAbilitySaveRollContext (:1592-1595) forwards both row keys verbatim.
// Cosmetic housekeeping in the SAME row: "ofthe tarrasque's"→"of the tarrasque's" (description).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import monstersData from '../../../public/data/monsters.json';
import { parseSuccessImmunity, gazeImmunityActive, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';
import { setCombatSummaryCache } from '../../services/encounters/combatData.js';
import {
  trackFrightfulPresence, grantFrightfulPresenceImmunity, applyFrightfulPresenceTurnEnd,
  FP_TE_EFFECT, FP_IMMUNITY_TE_EFFECT,
} from '../../services/rules/features/frightfulPresenceService.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
const LOGS = vi.hoisted(() => []);
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn((_campaign, entry) => { LOGS.push(entry); return Promise.resolve(); }),
}));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(), rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })),
}));
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 30),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));
const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));
const CLOCKS = vi.hoisted(() => []);
vi.mock('../../services/rules/effects/expirationQueue.js', async (importActual) => ({
  ...(await importActual()),
  addExpiration: vi.fn((entry) => { CLOCKS.push(entry); }),
}));
const LISTENER_OPTS = vi.hoisted(() => []);
const listenerState = vi.hoisted(() => ({ success: true }));
vi.mock('../../services/automation/common/savePrompt.js', async (importActual) => ({
  ...(await importActual()),
  createSaveListener: vi.fn((_campaign, opts) => {
    LISTENER_OPTS.push(opts);
    return { promise: Promise.resolve({ roll: 20, saveBonus: 0, total: 20, success: listenerState.success }) };
  }),
}));

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const TARRASQUE = monstersData.find((m) => m.index === 'tarrasque');
const FP = TARRASQUE.actions.find((a) => a.name === 'Frightful Presence');
const DRACOLICH = monstersData.find((m) => m.index === 'adult-blue-dracolich');
const DRAC_FP = DRACOLICH.actions.find((a) => a.name === 'Frightful Presence');

const CAMPAIGN = 'test-campaign';
const ATTACKER = 'Tarrasque 1';
const TARGET = 'Bandit 1';

function rawCount(haystack, needle) {
  return haystack.split(needle).length - 1;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach((k) => delete runtime.store[k]);
  LOGS.length = 0;
  CLOCKS.length = 0;
  LISTENER_OPTS.length = 0;
  listenerState.success = true;
});

describe('MA-1577 monsters.json data lock: Tarrasque FP structured repeat_save + success_immunity', () => {
  it('success_immunity object toEqual (24h, effect key) — object not boolean (MA-0147)', () => {
    expect(FP.success_immunity).toEqual({
      effect: 'frightful_presence_immunity',
      duration: '24_hours',
      duration_minutes: 1440,
    });
  });

  it('repeat_save object toEqual — FP legacy lane shape (NO effect key ⇒ trackFrightfulPresence)', () => {
    expect(FP.repeat_save).toEqual({ condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 });
    expect(FP.repeat_save.effect).toBeUndefined();
  });

  it('existing save fields intact + damageless FP grant stays honest', () => {
    expect(FP.save_dc).toBe(17);
    expect(FP.save_type).toBe('Wisdom');
    expect(FP.damage_dice_primary == null).toBe(true);
    expect(extractConditionsFromSaveEffect(FP.save_effect)).toEqual(['frightened']);
    expect(FP.save_effect).toBe('Failure: become frightened for 1 minute A creature can repeat the saving throw at the end of each of its turns with disadvantage, ending the effect on itself on a success. The creature is immune to this effect for the next 24 hours.');
  });

  it('key order mirrors dracolich twin: success_immunity → repeat_save → save_effect, byte-identical twin blocks', () => {
    const clauseBlock = (anchor) => {
      const i = RAW.indexOf(anchor);
      expect(i).toBeGreaterThan(-1);
      return RAW.slice(RAW.indexOf('"success_immunity"', i), RAW.indexOf('"save_effect"', i));
    };
    const twin = clauseBlock('Each creature ofthe dracolich');
    const fixed = clauseBlock('Each creature of the tarrasque');
    expect(fixed).toBe(twin); // same keys, same order, same indent as the verified live twin
    expect(fixed.indexOf('"success_immunity"')).toBeLessThan(fixed.indexOf('"repeat_save"'));
    expect(fixed.indexOf('"repeat_save"')).toBeLessThan(fixed.length);
    expect(FP.success_immunity).toEqual(DRAC_FP.success_immunity);
    expect(FP.repeat_save).toEqual(DRAC_FP.repeat_save);
  });

  it('tarrasque-FP-unique fixed bytes appear exactly once file-wide; typo gone', () => {
    const FIXED_ROW_BLOCK = `"description": "Each creature of the tarrasque's choice within 120 feet of it and aware of it must succeed on a DC 17 Wisdom saving throw or become frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, with disadvantage if the tarrasque is within line of sight, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the tarrasque's Frightful Presence for the next 24 hours.",
        "save_dc": 17,
        "save_type": "Wisdom",
        "success_immunity": {
          "effect": "frightful_presence_immunity",
          "duration": "24_hours",
          "duration_minutes": 1440
        },
        "repeat_save": {
          "condition": "frightened",
          "save_type": "Wisdom",
          "duration_minutes": 1
        },`;
    expect(rawCount(RAW, FIXED_ROW_BLOCK)).toBe(1);
    expect(rawCount(RAW, 'of the tarrasque\'s choice')).toBe(1);
    expect(rawCount(RAW, 'ofthe tarrasque\'s')).toBe(0);
    // Untouched Swallow-row twin typo byte stays put (fix scope = FP row only):
    expect(RAW).toContain('within 10 feet ofthe tarrasque');
  });

  it('sibling byte-lock: dracolich twin row intact (MA-0048/MA-0044 keys unchanged)', () => {
    expect(DRAC_FP.save_dc).toBe(18);
    expect(DRAC_FP.dc_success).toBe('none');
    expect(DRAC_FP.success_immunity).toEqual({ effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 });
    expect(DRAC_FP.repeat_save).toEqual({ condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 });
    expect(RAW).toContain('Each creature ofthe dracolich\'s choice that is within 120 feet ofthe dracolich and aware of it must succeed on a DC 18 Wisdom saving throw');
  });

  it('whole-diff scope: file is valid JSON, tarrasque FP row is the only row gained these keys via this fix anchor', () => {
    const parsed = JSON.parse(RAW);
    const row = parsed.find((m) => m.index === 'tarrasque').actions.find((a) => a.name === 'Frightful Presence');
    expect(row).toEqual(FP);
    expect(rawCount(RAW, 'of the tarrasque\'s choice')).toBe(1);
  });
});

describe('MA-1577 save transport: buildAbilitySaveRollContext forwards both structured keys', () => {
  it('context carries repeatSave + successImmunity verbatim at DC 17, damageless', () => {
    const ctx = buildAbilitySaveRollContext({
      monsterName: ATTACKER,
      target: { name: TARGET },
      spellName: null,
      action: FP,
      saveType: 'WIS',
      dcSuccess: 'half',
      saveDamageFormula: null,
      saveConditions: ['frightened'],
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction: () => [],
      spellDamageType: null,
    });
    expect(ctx.saveDc).toBe(17);
    expect(ctx.saveConditions).toEqual(['frightened']);
    expect(ctx.autoDamageFormula).toBe(null);
    expect(ctx.repeatSave).toEqual({ condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 });
    expect(ctx.successImmunity).toEqual({ effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 });
  });

  it('armRepeatSaveClause fork (:638-645): repeatSave truthy + NO effect ⇒ FP leg, not repeatSaveService', async () => {
    const ctxRepeatSave = FP.repeat_save;
    expect(ctxRepeatSave).toBeTruthy();
    expect(ctxRepeatSave.effect).toBeFalsy();
    // Mirror saveProcessing.js:640-644 dispatch against the FIXED row:
    if (ctxRepeatSave.effect) throw new Error('must not route to generic repeatSaveService');
    await trackFrightfulPresence({ campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: TARGET, saveType: ctxRepeatSave.save_type, saveDc: FP.save_dc });
    const te = (runtime.store['campaign.targetEffects'] || []).find((e) => e.effect === FP_TE_EFFECT && e.target === TARGET);
    expect(te).toMatchObject({ effect: FP_TE_EFFECT, source: ATTACKER, dc: 17, saveType: 'Wisdom', condition: 'frightened', rounds: 10 });
    expect(CLOCKS).toHaveLength(1);
    expect(CLOCKS[0]).toMatchObject({ rounds: 10, targetName: TARGET, attackerName: ATTACKER });
    expect(CLOCKS[0].effects.map((e) => e.type)).toEqual(expect.arrayContaining(['remove_target_effect', 'condition', 'frightful_presence_immunity_grant']));
    expect(LOGS.some((l) => l.automationType === 'frightful_presence_tracked' && l.sourceName === ATTACKER && l.characterName === TARGET)).toBe(true);
  });
});

describe('MA-1577 success-immunity parse + gate (applyAuthoredClauseGrants :339 leg)', () => {
  it('parseSuccessImmunity on the fixed row → 1440 min ⇒ CLA-334 14400-round clock', () => {
    const immunity = parseSuccessImmunity({ success_immunity: FP.success_immunity });
    expect(immunity).toEqual({ effect: 'frightful_presence_immunity', duration: '24_hours', durationMinutes: 1440 });
    expect(immunity.durationMinutes * 10).toBe(14400);
  });

  it('gazeImmunityActive refuses re-fire for a target already carrying the tarrasque-sourced immunity te', () => {
    const teList = [{ target: TARGET, effect: FP_IMMUNITY_TE_EFFECT, source: ATTACKER }];
    expect(gazeImmunityActive({ action: FP, target: { name: TARGET }, monsterName: ATTACKER, targetEffects: teList })).toEqual({ effect: 'frightful_presence_immunity', duration: '24_hours', durationMinutes: 1440 });
    expect(gazeImmunityActive({ action: FP, target: { name: TARGET }, monsterName: ATTACKER, targetEffects: [] })).toBe(null);
  });

  it('grantFrightfulPresenceImmunity writes 24h te (14400 rounds) + clock + granted log', async () => {
    await grantFrightfulPresenceImmunity({ campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: TARGET, reason: 'MA-1577' });
    const te = (runtime.store['campaign.targetEffects'] || []).find((e) => e.effect === FP_IMMUNITY_TE_EFFECT && e.target === TARGET);
    expect(te).toMatchObject({ effect: FP_IMMUNITY_TE_EFFECT, source: ATTACKER, duration: '24_hours', rounds: 14400 });
    expect(CLOCKS).toEqual([expect.objectContaining({ rounds: 14400 })]);
    expect(LOGS.some((l) => l.automationType === 'frightful_presence_immunity_granted' && l.description.includes('14400'))).toBe(true);
  });
});

describe('MA-1577 EOT repeat-save LIVE (applyFrightfulPresenceTurnEnd via navigationHandlers)', () => {
  function armFpTe(dc = 17) {
    runtime.store['campaign.targetEffects'] = [{
      target: TARGET, effect: FP_TE_EFFECT, source: ATTACKER,
      condition: 'frightened', saveType: 'Wisdom', dc, duration: '1_minute',
    }];
    runtime.store[`${TARGET}.activeConditions`] = ['frightened'];
  }

  it('NPC Bandit failed repeat save at DC 17: remains Frightened, te stays, zero immunity', async () => {
    armFpTe();
    vi.spyOn(Math, 'random').mockReturnValue(0); // roll 1 < 17
    const res = await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET);
    expect(res).toMatchObject({ handled: true, success: false });
    expect(runtime.store[`${TARGET}.activeConditions`]).toEqual(['frightened']);
    expect(runtime.store['campaign.targetEffects']).toHaveLength(1);
    expect(CLOCKS).toHaveLength(0);
    expect(LOGS.some((l) => l.rollType === 'save-fp-repeat' && l.success === false && l.saveDc === 17)).toBe(true);
    vi.restoreAllMocks();
  });

  it('PC save-success leg: prompt DC 17 WIS → strips te + Frightened, grants frightful_presence_immunity 14400 rounds', async () => {
    setCombatSummaryCache({ round: 1, creatures: [{ name: TARGET, type: 'player' }] }, CAMPAIGN);
    armFpTe();
    const res = await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET);
    expect(res.handled).toBe(true);
    expect(res.success).toBe(true);
    expect(LISTENER_OPTS[0]).toMatchObject({ targetName: TARGET, saveType: 'WIS', saveDc: 17, dcSuccess: 'none' });
    expect(runtime.store[`${TARGET}.activeConditions`]).toEqual([]);
    const te = (runtime.store['campaign.targetEffects'] || []).find((e) => e.effect === FP_IMMUNITY_TE_EFFECT && e.target === TARGET);
    expect(te).toMatchObject({ effect: FP_IMMUNITY_TE_EFFECT, source: ATTACKER, rounds: 14400 });
    expect(CLOCKS).toEqual([expect.objectContaining({ rounds: 14400 })]);
    expect(LOGS.some((l) => l.rollType === 'save-fp-repeat' && l.success === true)).toBe(true);
    expect(LOGS.some((l) => l.action === 'removed' && l.condition === 'Frightened')).toBe(true);
    expect(LOGS.some((l) => l.automationType === 'frightful_presence_immunity_granted')).toBe(true);
    setCombatSummaryCache(null, CAMPAIGN);
  });
});
