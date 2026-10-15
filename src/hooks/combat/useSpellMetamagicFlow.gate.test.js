// @maintained-by-ai: 2026-10-15
// gateMetamagic registry BREADTH seam: every spell in spellGateMap must flip its
// pending<Key> with the right shape/targets when routed through the hook.
// Deep per-gate behavior lives in the spellGates.* lanes (hex, bane, magicMissile,
// revivify, animalFriendship, spareTheDying, wardingBond, mageArmor); two-stage UI
// in gate-two-stage; Sorcerer payment/auto-level in gate-sorcerer; material gate in
// gate-material; confirm/skip execution in spellConfirm and complex-handlers lanes.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';
import { getAllyList } from '../useAllySelection.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      // Goblin A at 0 HP is DEAD (canonical monster 0-HP model) — the only
      // Revivify-valid target in this fixture.
      { name: 'Goblin A', type: 'monster', currentHp: 0 },
      { name: 'Goblin B' },
      { name: 'Goblin C' },
    ],
  })),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    ...overrides,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    casting_time: '1 Action',
    range: '150 ft.',
    ...overrides,
  };
}

// Render the hook, run gateMetamagic on one spell synchronously, and return
// the pendingKey entry it opened (or the whole hook API when key is omitted).
function gate(spellOverrides, pendingKey) {
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
  );
  act(() => {
    result.current.gateMetamagic(makeSpell(spellOverrides));
  });
  return pendingKey ? result.current[pendingKey] : result.current;
}

// ── Registry breadth: name → pending<Key> conversion ─────────────────────────
// Levels mirror public/data/spells.json (5e) and public/data/2024/spells.json.
// casterIncluded / casterExcluded pin the gate's getCsAndTargets mode.

const gateRegistry = [
  // includeCaster gates — RAW touch spells that may target the caster
  { name: 'Foresight', level: 9, pendingKey: 'pendingForesight', casterIncluded: true },
  { name: 'Sanctuary', level: 1, pendingKey: 'pendingSanctuary', casterIncluded: true },
  { name: 'Protection from Evil and Good', level: 1, pendingKey: 'pendingProtectionFromEvilAndGood', casterIncluded: true },
  { name: 'Enhance Ability', level: 2, pendingKey: 'pendingEnhanceAbility', casterIncluded: true },
  // excludeCaster gates — RAW target-another-creature spells
  { name: 'Charm Monster', level: 4, pendingKey: 'pendingCharmMonster', casterExcluded: true },
  { name: 'Banishment', level: 4, pendingKey: 'pendingBanishment', casterExcluded: true },
  { name: 'Hex', level: 1, pendingKey: 'pendingHex', casterExcluded: true, maxTargets: 1 },
  { name: 'Prismatic Spray', level: 7, pendingKey: 'pendingPrismaticSpray', casterExcluded: true },
  { name: 'Faerie Fire', level: 1, pendingKey: 'pendingFaerieFire', casterExcluded: true },
  // Revivify filters to DEAD targets — Goblin A (0 HP) qualifies (SP-100
  // picker depth in spellGates.revivify.test.js).
  { name: 'Revivify', level: 3, pendingKey: 'pendingRevivify', casterExcluded: true },
  // Generic gates — picker opens over every combatant
  { name: 'Protection from Poison', level: 2, pendingKey: 'pendingProtectionFromPoison' },
  { name: 'Stone Skin', level: 4, pendingKey: 'pendingStoneSkin' },
  { name: 'Polymorph', level: 4, pendingKey: 'pendingPolymorph', maxTargets: 1 },
  { name: 'True Polymorph', level: 9, pendingKey: 'pendingTruePolymorph' },
  { name: 'Lesser Restoration', level: 2, pendingKey: 'pendingLesserRestoration' },
  { name: 'Greater Restoration', level: 5, pendingKey: 'pendingGreaterRestoration' },
  { name: 'Remove Curse', level: 3, pendingKey: 'pendingRemoveCurse' },
  { name: 'Aid', level: 2, pendingKey: 'pendingAid', maxTargets: 3 },
  { name: 'Bane', level: 1, pendingKey: 'pendingBane', maxTargets: 3 },
  { name: 'Bless', level: 1, pendingKey: 'pendingBless', maxTargets: 3 },
  { name: 'Holy Aura', level: 8, pendingKey: 'pendingHolyAura' },
  { name: 'Slow', level: 3, pendingKey: 'pendingSlow' },
  { name: 'Haste', level: 3, pendingKey: 'pendingHaste' },
  { name: 'Barkskin', level: 2, pendingKey: 'pendingBarkskin' },
  { name: 'Invisibility', level: 2, pendingKey: 'pendingInvisibility' },
  { name: 'Greater Invisibility', level: 4, pendingKey: 'pendingGreaterInvisibility' },
  { name: 'Feign Death', level: 3, pendingKey: 'pendingFeignDeath' },
  { name: 'Heal', level: 6, pendingKey: 'pendingHeal' },
  { name: 'Longstrider', level: 1, pendingKey: 'pendingLongstrider' },
  { name: 'Pass Without Trace', level: 2, pendingKey: 'pendingPassWithoutTrace' },
  { name: 'Beacon of Hope', level: 3, pendingKey: 'pendingBeaconOfHope' },
  { name: 'Globe of Invulnerability', level: 6, pendingKey: 'pendingGlobe' },
  { name: 'Antimagic Field', level: 8, pendingKey: 'pendingAntimagicField' },
  { name: 'Forcecage', level: 7, pendingKey: 'pendingForcecage' },
  { name: 'Stinking Cloud', level: 3, pendingKey: 'pendingStinkingCloud' },
  { name: 'Confusion', level: 4, pendingKey: 'pendingConfusion' },
  { name: 'Web', level: 2, pendingKey: 'pendingWeb' },
  { name: 'Regenerate', level: 7, pendingKey: 'pendingRegenerate' },
  { name: 'Healing Word', level: 1, pendingKey: 'pendingHealingWord' },
  { name: 'Cure Wounds', level: 1, pendingKey: 'pendingCureWounds' },
  { name: 'Aura of Purity', level: 4, pendingKey: 'pendingAuraOfPurity' },
  { name: 'Circle of Power', level: 5, pendingKey: 'pendingCircleOfPower' },
  { name: 'Compulsion', level: 4, pendingKey: 'pendingCompulsion' },
  { name: 'Aura of Vitality', level: 3, pendingKey: 'pendingAuraOfVitality' },
  { name: 'Death Ward', level: 4, pendingKey: 'pendingDeathWard' },
  { name: 'Heroism', level: 1, pendingKey: 'pendingHeroism' },
];

