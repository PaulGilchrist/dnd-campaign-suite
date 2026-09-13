// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';
import { getAllyList } from '../useAllySelection.js';

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
      // Goblin A dead (0 HP) so the SP-100 dead-target gate has a valid target.
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
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

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

function renderHookWithSpell(hookSetup, spellName, spellOverrides = {}) {
  const onExecute = vi.fn();
  const { result } = renderHook(() =>
    hookSetup(onExecute)
  );
  const spell = makeSpell({ name: spellName, ...spellOverrides });
  act(() => {
    result.current.gateMetamagic(spell);
  });
  return { result, onExecute, spell };
}

// ── Data-driven spell gate tests ─────────────────────────────────────────────

// Each entry tests that gateMetamagic sets the expected pending state for a spell.
// Additional behavior (confirm/skip handlers, two-stage flows, Sorcerer-specific
// logic) is covered by dedicated test files.

const gatedSpellsWithCreatureChecks = [
  { name: 'Foresight', level: 9, pendingKey: 'pendingForesight', casterIncluded: true },
  { name: 'Sanctuary', level: 1, pendingKey: 'pendingSanctuary', casterIncluded: true },
  { name: 'Protection from Evil and Good', level: 1, pendingKey: 'pendingProtectionFromEvilAndGood', casterIncluded: true },
  { name: 'Charm Monster', level: 4, pendingKey: 'pendingCharmMonster', casterExcluded: true },
  { name: 'Banishment', level: 4, pendingKey: 'pendingBanishment', casterExcluded: true },
  { name: 'Hex', level: 1, pendingKey: 'pendingHex', casterExcluded: true },
  { name: 'Prismatic Spray', level: 7, pendingKey: 'pendingPrismaticSpray', casterExcluded: true },
  { name: 'Faerie Fire', level: 1, pendingKey: 'pendingFaerieFire', casterExcluded: true },
  { name: 'Enhance Ability', level: 2, pendingKey: 'pendingEnhanceAbility', casterIncluded: true },
  // SP-110: 'Spare The Dying' gate now filters to 0-HP-not-dead creatures —
  // covered by spellGates.spareTheDying.test.js (this suite's runtime mocks
  // have no dying creature).
  { name: 'Revivify', level: 5, pendingKey: 'pendingRevivify', casterExcluded: true },
];

const simpleGates = [
  { name: 'Protection from Poison', level: 2, pendingKey: 'pendingProtectionFromPoison' },
  { name: 'Stone Skin', level: 3, pendingKey: 'pendingStoneSkin' },
  { name: 'Polymorph', level: 4, pendingKey: 'pendingPolymorph', maxTargets: 1 },
  { name: 'True Polymorph', level: 9, pendingKey: 'pendingTruePolymorph' },
  { name: 'Lesser Restoration', level: 2, pendingKey: 'pendingLesserRestoration' },
  { name: 'Greater Restoration', level: 5, pendingKey: 'pendingGreaterRestoration' },
  { name: 'Remove Curse', level: 3, pendingKey: 'pendingRemoveCurse' },
  { name: 'Aid', level: 1, pendingKey: 'pendingAid', maxTargets: 3 },
  { name: 'Bane', level: 0, pendingKey: 'pendingBane', maxTargets: 3 },
  { name: 'Bless', level: 1, pendingKey: 'pendingBless', maxTargets: 3 },
  { name: 'Holy Aura', level: 8, pendingKey: 'pendingHolyAura', spellLevel: 8 },
  { name: 'Slow', level: 3, pendingKey: 'pendingSlow' },
  { name: 'Haste', level: 3, pendingKey: 'pendingHaste' },
  { name: 'Barkskin', level: 2, pendingKey: 'pendingBarkskin' },
  { name: 'Invisibility', level: 2, pendingKey: 'pendingInvisibility' },
  { name: 'Greater Invisibility', level: 4, pendingKey: 'pendingGreaterInvisibility' },
  { name: 'Feign Death', level: 3, pendingKey: 'pendingFeignDeath' },
  { name: 'Heal', level: 6, pendingKey: 'pendingHeal' },
  { name: 'Longstrider', level: 0, pendingKey: 'pendingLongstrider' },
  { name: 'Pass Without Trace', level: 2, pendingKey: 'pendingPassWithoutTrace' },
  { name: 'Beacon of Hope', level: 3, pendingKey: 'pendingBeaconOfHope' },
  { name: 'Globe of Invulnerability', level: 4, pendingKey: 'pendingGlobe' },
  { name: 'Antimagic Field', level: 4, pendingKey: 'pendingAntimagicField' },
  { name: 'Forcecage', level: 7, pendingKey: 'pendingForcecage' },
  { name: 'Stinking Cloud', level: 1, pendingKey: 'pendingStinkingCloud' },
  { name: 'Confusion', level: 4, pendingKey: 'pendingConfusion' },
  { name: 'Web', level: 1, pendingKey: 'pendingWeb' },
  { name: 'Regenerate', level: 7, pendingKey: 'pendingRegenerate' },
  { name: 'Healing Word', level: 1, pendingKey: 'pendingHealingWord' },
  { name: 'Cure Wounds', level: 1, pendingKey: 'pendingCureWounds' },
  { name: 'Aura of Life', level: 4, pendingKey: 'pendingAuraOfLife' },
  { name: 'Aura of Purity', level: 4, pendingKey: 'pendingAuraOfPurity' },
  { name: 'Circle of Power', level: 9, pendingKey: 'pendingCircleOfPower' },
  { name: 'Compulsion', level: 4, pendingKey: 'pendingCompulsion' },
  { name: 'Aura of Vitality', level: 3, pendingKey: 'pendingAuraOfVitality' },
  { name: 'Death Ward', level: 4, pendingKey: 'pendingDeathWard' },
  { name: 'Heroism', level: 1, pendingKey: 'pendingHeroism' },
  { name: 'Hex', level: 1, pendingKey: 'pendingHex', maxTargets: 1 },
  { name: 'Sleet Storm', level: 3, pendingKey: 'pendingSleetStorm' },
  { name: 'Magic Missile', level: 3, pendingKey: 'pendingMagicMissile', totalMissiles: 5 },
  { name: 'Resistance', level: 0, pendingKey: 'pendingResistance', damageTypesLength: 11 },
];

