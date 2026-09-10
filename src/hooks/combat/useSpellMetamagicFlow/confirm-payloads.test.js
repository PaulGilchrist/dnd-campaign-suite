// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from '../useSpellMetamagicFlow.js';
import { getMultiTargetSpreadForSpell } from '../../../services/rules/spells/postCastRiderService.js';

// ── Minimal mocking strategy ──────────────────────────────────────────────────
// This test file only verifies that confirm handlers call setPopupHtml with the
// expected payload string or object. We mock only the modules that those handlers
// actually import and return controlled popup objects. Unrelated modules (e.g.
// holdMonster, charmPerson, animalShapes) are mocked with no-ops so they never
// interfere.

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'beast' })),
}));

vi.mock('../../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      // Dead so the SP-100 Revivify dead-target gate arms pending.
      { name: 'Goblin C', type: 'monster', currentHp: 0 },
    ],
  })),
}));

vi.mock('../../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase(), 'goblin a', 'goblin b']),
}));

// Automation index — each handler that needs a popup result gets a controlled
// return value. Handlers that don't produce popups get null.
vi.mock('../../../services/automation/index.js', () => ({
  applyAidEffect: vi.fn(),
  applyHeroesFeastEffect: vi.fn(),
  applyLesserRestorationEffect: vi.fn(),
  applyMageArmorEffect: vi.fn(),
  applyShieldOfFaithEffect: vi.fn(() => Promise.resolve({ payload: 'shieldOfFaith-popup' })),
  applyProtectionFromEnergyHandler: vi.fn(),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve({ payload: 'protectionFromPoison-popup' })),
  applyResistanceEffect: vi.fn(),
  executeHandler: vi.fn(() => Promise.resolve(null)),
  confirmGreaterRestoration: vi.fn(),
  applyHolyAuraEffect: vi.fn(() => Promise.resolve(null)),
  applyBaneEffect: vi.fn(),
  applyBlessEffect: vi.fn(),
  applyFaerieFire: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(),
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
  applyBarkskinEffect: vi.fn(() => Promise.resolve({ payload: 'barkskin-popup' })),
  applyInvisibility: vi.fn(),
  applyGreaterInvisibility: vi.fn(),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(),
  applyAuraOfPurityEffect: vi.fn(),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve({ payload: 'circleOfPower-popup' })),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve({ payload: 'auraOfVitality-popup' })),
  applyDeathWardEffect: vi.fn(() => Promise.resolve({ payload: 'deathWard-popup' })),
  applyHeroism: vi.fn(() => Promise.resolve({ payload: 'heroism-popup' })),
  applyProtectionFromEvilAndGood: vi.fn(),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve({ payload: 'stoneSkin-popup' })),
  handleSanctuary: vi.fn(() => Promise.resolve({ payload: 'sanctuary-popup' })),
}));

vi.mock('../../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));

vi.mock('../../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(() => Promise.resolve({ payload: 'removeCurse-popup' })),
}));

vi.mock('../../../services/rules/features/regenerateService.js', () => ({
  confirmRegenerate: vi.fn(() => Promise.resolve({ payload: 'regenerate-popup' })),
}));

vi.mock('../../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve({ payload: 'foresight-popup' })),
}));

vi.mock('../../../services/rules/features/holdMonsterService.js', () => ({
  triggerHoldMonster: vi.fn(),
}));

vi.mock('../../../services/rules/features/charmPersonService.js', () => ({
  triggerCharmPerson: vi.fn(),
}));

vi.mock('../../../services/rules/features/charmMonsterService.js', () => ({
  triggerCharmMonster: vi.fn(),
}));

vi.mock('../../../services/rules/features/banishmentService.js', () => ({
  triggerBanishment: vi.fn(() => Promise.resolve({ payload: 'banishment-popup' })),
}));

vi.mock('../../../services/rules/features/faerieFireService.js', () => ({
  triggerFaerieFire: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../services/rules/features/healService.js', () => ({
  triggerHeal: vi.fn(),
}));

vi.mock('../../../services/rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(() => Promise.resolve({ payload: 'revivify-popup' })),
}));

vi.mock('../../../services/automation/handlers/spells/polymorphService.js', () => ({
  applyPolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn(() => Promise.resolve({ ok: false })),
}));

