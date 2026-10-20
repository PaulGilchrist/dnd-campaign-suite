// @maintained-by-ai
// Regression tests for CLA-022: Aura of Warding resistances must be applied
// during damage calculation (not just displayed in the UI).
//
// LANE — applyDamage.js aura-warding DAMAGE-CONSUMER faces only:
// computeAuraComboEffects is consulted inside resolveCreatureDefenses
// (:775-780) and its resistances merge additively into damage math at :779.
// Cite owners (NEVER re-driven here):
// - Producer self-filter/dedupe/range/stacking precedence → auraComboEffects.test.js
//   (it never calls applyDamageToTarget); corona sync → coronaAuraUtils.test.js (#1183)
// - Condition-immunity aura channels → auraConditionImmunity.test.js / conditionSaveService
// - Generic B/P/S resistance arithmetic CANON → applyDamage.helpers.test.js :52-84 (#1182)
// - buff-granted resistances → applyDamage.buffs.test.js; attacker riders → #1184 lane
// - base computedStats resistances (no aura consulted) → applyDamage.test.js :345
// Aura grants NOT part of this contract: aura immunities returned by the producer are
// CONDITION immunities (never damage), and aura-sourced halvings deliberately do NOT
// enter passiveResistances, so logPassiveResistance (:317) stays silent for them.
//
// old -> new map (7 -> 4):
// - "halves Radiant / Necrotic / Psychic" (3 tests)      -> T1 it.each ward census (#903)
// - "unresisted type full" + "outside every aura full" (2) -> T2 no-reduction census (2 legs,
//   byte-distinct fixtures #1022; distinct reaches of the :778 length-guard #1035)
// - "merges aura resistances with base without duplicates" -> T3 additive-merge census
//   (strengthened: BOTH legs run with the ward ACTIVE — falsifier for a resistances-replace
//   defect at :779; old weak leg was applyDamage.test.js :345 territory)
// - "NPC ally inside the aura"                            -> T4 NPC ward face (kept)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

// rollD20 only: the whole graph imports exactly one diceRoller export
// (applyDamage.js:3, holyAuraDamageService.js:2) — rollExpression purged (#1094/#1132).
vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../combat/auras/auraComboEffects.js', () => ({
  computeAuraComboEffects: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { applyDamageToTarget } from './applyDamage.js';
import { computeAuraComboEffects } from '../../combat/auras/auraComboEffects.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ─────────────────────────────────────────────────────

const CAMPAIGN = 'TestCampaign';

function emptyAuraEffects() {
  return {
    speedBonus: 0,
    speedSource: null,
    immunities: [],
    immunitySources: {},
    resistances: [],
    resistanceSource: null,
  };
}

