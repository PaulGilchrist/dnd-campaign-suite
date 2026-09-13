// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';

// ── Mocking strategy ──────────────────────────────────────────────────────────
// Only mock the modules actually exercised by the behavior under test.
// Unrelated automation handlers receive no-ops so they never interfere.

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
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      { name: 'Goblin C' },
    ],
  })),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  applyAidEffect: vi.fn(),
  applyHeroesFeastEffect: vi.fn(),
  applyLesserRestorationEffect: vi.fn(),
  applyMageArmorEffect: vi.fn(),
  applyShieldOfFaithEffect: vi.fn(),
  applyProtectionFromEnergyHandler: vi.fn(),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyResistanceEffect: vi.fn(),
  executeHandler: vi.fn(() => Promise.resolve(null)),
  confirmGreaterRestoration: vi.fn(),
  applyHolyAuraEffect: vi.fn(() => Promise.resolve(null)),
  applyBaneEffect: vi.fn(),
  applyBlessEffect: vi.fn(),
  applyFaerieFire: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(),
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
  applyBarkskinEffect: vi.fn(() => Promise.resolve(null)),
  applyInvisibility: vi.fn(),
  applyGreaterInvisibility: vi.fn(),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(),
  applyAuraOfPurityEffect: vi.fn(),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve(null)),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve(null)),
  applyDeathWardEffect: vi.fn(() => Promise.resolve(null)),
  applyHeroism: vi.fn(() => Promise.resolve(null)),
  applyProtectionFromEvilAndGood: vi.fn(),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
  handleSanctuary: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/regenerateService.js', () => ({
  confirmRegenerate: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/holdMonsterService.js', () => ({
  triggerHoldMonster: vi.fn(),
}));

vi.mock('../../services/rules/features/charmPersonService.js', () => ({
  triggerCharmPerson: vi.fn(),
}));

vi.mock('../../services/rules/features/charmMonsterService.js', () => ({
  triggerCharmMonster: vi.fn(),
}));

vi.mock('../../services/rules/features/banishmentService.js', () => ({
  triggerBanishment: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/faerieFireService.js', () => ({
  triggerFaerieFire: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/healService.js', () => ({
  triggerHeal: vi.fn(),
}));

vi.mock('../../services/rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
  applyPolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn(() => Promise.resolve({ ok: false })),
}));

vi.mock('../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  applyTruePolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

global.fetch = vi.fn((url) => {
  if (url && url.includes('combat-summary')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ creatures: [] }),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });
});

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

// ── Factories ──────────────────────────────────────────────────────────────────

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

// ── Test helpers ───────────────────────────────────────────────────────────────

// Renders the hook and gates a spell that hits the spell gate for greater restoration.
// Returns { result, onExecute } for the caller to inspect.
function renderWithGreaterRestoration(playerStatsOverride = {}) {
  const onExecute = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow(
      { playerStats: makePlayerStats(playerStatsOverride), campaignName: 'TestCampaign', onExecute: onExecute }
    )
  );
  // gateMetamagic is async; use act with async to await it
  act(() => {
    result.current.gateMetamagic(makeSpell({ name: 'Greater Restoration', level: 5 }));
  });
  return { result, onExecute };
}

// Renders the hook and gates a spell that hits the spell gate for a target-selection spell.
function renderWithTargetSpell(spellName, spellLevel, playerStatsOverride = {}) {
  const onExecute = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow(
      { playerStats: makePlayerStats(playerStatsOverride), campaignName: 'TestCampaign', onExecute: onExecute }
    )
  );
  act(() => {
    result.current.gateMetamagic(makeSpell({ name: spellName, level: spellLevel }));
  });
  return { result, onExecute };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — initial state', () => {
  it('has no pending metamagic on mount', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    expect(result.current.pendingMetamagic).toBeNull();
  });
});