describe('useSpellMetamagicFlow — simple spell gates', () => {
  for (const spell of simpleGates) {
    describe(spell.name, () => {
      beforeEach(() => {
        vi.clearAllMocks();
        getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
      });

      it(`sets ${spell.pendingKey} with expected structure`, () => {
        const { result } = renderHookWithSpell(
          (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
          spell.name,
          { level: spell.level },
        );

        const pending = result.current[spell.pendingKey];
        expect(pending).not.toBeNull();

        if (spell.name !== 'Magic Missile') {
          expect(pending.spellName).toBe(spell.name);
          expect(pending.spellLevel).toBe(spell.level);
        }

        if (spell.maxTargets !== undefined) {
          expect(pending.maxTargets).toBe(spell.maxTargets);
        }

        if (spell.spellLevel !== undefined) {
          expect(pending.spellLevel).toBe(spell.spellLevel);
        }

        if (spell.totalMissiles !== undefined) {
          expect(pending.totalMissiles).toBe(spell.totalMissiles);
        }

        if (spell.damageTypesLength !== undefined) {
          expect(pending.damageTypes.length).toBe(spell.damageTypesLength);
        }
      });
    });
  }
});

describe('useSpellMetamagicFlow — gated spells with creatureTargets checks', () => {
  for (const spell of gatedSpellsWithCreatureChecks) {
    describe(spell.name, () => {
      beforeEach(() => {
        vi.clearAllMocks();
        getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
      });

      it(`sets ${spell.pendingKey} with correct creatureTargets`, () => {
        const { result } = renderHookWithSpell(
          (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
          spell.name,
          { level: spell.level },
        );

        const pending = result.current[spell.pendingKey];
        expect(pending).not.toBeNull();
        expect(Array.isArray(pending.creatureTargets)).toBe(true);
        expect(pending.creatureTargets.length).toBeGreaterThan(0);

        if (spell.casterIncluded) {
          expect(pending.creatureTargets).toContain('TestSorcerer');
        }

        if (spell.casterExcluded) {
          expect(pending.creatureTargets).not.toContain('TestSorcerer');
          expect(pending.creatureTargets).toContain('Goblin A');
        }
      });
    });
  }
});

// ── Spells requiring monster data resolution ──────────────────────────────────

describe('useSpellMetamagicFlow — monster-data-gated spells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('sets pending holdMonster with maxTargets from upcast_at_slot_level', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({
        name: 'Hold Monster',
        level: 5,
        upcastLevel: 6,
        upcast_at_slot_level: { '6': '2 targets' },
      }));
    });

    const pending = result.current.pendingHoldMonster;
    expect(pending).not.toBeNull();
    expect(pending.creatureTargets).not.toContain('TestSorcerer');
    expect(pending.creatureTargets).toContain('Goblin A');
    expect(pending.maxTargets).toBe(2);
  });

  it('sets pending holdPerson for humanoid monsters', async () => {
    getMonsterData.mockResolvedValue({ type: 'humanoid' });
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    await act(async () => {
      result.current.gateMetamagic(makeSpell({ name: 'Hold Person', level: 2 }));
    });

    expect(result.current.pendingHoldPerson).not.toBeNull();
  });

  it('excludes non-humanoid monsters from holdPerson', async () => {
    getMonsterData.mockResolvedValue({ type: 'Ooze' });
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    await act(async () => {
      result.current.gateMetamagic(makeSpell({ name: 'Hold Person', level: 2 }));
    });

    expect(result.current.pendingHoldPerson).toBeNull();
  });

  it('sets pending charmPerson for humanoids', async () => {
    getMonsterData.mockResolvedValue({ type: 'humanoid' });
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    await act(async () => {
      result.current.gateMetamagic(makeSpell({ name: 'Charm Person', level: 1 }));
    });

    expect(result.current.pendingCharmPerson).not.toBeNull();
  });

  it('sets pending animalFriendship for beasts', async () => {
    getMonsterData.mockResolvedValue({ type: 'beast' });
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    await act(async () => {
      result.current.gateMetamagic(makeSpell({ name: 'Animal Friendship', level: 1 }));
    });

    expect(result.current.pendingAnimalFriendship).not.toBeNull();
  });
});

