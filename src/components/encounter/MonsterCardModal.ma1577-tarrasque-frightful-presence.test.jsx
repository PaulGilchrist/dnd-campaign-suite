// @maintained-by-ai
// MA-1577: Tarrasque "Frightful Presence" (actions row, DC 17 Wisdom, frightened).
// The FIX was pure data: the row gained structured
//   success_immunity:{effect:'frightful_presence_immunity',duration:'24_hours',duration_minutes:1440}
//   repeat_save:{condition:'frightened',save_type:'Wisdom',duration_minutes:1}
// (byte-shape of the VERIFIED live twin Adult Blue Dracolich FP row, MA-0048/0044),
// turning the prose-only EOT repeat-save + 24h immunity LIVE with zero code change,
// plus cosmetic housekeeping "ofthe tarrasque's"→"of the tarrasque's" (FP row only).
// This file owns: the tarrasque FP disk-row identity + typo byte-scope, and the
// row-driven behavior chain arm→EOT-success→24h-immunity / EOT-fail refusal at DC 17.
// Cited owners (not re-tested here):
// - armRepeatSaveClause fork (repeat_save truthy + NO effect key ⇒ FP legacy leg, not
//   generic repeatSaveService): saveProcessing.frightful-presence.test.js
// - service legs (track/grant/turn-end, parse of success_immunity, NPC auto-roll):
//   frightfulPresenceService.test.js; parse + gate truth table:
//   MonsterCardHelpers.gaze-immunity.test.js; FP row-click refusal gate:
//   saveProcessing.ma1997-smaug-frightful-presence.test.js
// - save transport (buildAbilitySaveRollContext forwards repeatSave + successImmunity
//   verbatim from an FP actions row): MonsterCardModal.dracolich-fp.test.jsx +
//   MonsterCardModal.secondary-save-transport.test.js
// - tarrasque siblings: Bite grapple MA-1573, Swallow MA-1578 (which also sibling
//   byte-locks this FP row); dracolich twin row: MonsterCardModal.dracolich-fp.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import monstersData from '../../../public/data/monsters.json';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { setCombatSummaryCache } from '../../services/encounters/combatData.js';
import {
  trackFrightfulPresence, applyFrightfulPresenceTurnEnd,
  FP_TE_EFFECT, FP_IMMUNITY_TE_EFFECT,
} from '../../services/rules/features/frightfulPresenceService.js';

const LOGS = vi.hoisted(() => []);
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn((_campaign, entry) => { LOGS.push(entry); return Promise.resolve(); }),
}));
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
vi.mock('../../services/automation/common/savePrompt.js', async (importActual) => ({
  ...(await importActual()),
  createSaveListener: vi.fn((_campaign, opts) => {
    LISTENER_OPTS.push(opts);
    return { promise: Promise.resolve({ roll: 20, saveBonus: 0, total: 20, success: true }) };
  }),
}));

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const FP = monstersData.find((m) => m.index === 'tarrasque').actions.find((a) => a.name === 'Frightful Presence');

const CAMPAIGN = 'test-campaign';
const ATTACKER = 'Tarrasque 1';
const TARGET = 'Bandit 1';

function fpTe() {
  return (runtime.store['campaign.targetEffects'] || []).find((e) => e.effect === FP_TE_EFFECT && e.target === TARGET);
}

// Arm exactly the way the fork owner routes a failed FP save: row values in,
// FP legacy leg (repeat_save carries NO effect key — pinned in test 1).
async function armFromRow() {
  await trackFrightfulPresence({
    campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: TARGET,
    saveType: FP.repeat_save.save_type, saveDc: FP.save_dc,
  });
  runtime.store[`${TARGET}.activeConditions`] = ['frightened'];
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach((k) => delete runtime.store[k]);
  LOGS.length = 0;
  CLOCKS.length = 0;
  LISTENER_OPTS.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
  setCombatSummaryCache(null, CAMPAIGN);
});