describe('useSpellMetamagicFlow — handleGreaterRestorationNoEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('refunds the spell slot and logs when no effects to remove', async () => {
    const { result, onExecute } = renderWithGreaterRestoration();

    // Greater Restoration has a spell gate, so pendingGreaterRestoration is set
    expect(result.current.pendingGreaterRestoration).not.toBeNull();

    await act(async () => {
      result.current.handleGreaterRestorationNoEffects();
    });

    // Slot should be refunded (3 + 1 = 4)
    const { setRuntimeValue } = await import('../runtime/useRuntimeState.js');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestSorcerer',
      'spell_slots_level_5',
      4,
      'TestCampaign'
    );

    // A log entry should be created for the cancelled cast
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: null,
      targets: [],
      spellName: 'Greater Restoration',
      spellLevel: 5,
      castingTime: '1 Action',
    }));

    // onExecute should NOT be called — the spell was cancelled, not cast
    expect(onExecute).not.toHaveBeenCalled();

    // Pending should be cleared
    expect(result.current.pendingGreaterRestoration).toBeNull();
  });

  it('does nothing when called without a pending greater restoration', async () => {
    const { result, onExecute } = renderWithTargetSpell('Fireball', 3);

    expect(result.current.pendingGreaterRestoration).toBeNull();

    await act(async () => {
      result.current.handleGreaterRestorationNoEffects();
    });

    expect(onExecute).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — non-Sorcerer cantrip with material', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('consumes material and calls onExecute for a damaging cantrip', async () => {
    const materialModule = await import('../../services/rules/spells/materialComponents.js');
    materialModule.getConsumedMaterial.mockImplementation((spell) => {
      if ((spell.name || '').toLowerCase() === 'firebolt') {
        return { itemName: 'Some Material' };
      }
      return null;
    });

    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(
        { playerStats: { name: 'TestWizard', class: { name: 'Wizard' }, level: 5 }, campaignName: 'TestCampaign', onExecute: onExecute }
      )
    );

    await act(async () => {
      await result.current.gateMetamagic(
        makeSpell({ name: 'Firebolt', level: 0, damage: { damage_at_character_level: { 5: '1d10' } } })
      );
    });

    // The wizard should have onExecute called with the upcast spell
    expect(onExecute).toHaveBeenCalled();
    const [executedSpell] = onExecute.mock.calls[0];
    expect(executedSpell.level).toBe(5);

    // Material should have been consumed
    expect(materialModule.consumeMaterial).toHaveBeenCalledWith(
      expect.any(Object),
      'Some Material',
      'TestCampaign'
    );
  });

  it('does not upcast a cantrip without damage', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(
        { playerStats: { name: 'TestWizard', class: { name: 'Wizard' }, level: 5 }, campaignName: 'TestCampaign', onExecute: onExecute }
      )
    );

    await act(async () => {
      await result.current.gateMetamagic(
        makeSpell({ name: 'Minor Illusion', level: 0 })
      );
    });

    // Non-damage cantrip goes through prepareSpellCast (not upcast path)
    expect(onExecute).toHaveBeenCalled();
    const [executedSpell] = onExecute.mock.calls[0];
    // prepareSpellCast mock returns { modifiedSpell: {} }, so level is undefined
    expect(executedSpell).toEqual({});
  });
});

describe('useSpellMetamagicFlow — multi-target Power Word spells with secondary modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('shows secondary target modal for Power Word Heal when setSecondaryTargetModal is provided', () => {
    const setSecondaryTargetModal = vi.fn();
    const setPopupHtml = vi.fn();
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(
        { playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute, setSecondaryTargetModal: setSecondaryTargetModal, characters: [], setPopupHtml: setPopupHtml }
      )
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Power Word Heal', level: 9 }));
    });

    expect(setSecondaryTargetModal).toHaveBeenCalled();
    const modal = setSecondaryTargetModal.mock.calls[0][0];
    expect(modal.secondaryTargetModal.title).toBe('Words of Creation — Choose Second Target');
    expect(modal.secondaryTargetModal.targets).toHaveLength(3);
  });

  it('calls onExecute with multiTarget when second target is selected from modal', async () => {
    const setSecondaryTargetModal = vi.fn();
    const setPopupHtml = vi.fn();
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(
        { playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute, setSecondaryTargetModal: setSecondaryTargetModal, characters: [], setPopupHtml: setPopupHtml }
      )
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Power Word Heal', level: 9 }));
    });

    expect(setSecondaryTargetModal).toHaveBeenCalled();
    const modal = setSecondaryTargetModal.mock.calls[0][0].secondaryTargetModal;

    await act(async () => {
      await modal.onTargetSelected('Goblin A');
    });

    expect(onExecute).toHaveBeenCalled();
    expect(onExecute.mock.calls[0][1].multiTarget).toBe('Goblin A');
    expect(setSecondaryTargetModal).toHaveBeenCalledWith(null);
  });

  it('calls onExecute with empty metaCtx when skipping secondary target', async () => {
    const setSecondaryTargetModal = vi.fn();
    const setPopupHtml = vi.fn();
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(
        { playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute, setSecondaryTargetModal: setSecondaryTargetModal, characters: [], setPopupHtml: setPopupHtml }
      )
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Power Word Heal', level: 9 }));
    });

    expect(setSecondaryTargetModal).toHaveBeenCalled();
    const modal = setSecondaryTargetModal.mock.calls[0][0].secondaryTargetModal;

    await act(async () => {
      modal.onSkip();
    });

    expect(onExecute).toHaveBeenCalled();
    expect(onExecute.mock.calls[0][1]).toEqual({});
    expect(setSecondaryTargetModal).toHaveBeenCalledWith(null);
  });

  it('falls back to pendingMultiTarget when setSecondaryTargetModal is not provided', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Power Word Heal', level: 9 }));
    });

    expect(result.current.pendingMultiTarget).not.toBeNull();
    expect(result.current.pendingMultiTarget.spellName).toBe('Power Word Heal');
  });
});