// ── Sorcerer-only gates ───────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Sorcerer-only gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('sets pending shapechange for Sorcerer', () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Shapechange',
      { level: 9 },
    );

    expect(result.current.pendingShapechange).not.toBeNull();
  });

  it('does not set pending shapechange for non-Sorcerer', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: { name: 'TestWizard', class: { name: 'Wizard' }, level: 5 }, campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Shapechange', level: 9 }));
    });

    expect(result.current.pendingShapechange).toBeNull();
  });
});

// ── Animal Shapes gate ────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Animal Shapes gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('sets pending animalShapes filtering by allies', () => {
    getAllyList.mockReturnValueOnce(['goblin a']);
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Animal Shapes',
      { level: 8 },
    );

    const pending = result.current.pendingAnimalShapes;
    expect(pending).not.toBeNull();
    expect(pending.maxCR).toBe(4);
    expect(pending.creatureTargets).toContain('Goblin A');
  });
});

// ── Protection from Energy gate ───────────────────────────────────────────────

describe('useSpellMetamagicFlow — Protection from Energy gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('sets pending protectionFromEnergy with damageTypes from spell automation', () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Protection from Energy',
      { level: 3 },
    );

    const pending = result.current.pendingProtectionFromEnergy;
    expect(pending).not.toBeNull();
    expect(Array.isArray(pending.damageTypes)).toBe(true);
    expect(pending.damageTypes.length).toBeGreaterThan(0);
  });

  it('uses default damageTypes when spell has no automation', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Protection from Energy', level: 3, automation: null }));
    });

    const pending = result.current.pendingProtectionFromEnergy;
    expect(pending).not.toBeNull();
    expect(pending.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
  });
});

// ── Revivify gate (no creatures) ─────────────────────────────────────────────

describe('useSpellMetamagicFlow — Revivify gate with no creatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('returns early without setting pending if no creatures', () => {
    getCombatSummary.mockReturnValueOnce({ creatures: [] });
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Revivify', level: 5 }));
    });

    expect(result.current.pendingRevivify).toBeNull();
  });
});

// ── Shield of Faith gate (not gated) ──────────────────────────────────────────

describe('useSpellMetamagicFlow — Shield of Faith gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('does not gate Shield of Faith (falls through to Sorcerer flow)', () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Shield of Faith',
      { level: 1 },
    );

    expect(result.current.pendingShieldOfFaith).toBeNull();
    const metamagic = result.current.pendingMetamagic;
    expect(metamagic).not.toBeNull();
    expect(metamagic.spellName).toBe('Shield of Faith');
  });
});

// ── Caster-included spells always include the caster ──────────────────────────

describe('useSpellMetamagicFlow — caster-included spells always include the caster', () => {
  const casterIncludedSpells = [
    { name: 'Foresight', level: 9, pendingKey: 'pendingForesight' },
    { name: 'Sanctuary', level: 1, pendingKey: 'pendingSanctuary' },
    { name: 'Protection from Evil and Good', level: 1, pendingKey: 'pendingProtectionFromEvilAndGood' },
    { name: 'Enhance Ability', level: 2, pendingKey: 'pendingEnhanceAbility' },
  ];

  for (const spell of casterIncludedSpells) {
    describe(spell.name, () => {
      beforeEach(() => {
        vi.clearAllMocks();
        getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
      });

      it('includes the caster even when combat has no creatures', () => {
        getCombatSummary.mockReturnValueOnce({ creatures: [] });
        const { result } = renderHook(() =>
          useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
        );

        act(() => {
          result.current.gateMetamagic(makeSpell({ name: spell.name, level: spell.level }));
        });

        const pending = result.current[spell.pendingKey];
        expect(pending).not.toBeNull();
        expect(pending.creatureTargets).toContain('TestSorcerer');
      });
    });
  }
});

// ── Magic Missile missile count ───────────────────────────────────────────────

describe('useSpellMetamagicFlow — Magic Missile missile count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('calculates totalMissiles based on spell level (3 + level - 1)', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Magic Missile', level: 1 }));
    });

    expect(result.current.pendingMagicMissile.totalMissiles).toBe(3);
  });

  it('calculates totalMissiles for upcast (level 3 = 5 missiles)', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Magic Missile', level: 3 }));
    });

    expect(result.current.pendingMagicMissile.totalMissiles).toBe(5);
  });
});

// ── Resistance damage types ──────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Resistance damage types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('includes all 11 standard damage types', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Resistance', level: 0 }));
    });

    const pending = result.current.pendingResistance;
    expect(pending.damageTypes).toEqual([
      'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
      'Necrotic', 'Piercing', 'Poison', 'Radiant', 'Slashing', 'Thunder',
    ]);
  });
});