// Exact Aura of Warding grant: Necrotic/Psychic/Radiant resisted, nothing else.
function wardingAuraEffects() {
  return {
    speedBonus: 0,
    speedSource: null,
    immunities: [],
    immunitySources: {},
    resistances: ['Necrotic', 'Psychic', 'Radiant'],
    resistanceSource: 'Paladin',
  };
}

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createPlayerCreature(name, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp: 30,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function createMinimalCharacter(name, computedExtra = {}) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      ...computedExtra,
    },
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — Aura of Warding resistances (CLA-022)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    // Store-faithful runtime (#1137/#1091). Arity mirrors the source's real reads:
    // activeBuffs (:753) passes campaignName — served ONLY for the exact campaign tuple
    // (#932/#1019); currentHitPoints (:451) is read WITHOUT campaignName — served 2-arg.
    getRuntimeValue.mockImplementation((key, subKey, campaignName) => {
      if (subKey === 'currentHitPoints') return 30;
      if (campaignName !== CAMPAIGN) return undefined;
      if (subKey === 'activeBuffs') return [];
      return undefined;
    });
    // Inactive ward by default — a consumer-wiring break fails every ward leg loudly.
    computeAuraComboEffects.mockResolvedValue(emptyAuraEffects());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // T1 — ward-hit census over the full Aura of Warding grant (#903).
  it.each(['Radiant', 'Necrotic', 'Psychic'])(
    'halves %s damage 20→10 for a player inside a paladin\u2019s Aura of Warding',
    async (damageType) => {
      computeAuraComboEffects.mockResolvedValue(wardingAuraEffects());
      const characters = [createMinimalCharacter('Cleric')];
      const cs = makeCombatSummary([createPlayerCreature('Cleric')]);

      const result = await applyDamageToTarget(cs, 'Cleric', 20, [damageType], { campaignName: CAMPAIGN, characters });

      // Consumer contract (#967 exact bytes): consulted DURING the damage calc.
      expect(computeAuraComboEffects).toHaveBeenCalledWith({ targetName: 'Cleric', characters });
      expect(result.finalDamage).toBe(10);
      expect(result.damageReduced).toBe(true);
      expect(result.resistanceDetails).toEqual([{ damageType, status: 'resistant' }]);
      expect(result.newHp).toBe(20); // runtime HP 30 − halved 10, store-faithful
    },
  );

  // T2 — zero-reduction census, two distinct reaches of the :778 length-guard (#1035).
  it('reduces nothing for types outside the ward or when no aura contributes', async () => {
    const cs = makeCombatSummary([createPlayerCreature('Cleric')]);
    const characters = [createMinimalCharacter('Cleric')];

    // Leg A: ward ACTIVE (byte-identical aura to T1) but Fire is outside the grant.
    computeAuraComboEffects.mockResolvedValue(wardingAuraEffects());
    const wardActive = await applyDamageToTarget(cs, 'Cleric', 20, ['Fire'], { campaignName: CAMPAIGN, characters });
    expect(wardActive.finalDamage).toBe(20);
    expect(wardActive.damageReduced).toBe(false);
    expect(wardActive.resistanceDetails).toEqual([]);

    // Leg B: ward INACTIVE — the very Radiant hit T1 halved lands full (#1022 byte-distinct).
    computeAuraComboEffects.mockResolvedValue(emptyAuraEffects());
    const wardless = await applyDamageToTarget(cs, 'Cleric', 20, ['Radiant'], { campaignName: CAMPAIGN, characters });
    expect(wardless.finalDamage).toBe(20);
    expect(wardless.damageReduced).toBe(false);
    expect(wardless.resistanceDetails).toEqual([]);
  });

  // T3 — additive-merge census: both legs run with the ward ACTIVE, so a
  // `resistances = auraComboEffects.resistances` replace-defect at :779 fails leg B.
  it('merges aura resistances onto base character resistances without replacing either', async () => {
    const character = createMinimalCharacter('Cleric', { resistances: ['Fire'] });
    computeAuraComboEffects.mockResolvedValue(wardingAuraEffects()); // byte-distinct from base 'Fire'
    const cs = makeCombatSummary([createPlayerCreature('Cleric')]);

    const auraHalf = await applyDamageToTarget(cs, 'Cleric', 20, ['Radiant'], { campaignName: CAMPAIGN, characters: [character] });
    expect(auraHalf.finalDamage).toBe(10);
    expect(auraHalf.resistanceDetails).toEqual([{ damageType: 'Radiant', status: 'resistant' }]);

    const baseHalf = await applyDamageToTarget(cs, 'Cleric', 20, ['Fire'], { campaignName: CAMPAIGN, characters: [character] });
    expect(baseHalf.finalDamage).toBe(10);
    expect(baseHalf.resistanceDetails).toEqual([{ damageType: 'Fire', status: 'resistant' }]);
  });

  // T4 — the :779 merge sits outside the isPlayer block: NPC allies receive it too.
  it('halves damage for an NPC ally inside the aura', async () => {
    computeAuraComboEffects.mockResolvedValue(wardingAuraEffects());
    const npcAlly = {
      name: 'Orc Ally',
      type: 'npc',
      maxHp: 20,
      currentHp: 20,
      resistances: [],
      immunities: [],
      concentration: null,
    };
    const cs = makeCombatSummary([npcAlly]);

    const result = await applyDamageToTarget(cs, 'Orc Ally', 20, ['Radiant'], { campaignName: CAMPAIGN, characters: [createMinimalCharacter('Paladin')] });

    expect(result.finalDamage).toBe(10);
    expect(result.newHp).toBe(10);
    expect(npcAlly.currentHp).toBe(10); // HP persisted onto the live creature object
  });
});