describe('useSpellMetamagicFlow — gateMetamagic registry breadth', () => {
  for (const { name, level, pendingKey, maxTargets, casterIncluded, casterExcluded } of gateRegistry) {
    it(`opens ${pendingKey} for ${name} lv${level}`, () => {
      const pending = gate({ name, level }, pendingKey);

      expect(pending).not.toBeNull();
      expect(pending.spellName).toBe(name);
      expect(pending.spellLevel).toBe(level);
      if (maxTargets !== undefined) {
        expect(pending.maxTargets).toBe(maxTargets);
      }
      if (casterIncluded) {
        expect(pending.creatureTargets).toContain('TestSorcerer');
      }
      if (casterExcluded) {
        expect(pending.creatureTargets).not.toContain('TestSorcerer');
        expect(pending.creatureTargets).toContain('Goblin A');
      }
    });
  }
});

describe('useSpellMetamagicFlow — includeCaster gates open on an empty board', () => {
  for (const { name, level, pendingKey } of gateRegistry.filter(s => s.casterIncluded)) {
    it(`${name} still includes the caster with no creatures in combat`, () => {
      getCombatSummary.mockReturnValueOnce({ creatures: [] });
      const pending = gate({ name, level }, pendingKey);

      expect(pending).not.toBeNull();
      expect(pending.creatureTargets).toEqual(['TestSorcerer']);
    });
  }
});

// ── Monster-type-resolution gates (no spellGates.* lane for these) ──────────

describe('useSpellMetamagicFlow — monster-data-gated spells', () => {
  it('sets pendingHoldMonster with maxTargets from upcast_at_slot_level', () => {
    const pending = gate({
      name: 'Hold Monster',
      level: 5,
      upcastLevel: 6,
      upcast_at_slot_level: { '6': '2 targets' },
    }, 'pendingHoldMonster');

    expect(pending).not.toBeNull();
    expect(pending.creatureTargets).not.toContain('TestSorcerer');
    expect(pending.creatureTargets).toContain('Goblin A');
    expect(pending.maxTargets).toBe(2);
  });

  it('opens pendingHoldPerson for humanoid monsters only', async () => {
    getMonsterData.mockResolvedValue({ type: 'humanoid' });
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );
    await act(async () => {
      result.current.gateMetamagic(makeSpell({ name: 'Hold Person', level: 2 }));
    });
    expect(result.current.pendingHoldPerson).not.toBeNull();

    getMonsterData.mockResolvedValue({ type: 'Ooze' });
    const refused = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );
    await act(async () => {
      refused.result.current.gateMetamagic(makeSpell({ name: 'Hold Person', level: 2 }));
    });
    expect(refused.result.current.pendingHoldPerson).toBeNull();
  });

  it('sets pendingCharmPerson for humanoids', async () => {
    getMonsterData.mockResolvedValue({ type: 'humanoid' });
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );
    await act(async () => {
      result.current.gateMetamagic(makeSpell({ name: 'Charm Person', level: 1 }));
    });

    expect(result.current.pendingCharmPerson).not.toBeNull();
  });
});

