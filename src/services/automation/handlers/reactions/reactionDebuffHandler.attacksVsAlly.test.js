// @maintained-by-ai
// reactionDebuffHandler octet+ — lane: ATTACKS-VS-ALLY GATE (effect
// 'disadvantage_on_attacks_vs_ally' — the Protection fighting-style Reaction,
// live from rules-fightingStyles.js 5e + 2024, dispatched via
// automation/index.js `reaction_debuff` → handle → EFFECT_ROUTES).
//
// Nine-file seam map over reactionDebuffHandler.js (each lane owns what it
// pins; do not duplicate across lanes):
//  - attacksVsAlly (THIS file, #1 first of queue): handleAttacksVsAlly
//      (findLastAttack gate, defender gate, range gate, protection-te upsert)
//      + logAttacksVsAllyTail + this route's spendUse channel
//      (setRuntimeValue '<feature>Uses' — the NON-preSpent route).
//  - .branchesOfTheTree.test.js:       teleport_and_slow route — Rage gate,
//      campaign-root activeCreatureName, STR save prompt + save-result
//      teleport/expiration ('refuses when Rage is not active...',
//      'on fail: teleports — stamps branches_of_the_tree_teleport marker te...').
//  - .cuttingWords.latch.test.js:      bardic default path round latch +
//      attack-instance marker ('refuses the same attack roll twice...',
//      'passes campaignName + mapName + playerName to resolveMapPositions...').
//  - .cuttingWords.test.js:            bardic BI d20/damage reduction sim
//      ('reduces d20 by bardic inspiration die...', 'reduces damage and heals target').
//  - .defaultPath.test.js:             handleAttackRollDebuff / handleDamageDebuff
//      detail ('caps reduced d20 at minimum of 1', 'returns popup when damage
//      event has no targetName', 'uses primaryDamage as fallback when totalDamage is 0').
//  - .disadvantage.test.js:            warding-flare route out-of-range +
//      Improved Warding Flare tempHp tail ('returns popup when out of range'
//      for effect disadvantage_on_attack_roll — NOT this lane's same-named
//      test, which pins handleAttacksVsAlly's gate).
//  - .earlyExits.test.js:              generic handle() guards before routing
//      (requiresShield, uses-exhausted recharge label, no combat context).
//  - .uses.test.js:                    bardic default-path spend via the
//      setRuntimeObject stampPatch channel ('decrements uses based on current
//      value and uses max') — this lane pins the setRuntimeValue spendUse channel instead.
//  - .wardingFlare.test.js:            disadvantage_next_attack te-producer
//      ('spends one use and writes te disadvantage_next_attack...' — its own
//      wardingflareUses key; blesseddefenderUses stays this lane's).
//
// KNOWN PRODUCTION DEFECT (reported, source NOT touched per task): handleAttacksVsAlly
// calls resolveMapPositions(campaignName, playerName) — 2 args, real signature is
// (campaignName, mapName, attackerName) — so live the gate lookup resolves null and
// the range refusal is silently unreachable. This lane keeps the mock-level pin so
// the INTENDED refusal behaviour is locked for whoever fixes the arity; it does NOT
// pin the broken argument order (cf. cuttingWords.latch pinning the correct 3-arg call).
//
// Deterministic: runtime/logService/range/rollback/infoPopup fully mocked; the random
// second d20 (handleDisadvantageDebuff) only varies unpinned numerals in the popup
// text — static substring + exact-key pins hold. No churn expected.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ────────────────────────────────────────

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
  setRuntimeObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../common/infoPopup.js', () => ({
  infoPopup: vi.fn().mockImplementation((name, description, automation, extraProps) => {
    const result = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name,
        description,
        automation,
      },
    };
    if (extraProps) {
      Object.assign(result, extraProps);
    }
    return result;
  }),
}));

// ── Imports ─────────────────────────────────────────────────────

import { handle } from './reactionDebuffHandler.js';

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';

// ── Helpers ─────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'DungeonMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Paladin',
    proficiency: 2,
    level: 5,
    abilities: [{ name: 'Wisdom', bonus: 2 }],
    characterAdvancement: [],
    specialActions: [],
    ...overrides,
  };
}

function makeCombatSummary(creatures = []) {
  return { round: 1, creatures };
}

function freshAttackEvent(options = {}) {
  return {
    d20: 15,
    bonus: 5,
    targetName: 'Goblin',
    targetAc: 14,
    effectiveAc: null,
    hit: true,
    timestamp: Date.now(),
    ...options,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Blessed Defender',
    automation: {
      type: 'reaction_debuff',
      range: '30_ft',
      effect: 'disadvantage_on_attacks_vs_ally',
      uses_expression: null,
      recharge: 'long_rest',
      ...overrides,
    },
  };
}

// Router mock keyed on (charKey, key) — NOT positional Once-chains, so adding
// internal getRuntimeValue reads elsewhere in the handler cannot shift these
// values onto the wrong key.
function routeRuntimeValue({ effects = [], uses = 1 } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((charKey, key) => {
    if (key === 'targetEffects') return [...effects];
    if (key.endsWith('Uses')) return uses;
    return undefined;
  });
}