describe('MA-1577 tarrasque FP disk row', () => {
  it('full-row toEqual identity: structured success_immunity + repeat_save objects (not booleans, MA-0147), damageless DC 17 WIS frightened row, typo fixed and scoped to this row only', () => {
    expect(FP).toEqual({
      name: 'Frightful Presence',
      description: "Each creature of the tarrasque's choice within 120 feet of it and aware of it must succeed on a DC 17 Wisdom saving throw or become frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, with disadvantage if the tarrasque is within line of sight, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the tarrasque's Frightful Presence for the next 24 hours.",
      save_dc: 17,
      save_type: 'Wisdom',
      success_immunity: { effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 },
      repeat_save: { condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 },
      save_effect: 'Failure: become frightened for 1 minute A creature can repeat the saving throw at the end of each of its turns with disadvantage, ending the effect on itself on a success. The creature is immune to this effect for the next 24 hours.',
    });
    expect(extractConditionsFromSaveEffect(FP.save_effect)).toEqual(['frightened']);
    // No `effect` key ⇒ fork owner routes to trackFrightfulPresence, not repeatSaveService.
    expect(FP.repeat_save.effect).toBeUndefined();
    expect(FP.damage_dice_primary == null).toBe(true);
    // Byte-scope of the cosmetic fix: fixed bytes once file-wide, typo gone,
    // untouched Swallow-row twin typo stays put (fix scope = FP row only).
    expect(RAW.split("of the tarrasque's choice").length - 1).toBe(1);
    expect(RAW.split("ofthe tarrasque's").length - 1).toBe(0);
    expect(RAW).toContain('within 10 feet ofthe tarrasque');
  });
});

describe('MA-1577 row-driven repeat-save lane (arm → EOT)', () => {
  it('arm from row arms DC 17 WIS frightened te + ONE 10-round clock ending with immunity-grant leg; PC turn-end save success sheds Frightened, strips te, grants 24h immunity (14400 rounds)', async () => {
    setCombatSummaryCache({ round: 1, creatures: [{ name: TARGET, type: 'player' }] }, CAMPAIGN);
    await armFromRow();

    expect(fpTe()).toEqual({
      target: TARGET, effect: FP_TE_EFFECT, source: ATTACKER, duration: '1_minute',
      condition: 'frightened', saveType: 'Wisdom', dc: 17, rounds: 10,
    });
    expect(CLOCKS).toEqual([expect.objectContaining({ rounds: 10, targetName: TARGET, attackerName: ATTACKER })]);
    expect(CLOCKS[0].effects.map((e) => e.type)).toEqual(['remove_target_effect', 'condition', 'frightful_presence_immunity_grant']);
    expect(LOGS.some((l) => l.automationType === 'frightful_presence_tracked' && l.sourceName === ATTACKER && l.characterName === TARGET)).toBe(true);

    const res = await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET);
    expect(res).toMatchObject({ handled: true, success: true });
    expect(LISTENER_OPTS[0]).toMatchObject({ targetName: TARGET, saveType: 'WIS', saveDc: 17, dcSuccess: 'none' });
    expect(runtime.store[`${TARGET}.activeConditions`]).toEqual([]);
    expect(fpTe()).toBeUndefined();
    const immunity = (runtime.store['campaign.targetEffects'] || []).find((e) => e.effect === FP_IMMUNITY_TE_EFFECT && e.target === TARGET);
    expect(immunity).toEqual({ target: TARGET, effect: FP_IMMUNITY_TE_EFFECT, source: ATTACKER, duration: '24_hours', rounds: 14400 });
    expect(CLOCKS).toEqual([
      expect.objectContaining({ rounds: 10 }),
      expect.objectContaining({ rounds: 14400, targetName: TARGET, attackerName: ATTACKER }),
    ]);
    expect(LOGS.some((l) => l.rollType === 'save-fp-repeat' && l.success === true && l.saveDc === 17)).toBe(true);
    expect(LOGS.some((l) => l.action === 'removed' && l.condition === 'Frightened')).toBe(true);
    expect(LOGS.some((l) => l.automationType === 'frightful_presence_immunity_granted' && l.description.includes('14400'))).toBe(true);
  });

  it('NPC turn-end save fails DC 17: remains Frightened, te + frightened intact, zero immunity written and no PC prompt', async () => {
    setCombatSummaryCache({ round: 1, creatures: [{ name: TARGET, type: 'npc', saveBonuses: { wis: 0 } }] }, CAMPAIGN);
    await armFromRow();
    vi.spyOn(Math, 'random').mockReturnValue(0); // roll 1 + 0 < 17

    const res = await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET);
    expect(res).toMatchObject({ handled: true, success: false });
    expect(LISTENER_OPTS).toHaveLength(0); // NPC auto-roll lane, no prompt
    expect(runtime.store[`${TARGET}.activeConditions`]).toEqual(['frightened']);
    expect(fpTe()).toBeTruthy();
    expect((runtime.store['campaign.targetEffects'] || []).filter((e) => e.effect === FP_IMMUNITY_TE_EFFECT)).toHaveLength(0);
    expect(CLOCKS).toHaveLength(1); // only the arm clock — no immunity clock
    expect(LOGS.some((l) => l.rollType === 'save-fp-repeat' && l.success === false && l.saveDc === 17)).toBe(true);
  });
});