// ── Class-restricted and party-scoped gates ───────────────────────────────────

describe('useSpellMetamagicFlow — Sorcerer-only shapechange gate', () => {
  it('opens pendingShapechange for a Sorcerer, not for a Wizard', () => {
    expect(gate({ name: 'Shapechange', level: 9 }).pendingShapechange).not.toBeNull();

    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: { name: 'TestWizard', class: { name: 'Wizard' }, level: 5 }, campaignName: 'TestCampaign', onExecute: vi.fn() })
    );
    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Shapechange', level: 9 }));
    });

    expect(result.current.pendingShapechange).toBeNull();
  });
});

describe('useSpellMetamagicFlow — Animal Shapes gate', () => {
  it('filters targets to selected allies with a CR 4 cap', () => {
    getAllyList.mockReturnValueOnce(['Goblin B']);
    const pending = gate({ name: 'Animal Shapes', level: 8 }, 'pendingAnimalShapes');

    expect(pending).not.toBeNull();
    expect(pending.maxCR).toBe(4);
    expect(pending.creatureTargets).toEqual(['Goblin B']);
  });
});

// ── Damage-type payloads ───────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Protection from Energy gate', () => {
  it('prefers damageTypes from the spell automation', () => {
    const pending = gate({ name: 'Protection from Energy', level: 3, automation: { damageTypes: ['Psychic'] } }, 'pendingProtectionFromEnergy');

    expect(pending).not.toBeNull();
    expect(pending.damageTypes).toEqual(['Psychic']);
  });

  it('uses the default 5-type list when spell has no automation', () => {
    const pending = gate({ name: 'Protection from Energy', level: 3, automation: null }, 'pendingProtectionFromEnergy');

    expect(pending.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
  });
});

describe('useSpellMetamagicFlow — Resistance damage types', () => {
  it('carries all 11 standard damage types', () => {
    const pending = gate({ name: 'Resistance', level: 0 }, 'pendingResistance');

    expect(pending.damageTypes).toEqual([
      'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
      'Necrotic', 'Piercing', 'Poison', 'Radiant', 'Slashing', 'Thunder',
    ]);
  });
});

describe('useSpellMetamagicFlow — Magic Missile dart count', () => {
  it('scales with effective slot level: 3 + (level - 1)', () => {
    expect(gate({ name: 'Magic Missile', level: 1 }).pendingMagicMissile.totalMissiles).toBe(3);
    expect(gate({ name: 'Magic Missile', level: 3 }).pendingMagicMissile.totalMissiles).toBe(5);
  });
});

// ── Ungated fallthrough ────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — ungated spells fall through to metamagic', () => {
  it('Shield of Faith skips the gate map and opens pendingMetamagic', () => {
    const { pendingShieldOfFaith, pendingMetamagic } = gate({ name: 'Shield of Faith', level: 1 });

    expect(pendingShieldOfFaith).toBeNull();
    expect(pendingMetamagic).not.toBeNull();
    expect(pendingMetamagic.spellName).toBe('Shield of Faith');
  });
});

// ── Aura of Life party gate (SP-008) — last block: pins persistent mocks ─────

describe('useSpellMetamagicFlow — Aura of Life party gate (SP-008)', () => {
  it('opens the picker with selected allies and no target cap', () => {
    getRuntimeValue.mockImplementation((name, key) => (key === 'selectedAllies' ? ['Goblin B', 'Goblin C'] : 3));
    const pending = gate({ name: 'Aura of Life', level: 4 }, 'pendingAuraOfLife');

    expect(pending).not.toBeNull();
    expect(pending.creatureTargets).toEqual(['Goblin B', 'Goblin C']);
    expect(pending).not.toHaveProperty('maxTargets');
  });

  it('falls back leniently to player combatants when allies are unconfigured', () => {
    getCombatSummary.mockImplementation(() => ({
      creatures: [
        { name: 'TestSorcerer', type: 'player' },
        { name: 'AasimarTest', type: 'player' },
        { name: 'Goblin A', type: 'monster' },
      ],
    }));
    getRuntimeValue.mockReturnValue(null);
    const pending = gate({ name: 'Aura of Life', level: 4 }, 'pendingAuraOfLife');

    expect(pending.creatureTargets).toEqual(['TestSorcerer', 'AasimarTest']);
  });

  it('stays closed when no party membership exists on the board', () => {
    getCombatSummary.mockImplementation(() => ({
      creatures: [
        { name: 'Goblin A', type: 'monster', currentHp: 0 },
        { name: 'Goblin B' },
        { name: 'Goblin C' },
      ],
    }));
    getRuntimeValue.mockImplementation((name, key) => (key === 'selectedAllies' ? null : 3));
    expect(gate({ name: 'Aura of Life', level: 4 }).pendingAuraOfLife).toBeFalsy();
  });
});