// Merges overrides into a healthy default success path (merge, never replace —
// the makeAction defect fixed repeatedly this week).
function setupPath(options = {}) {
  const action = makeAction(options.actionOverrides);
  const ps = makePlayerStats(options.psOverrides);

  routeRuntimeValue({ effects: options.effects, uses: options.uses });
  damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());

  if (options.positions !== undefined) {
    targetResolver.resolveMapPositions.mockResolvedValue(options.positions);
  }
  if (options.inRange !== undefined) {
    rangeCheck.isWithinRange.mockResolvedValue(options.inRange);
  }

  const attackEvent = options.attackEvent !== undefined
    ? options.attackEvent
    : freshAttackEvent(options.attack);
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent,
    attackerName: options.attackerName ?? (attackEvent ? 'Goblin' : null),
    targetName: options.targetName ?? (attackEvent ? attackEvent.targetName ?? null : null),
    primaryDamage: options.primaryDamage ?? (attackEvent ? 10 : 0),
    secondaryDamage: 0,
    totalDamage: options.totalDamage ?? (attackEvent && attackEvent.hit !== false ? 10 : 0),
    damageTypes: options.damageTypes ?? (attackEvent ? ['Piercing'] : []),
  });

  return handle(action, ps, campaignName, mapName);
}

function targetEffectsWriteCall() {
  return useRuntimeState.setRuntimeValue.mock.calls.find((c) => c[1] === 'targetEffects');
}

// ── Tests ───────────────────────────────────────────────────────

describe('reactionDebuffHandler — attacks-vs-ally gate (disadvantage_on_attacks_vs_ally)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rangeCheck.isWithinRange.mockReset().mockResolvedValue(true);
    damageRollback.findLastAttack.mockReset();
    targetResolver.resolveMapPositions.mockReset();
  });

  describe('gates', () => {
    it('refuses with popup and spends/writes nothing when no attack event found', async () => {
      const result = await setupPath({
        actionOverrides: { uses_expression: 2 },
        attackEvent: null,
      });

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent attack found');
      // refused before any store touch: no te, no uses spend, no latch
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses with popup and writes nothing when attack event has no defender', async () => {
      const result = await setupPath({
        attackEvent: { d20: 15, bonus: 5, hit: true, timestamp: Date.now() },
      });

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Could not determine who was attacked');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses out-of-range attacker and writes nothing; range derived from automation.range', async () => {
      const result = await setupPath({
        positions: {
          attackerPos: { gridX: 0, gridY: 0 },
          targetPos: { gridX: 20, gridY: 0 },
        },
        inRange: false,
      });

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Goblin is out of range');
      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Paladin', 'Goblin', 30);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('protection targetEffect upsert', () => {
    it('writes protection te (one write) and returns disadvantage popup', async () => {
      const result = await setupPath();

      const write = targetEffectsWriteCall();
      expect(write).toBeDefined();
      expect(write[0]).toBe('campaign');
      expect(write[2]).toHaveLength(1);
      expect(write[2][0]).toEqual(expect.objectContaining({
        effect: 'protection',
        target: 'Goblin',
        source: 'Paladin',
        duration: 'until_start_of_next_turn',
      }));
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Disadvantage');
      expect(result.payload.description).toContain('second d20');
    });

    it('honours custom duration from automation', async () => {
      await setupPath({ actionOverrides: { duration: '1_round' } });

      expect(targetEffectsWriteCall()[2][0].duration).toBe('1_round');
    });

    it('replaces existing protection te for same defender', async () => {
      await setupPath({
        effects: [{ effect: 'protection', target: 'Goblin', source: 'Other', duration: 'until_start_of_next_turn', timestamp: Date.now() - 1000 }],
      });

      const write = targetEffectsWriteCall();
      expect(write[2]).toHaveLength(1);
      expect(write[2][0].source).toBe('Paladin');
    });

    it('appends protection te for a different defender', async () => {
      await setupPath({
        effects: [{ effect: 'protection', target: 'Orc', source: 'Other', duration: 'until_start_of_next_turn', timestamp: Date.now() }],
      });

      const write = targetEffectsWriteCall();
      expect(write[2]).toHaveLength(2);
      expect(write[2][0].target).toBe('Orc');
      expect(write[2][1]).toEqual(expect.objectContaining({
        effect: 'protection',
        target: 'Goblin',
        source: 'Paladin',
      }));
    });
  });

  describe('uses + logging tail', () => {
    it('spends one use through setRuntimeValue after successful application', async () => {
      await setupPath({ actionOverrides: { uses_expression: 2 }, uses: 1 });

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Paladin',
        'blesseddefenderUses',
        0,
        campaignName
      );
    });

    it('logs exactly one ability_use tail entry carrying the disadvantage description', async () => {
      await setupPath();

      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Paladin',
          abilityName: 'Blessed Defender',
          targetName: 'Goblin',
          description: expect.stringContaining('Disadvantage'),
        })
      );
    });
  });
});