vi.mock('../../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  applyTruePolymorph: vi.fn(() => Promise.resolve({ payload: 'true-polymorph-popup' })),
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

// ── Shared test setup helper ───────────────────────────────────────────────────
// Renders the hook, gates the spell, and returns the result + setPopupHtml spy.
// Callers invoke confirm handlers on `result` directly.

function renderWithSpell(spellName, spellLevel, overrides = {}) {
  const setPopupHtml = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn(), null, [], setPopupHtml)
  );
  act(() => {
    result.current.gateMetamagic(makeSpell({ name: spellName, level: spellLevel, ...overrides }));
  });
  return { result, setPopupHtml };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — confirm handlers set popup html', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  // ── Array-target handlers (standard createConfirmHandler) ────────────────

  describe('array-target handlers', () => {
    const cases = [
      { spell: 'Banishment', level: 4, handler: 'handleBanishmentConfirm', arg: [['Goblin A']], payload: 'banishment-popup' },
      { spell: 'Polymorph', level: 4, handler: 'handlePolymorphConfirm', arg: [['Goblin A']], payload: 'polymorph-popup', overridePolymorph: { payload: 'polymorph-popup' } },
      { spell: 'Protection from Poison', level: 2, handler: 'handleProtectionFromPoisonConfirm', arg: [['Goblin A']], payload: 'protectionFromPoison-popup' },
      { spell: 'Remove Curse', level: 3, handler: 'handleRemoveCurseConfirm', arg: [['Goblin A']], payload: 'removeCurse-popup' },
      { spell: 'Foresight', level: 9, handler: 'handleForesightConfirm', arg: [['Goblin A']], payload: 'foresight-popup' },
      { spell: 'Death Ward', level: 4, handler: 'handleDeathWardConfirm', arg: [['Goblin A']], payload: 'deathWard-popup' },
      { spell: 'Heroism', level: 2, handler: 'handleHeroismConfirm', arg: [['Goblin A']], payload: 'heroism-popup' },
      { spell: 'Barkskin', level: 2, handler: 'handleBarkskinConfirm', arg: [['Goblin A']], payload: 'barkskin-popup' },
      { spell: 'Aura of Vitality', level: 3, handler: 'handleAuraOfVitalityConfirm', arg: [['Goblin A']], payload: 'auraOfVitality-popup' },
      { spell: 'Circle of Power', level: 7, handler: 'handleCircleOfPowerConfirm', arg: [['Goblin A']], payload: 'circleOfPower-popup' },
    ];

    for (const c of cases) {
      it(`calls setPopupHtml(${JSON.stringify(c.payload)}) for ${c.spell}`, async () => {
        const { result, setPopupHtml } = renderWithSpell(c.spell, c.level);

        if (c.overridePolymorph) {
          const { applyPolymorph } = await import('../../../services/automation/handlers/spells/polymorphService.js');
          applyPolymorph.mockResolvedValue(c.overridePolymorph);
        }

        await act(async () => {
          await result.current[c.handler](...c.arg);
        });

        if (c.payload !== null) {
          expect(setPopupHtml).toHaveBeenCalledWith(c.payload);
        } else {
          expect(setPopupHtml).not.toHaveBeenCalled();
        }
      });
    }
  });

  // ── Object-target handlers (result is { targetName }) ────────────────────

  describe('object-target handlers', () => {
    const cases = [
      { spell: 'Revivify', level: 5, handler: 'handleRevivifyConfirm', arg: [{ targetName: 'Goblin A' }], payload: 'revivify-popup' },
      { spell: 'Regenerate', level: 7, handler: 'handleRegenerateConfirm', arg: [{ targetName: 'Goblin A' }], payload: 'regenerate-popup' },
    ];

    for (const c of cases) {
      it(`calls setPopupHtml(${JSON.stringify(c.payload)}) for ${c.spell}`, async () => {
        const { result, setPopupHtml } = renderWithSpell(c.spell, c.level);

        await act(async () => {
          await result.current[c.handler](...c.arg);
        });

        expect(setPopupHtml).toHaveBeenCalledWith(c.payload);
      });
    }
  });

  // ── String-target handlers ───────────────────────────────────────────────

  describe('string-target handlers', () => {
    it('calls setPopupHtml for Sanctuary with string target', async () => {
      const { result, setPopupHtml } = renderWithSpell('Sanctuary', 1);

      await act(async () => {
        await result.current.handleSanctuaryConfirm('Goblin A');
      });

      expect(setPopupHtml).toHaveBeenCalledWith('sanctuary-popup');
    });

    it('calls setPopupHtml for Stone Skin with string target', async () => {
      const { result, setPopupHtml } = renderWithSpell('Stone Skin', 3);

      await act(async () => {
        await result.current.handleStoneSkinConfirm('Goblin A');
      });

      expect(setPopupHtml).toHaveBeenCalledWith('stoneSkin-popup');
    });
  });

  // ── Two-stage handler (True Polymorph) ───────────────────────────────────

  describe('two-stage True Polymorph handler', () => {
    it('resolves object_into_creature at path-select (pays slot, no target-confirm needed)', async () => {
      const { result, setPopupHtml } = renderWithSpell('True Polymorph', 9);
      const { prepareSpellCast } = await import('../../../services/rules/spells/spellPreparationService.js');

      await act(async () => {
        await result.current.handleTruePolymorphPathSelect('object_into_creature');
      });

      expect(setPopupHtml).toHaveBeenCalledWith('true-polymorph-popup');
      expect(prepareSpellCast).toHaveBeenCalled();
      expect(result.current.pendingTruePolymorph).toBeNull();
    });

    it('calls setPopupHtml after path select + target confirm for creature_to_creature', async () => {
      const { result, setPopupHtml } = renderWithSpell('True Polymorph', 9);
      const { prepareSpellCast } = await import('../../../services/rules/spells/spellPreparationService.js');

      await act(async () => {
        result.current.handleTruePolymorphPathSelect('creature_to_creature');
      });

      await act(async () => {
        await result.current.handleTruePolymorphTargetConfirm(['Goblin A']);
      });

      expect(setPopupHtml).toHaveBeenCalledWith('true-polymorph-popup');
      expect(prepareSpellCast).toHaveBeenCalled();
      expect(result.current.pendingTruePolymorph).toBeNull();
    });
  });

  // ── Area-effect handlers (executeHandler-based with overrides) ───────────

  describe('area-effect handlers with executeHandler overrides', () => {
    const cases = [
      { spell: 'Confusion', level: 4, handler: 'handleConfusionConfirm', arg: [['Goblin A']], payload: 'confusion-popup' },
      { spell: 'Globe of Invulnerability', level: 4, handler: 'handleGlobeConfirm', arg: [['Goblin A']], payload: 'globe-popup' },
      { spell: 'Forcecage', level: 7, handler: 'handleForcecageConfirm', arg: [['Goblin A']], payload: 'forcecage-popup' },
      { spell: 'Antimagic Field', level: 4, handler: 'handleAntimagicFieldConfirm', arg: [['Goblin A']], payload: 'antimagic-popup' },
    ];

    for (const c of cases) {
      it(`calls setPopupHtml(${JSON.stringify(c.payload)}) for ${c.spell}`, async () => {
        const { result, setPopupHtml } = renderWithSpell(c.spell, c.level);

        const { executeHandler } = await import('../../../services/automation/index.js');
        executeHandler.mockResolvedValue({ payload: c.payload });

        await act(async () => {
          await result.current[c.handler](...c.arg);
        });

        expect(setPopupHtml).toHaveBeenCalledWith(c.payload);
      });
    }
  });

  // ── Healing Word — object payload with type field ────────────────────────

  describe('healing word partial-match payload', () => {
    it('calls setPopupHtml with a heal object when triggerHealingWord returns a result', async () => {
      const { result, setPopupHtml } = renderWithSpell('Healing Word', 1);

      const { triggerHealingWord } = await import('../../../services/rules/features/healingWordService.js');
      triggerHealingWord.mockResolvedValue({
        formula: '1d4+2',
        rolls: [3],
        rawTotal: 5,
        healAmount: 5,
        targetName: 'Goblin A',
        bonusHeal: 2,
        bonusDetails: [{ amount: 2, name: 'Tavern Heal' }],
      });

      await act(async () => {
        await result.current.handleHealingWordConfirm({ targetName: 'Goblin A' });
      });

      expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
        type: 'heal',
      }));
    });
  });

  // ── Negative-path: handlers that should NOT produce popups ───────────────

  describe('handlers that produce no popup', () => {
    it('does not call setPopupHtml when automation returns null', async () => {
      const { result, setPopupHtml } = renderWithSpell('Bane', 0);

      await act(async () => {
        await result.current.handleBaneConfirm(['Goblin A']);
      });

      expect(setPopupHtml).not.toHaveBeenCalled();
    });
  });
});
