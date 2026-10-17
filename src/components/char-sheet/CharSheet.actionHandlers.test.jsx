// @maintained-by-ai
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import rulesFactory from '../../services/rules/rulesFactory.js';
import { activateWildShape } from '../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js';
import { confirmPolymorphTransform } from '../../services/automation/handlers/spells/polymorphService.js';
import { confirmShapechangeTransform } from '../../services/automation/handlers/spells/shapechangeService.js';
import { applyAnimalShapes } from '../../services/automation/handlers/spells/animalShapesService.js';
import { confirmTruePolymorphTransform, applyObjectTransform } from '../../services/automation/handlers/spells/truePolymorphService.js';
import { applyShieldOfFaith } from '../../services/automation/handlers/shieldOfFaithHandler.js';

import {
  createMockStore,
  createDefaultProps,
  createMockPlayerStats,
  createSharedPopupReturnValue,
  resetTestState,
  setPopup,
} from './CharSheet.test-utils';

// ---------------------------------------------------------------------------
// Mocks — child components
// ---------------------------------------------------------------------------

vi.mock('./char-summary/CharSummary.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-summary"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-abilities"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharActions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-actions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharInventory.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-inventory"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharReactions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-reactions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-special-actions"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-character-advancement"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-spells"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

// ---------------------------------------------------------------------------
// Mocks — services
// ---------------------------------------------------------------------------

vi.mock('../../services/automation/handlers/shieldOfFaithHandler.js', () => ({
  applyShieldOfFaith: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraComboEffects.js', () => ({
  computeAuraComboEffects: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn().mockReturnValue({
    attackAdvantageCount: 0,
    attackDisadvantageCount: 0,
    autoReroll: false,
    autoRerollCondition: null,
    autoRerollBonus: null,
    cannotAct: false,
    autoRerollForSaves: false,
    strokeOfLuck: false,
  }),
  getNetAttackMode: vi.fn().mockReturnValue('normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn().mockReturnValue({ creatures: [] }),
  loadCombatSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => expr),
}));

vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isCreatureWarded: vi.fn().mockReturnValue(false),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
  getHolyAuraTargets: vi.fn().mockReturnValue(false),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn().mockReturnValue(null),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
  executeEmpoweredReroll: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getManeuversForRules: vi.fn().mockResolvedValue([]),
  getSuperiorityDice: vi.fn().mockReturnValue(0),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getProperty: vi.fn().mockResolvedValue(null),
    setProperty: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js', () => ({
  activateWildShape: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
  confirmPolymorphTransform: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/automation/handlers/spells/shapechangeService.js', () => ({
  confirmShapechangeTransform: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  confirmTruePolymorphTransform: vi.fn().mockResolvedValue(undefined),
  applyObjectTransform: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn(({ name }) => (
    <div data-testid="dice-roll-result"><span>{name || 'dice'}</span></div>
  )),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="secondary-target-modal">modal</div>),
}));

vi.mock('./modals/PolymorphSelectionModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="polymorph-selection-modal">modal</div>),
}));

vi.mock('./modals/AnimalShapesSelectionModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="animal-shapes-selection-modal">modal</div>),
}));

vi.mock('./modals/ObjectTransformModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="object-transform-modal">modal</div>),
}));

vi.mock('../common/popup.jsx', () => ({
  default: vi.fn(({ children }) => <div data-testid="popup">{children}</div>),
}));

vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: vi.fn((props) => (
    <div data-testid="attack-result-popup">
      <span>{props.popupHtml?.name || 'Attack'}</span>
    </div>
  )),
}));

// ---------------------------------------------------------------------------
// Mocks — hooks
// ---------------------------------------------------------------------------

const mockStore = createMockStore();
const sharedPopupReturnValue = createSharedPopupReturnValue();

vi.mock('../../hooks/combat/useSharedPopup.js', () => {
  const mockFn = vi.fn();
  mockFn.mockImplementation(() => {
    return { ...sharedPopupReturnValue, Provider: ({ children }) => children };
  });
  return { default: mockFn };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => mockStore),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop, _camp) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
  useRuntimeValue: vi.fn((key, prop) => {
    if (prop === 'exhaustionLevel') return 0;
    if (prop === 'activeConditions' || prop === 'activeBuffs' || prop === 'targetEffects') return [];
    const defaults = {
      bardicInspirationGrantedBy: 'unknown',
      indomitableUses: 0,
      bardicInspirationUses: 0,
      secondWindUses: 0,
      superiorityDice: 0,
      psionicEnergy: 0,
    };
    const def = Object.prototype.hasOwnProperty.call(defaults, prop) ? defaults[prop] : null;
    return mockStore.get(`${key}:${prop}`) ?? def;
  }),
}));

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CAMPAIGN = 'test-campaign';
const CHARACTER = 'Test Character';
const BEAST = { name: 'Giant Eagle', cr: 1 };

let stats;
let props;

const renderSheet = async () => {
  render(<CharSheet {...props} />);
  await waitFor(() => {
    expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
  });
};

// Returns the props of the most recent render of a mocked modal component.
const lastModalProps = async (path) => {
  const { default: Modal } = await import(path);
  return Modal.mock.calls.at(-1)[0];
};

beforeEach(() => {
  resetTestState(sharedPopupReturnValue);
  mockStore.clear();
  stats = createMockPlayerStats();
  vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));
  props = createDefaultProps();
});

// ---------------------------------------------------------------------------
// Tests — shape-change popup confirms dispatch to their services
// ---------------------------------------------------------------------------

describe('shape-change popup confirms dispatch to their services', () => {
  it.each([
    {
      label: 'Wild Shape',
      popupHtml: {
        type: 'wild_shape_select',
        action: { name: 'Wild Shape' },
        playerStats: { name: CHARACTER },
        campaignName: CAMPAIGN,
      },
      service: activateWildShape,
      // Wild Shape forwards popupHtml.playerStats (the sheet copy), not component state.
      expectedArgs: () => [CHARACTER, BEAST, { name: CHARACTER }, CAMPAIGN],
    },
    {
      label: 'Polymorph',
      popupHtml: {
        type: 'polymorph_select',
        maxCR: 4,
        targetName: 'Ally One',
        casterName: CHARACTER,
        spell: { name: 'Polymorph' },
        spellLevel: 5,
        campaignName: CAMPAIGN,
      },
      service: confirmPolymorphTransform,
      expectedArgs: () => [{
        targetName: 'Ally One',
        beast: BEAST,
        casterName: CHARACTER,
        spell: { name: 'Polymorph' },
        spellLevel: 5,
        playerStats: stats,
        campaignName: CAMPAIGN,
      }],
    },
    {
      label: 'Shapechange',
      popupHtml: {
        type: 'shapechange_select',
        maxCR: 9,
        targetName: 'Ally One',
        casterName: CHARACTER,
        spell: { name: 'Shapechange' },
        spellLevel: 9,
        formChange: true,
        campaignName: CAMPAIGN,
      },
      service: confirmShapechangeTransform,
      expectedArgs: () => [{
        targetName: 'Ally One',
        form: BEAST,
        casterName: CHARACTER,
        spell: { name: 'Shapechange' },
        spellLevel: 9,
        playerStats: stats,
        campaignName: CAMPAIGN,
        formChange: true,
      }],
    },
    {
      label: 'True Polymorph',
      popupHtml: {
        type: 'true_polymorph_select',
        maxCR: 13,
        targetName: 'Ally One',
        casterName: CHARACTER,
        spell: { name: 'True Polymorph' },
        spellLevel: 9,
        campaignName: CAMPAIGN,
      },
      service: confirmTruePolymorphTransform,
      // Default mode when the popup carries none.
      expectedArgs: () => [{
        targetName: 'Ally One',
        creature: BEAST,
        casterName: CHARACTER,
        spell: { name: 'True Polymorph' },
        spellLevel: 9,
        playerStats: stats,
        campaignName: CAMPAIGN,
        mode: 'creature_to_creature',
      }],
    },
  ])('confirming $label closes the popup and calls the transform service', async ({ popupHtml, service, expectedArgs }) => {
    setPopup(sharedPopupReturnValue, popupHtml);
    await renderSheet();

    const modalProps = await lastModalProps('./modals/PolymorphSelectionModal.jsx');
    await act(async () => { await modalProps.onConfirm(BEAST); });

    expect(service).toHaveBeenCalledTimes(1);
    expect(service).toHaveBeenCalledWith(...expectedArgs());
    expect(sharedPopupReturnValue.setPopupHtml).toHaveBeenCalledWith(null);
  });

  it('confirming Animal Shapes clears the popup and applies the target-beast map', async () => {
    const targetBeastMap = { 'Ally One': BEAST };
    setPopup(sharedPopupReturnValue, {
      type: 'animal_shapes_target_selection',
      targets: [{ name: 'Ally One' }],
      maxCR: 4,
      campaignName: CAMPAIGN,
    });
    await renderSheet();

    const modalProps = await lastModalProps('./modals/AnimalShapesSelectionModal.jsx');
    await act(async () => { await modalProps.onConfirm(targetBeastMap); });

    expect(applyAnimalShapes).toHaveBeenCalledTimes(1);
    expect(applyAnimalShapes).toHaveBeenCalledWith({
      targetBeastMap,
      casterName: CHARACTER,
      spell: { name: 'Animal Shapes', level: 8 },
      playerStats: stats,
      campaignName: CAMPAIGN,
    });
    expect(sharedPopupReturnValue.setPopupHtml).toHaveBeenCalledWith(null);
  });

  it('confirming an object transform falls back to the caster as target', async () => {
    const spell = { name: 'True Polymorph' };
    // popupHtml carries no targetName — the caster must be used instead.
    setPopup(sharedPopupReturnValue, {
      type: 'true_polymorph_object',
      casterName: CHARACTER,
      spell,
      campaignName: CAMPAIGN,
    });
    await renderSheet();

    const modalProps = await lastModalProps('./modals/ObjectTransformModal.jsx');
    await act(async () => { await modalProps.onConfirm('statue'); });

    expect(applyObjectTransform).toHaveBeenCalledTimes(1);
    expect(applyObjectTransform).toHaveBeenCalledWith({
      targetName: CHARACTER,
      objectType: 'statue',
      casterName: CHARACTER,
      spell,
      campaignName: CAMPAIGN,
      playerStats: stats,
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Shield of Faith target selection dispatch
// ---------------------------------------------------------------------------

describe('Shield of Faith target selection', () => {
  it('casts on the selected target and shows the result popup, closing when the cast fails', async () => {
    const popupHtml = {
      type: 'shield_of_faith_target_selection',
      creatureTargets: ['Ally One', 'Ally Two'],
      duration: 'Concentration, up to 1 minute',
      range: '60 feet',
    };
    const resultPayload = { type: 'automation_info', name: 'Shield of Faith' };
    vi.mocked(applyShieldOfFaith).mockResolvedValue({ payload: resultPayload });
    setPopup(sharedPopupReturnValue, popupHtml);
    await renderSheet();

    const modalProps = await lastModalProps('./modals/shared/SecondaryTargetModal.jsx');
    await act(async () => { await modalProps.onTargetSelected('Ally One'); });

    expect(applyShieldOfFaith).toHaveBeenCalledWith({
      name: 'Shield of Faith',
      spell: { duration: popupHtml.duration, range: popupHtml.range },
      automation: { type: 'shield_of_faith' },
    }, stats, CAMPAIGN, null, ['Ally One']);
    expect(sharedPopupReturnValue.setPopupHtml).toHaveBeenCalledWith(resultPayload);

    // Failed cast (no result) closes the popup instead of showing a payload.
    vi.mocked(applyShieldOfFaith).mockResolvedValue(null);
    await act(async () => { await modalProps.onTargetSelected('Ally Two'); });
    expect(sharedPopupReturnValue.setPopupHtml).toHaveBeenLastCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// Tests — prepared spells toggle (respecting the max prepared cap)
// ---------------------------------------------------------------------------

describe('handleTogglePreparedSpells', () => {
  it('toggles preparation in the runtime store and refuses past the max prepared cap', async () => {
    stats = createMockPlayerStats({
      spellAbilities: {
        spells: [{ name: 'Fireball', prepared: '' }, { name: 'Shield', prepared: 'Prepared' }],
        maxPreparedSpells: 1,
      },
    });
    vi.mocked(rulesFactory.getPlayerStats).mockImplementation(() => Promise.resolve(stats));
    mockStore.set(`${CHARACTER}:preparedSpells`, ['Shield']);
    await renderSheet();

    const toggle = async (spellName) => {
      const modalProps = await lastModalProps('./char-spells/CharSpells.jsx');
      await act(async () => { modalProps.handleTogglePreparedSpells(spellName); });
    };
    const passedSpells = async () => {
      const modalProps = await lastModalProps('./char-spells/CharSpells.jsx');
      return modalProps.playerStats.spellAbilities.spells;
    };

    // Cap already reached (Shield prepared, max 1) — Fireball stays unprepared.
    await toggle('Fireball');
    expect(mockStore.get(`${CHARACTER}:preparedSpells`)).toEqual(['Shield']);
    expect((await passedSpells()).find(s => s.name === 'Fireball').prepared).toBe('');

    // Unprepare Shield — store clears, making room.
    await toggle('Shield');
    expect(mockStore.get(`${CHARACTER}:preparedSpells`)).toEqual([]);
    expect((await passedSpells()).find(s => s.name === 'Shield').prepared).toBe('');

    // Fireball now fits under the cap and becomes prepared.
    await toggle('Fireball');
    expect(mockStore.get(`${CHARACTER}:preparedSpells`)).toEqual(['Fireball']);
    expect((await passedSpells()).find(s => s.name === 'Fireball').prepared).toBe('Prepared');
  });
});

// ---------------------------------------------------------------------------
// Tests — runtime sync effects
// ---------------------------------------------------------------------------

describe('runtime sync on load', () => {
  it('publishes hitPoints to the runtime store and resets fanaticalFocusUsed when not raging', async () => {
    await renderSheet();

    await waitFor(() => {
      expect(mockStore.get(`${CHARACTER}:hitPoints`)).toEqual({ current: 40, max: 40 });
    });
    expect(mockStore.get(`${CHARACTER}:fanaticalFocusUsed`)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — counterspell / dispel magic save-result popups
// ---------------------------------------------------------------------------

describe('counterspell and dispel magic save-result events', () => {
  it('updates the popup from counterspell and dispel events, ignoring irrelevant ones', async () => {
    await renderSheet();
    const setPopupHtml = sharedPopupReturnValue.setPopupHtml;

    window.dispatchEvent(new CustomEvent('counterspell-save-result', {
      detail: {
        attackerName: 'Goblin Boss',
        spellName: 'Fireball',
        saveDc: 15,
        spellResult: 'fails',
        counterspellResult: 'counterspell fails',
      },
    }));
    expect(setPopupHtml).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'automation_info',
      name: 'Counterspell',
    }));
    expect(setPopupHtml.mock.calls.at(-1)[0].description).toContain("Goblin Boss's 'Fireball' counterspell fails — Goblin Boss fails their CON save (DC 15).");

    // Events missing required fields or aimed at another caster must not touch the popup.
    const callsWithoutPopup = setPopupHtml.mock.calls.length;
    window.dispatchEvent(new CustomEvent('counterspell-save-result', {
      detail: { spellName: 'Fireball', saveDc: 15 },
    }));
    window.dispatchEvent(new CustomEvent('spell-result', {
      detail: { casterName: 'Someone Else', targetName: 'Ally One', checkBonus: 7, targetDC: 13, total: 15, checkFailed: false },
    }));
    expect(setPopupHtml).toHaveBeenCalledTimes(callsWithoutPopup);

    window.dispatchEvent(new CustomEvent('spell-result', {
      detail: { casterName: CHARACTER, targetName: 'Goblin Boss', checkBonus: 7, targetDC: 13, total: 15, checkFailed: false },
    }));
    expect(setPopupHtml).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'automation_info',
      name: 'Dispel Magic',
    }));
    expect(setPopupHtml.mock.calls.at(-1)[0].description).toContain('Goblin Boss: ability check 15 (+7) vs DC 13 — spell ended.');

    window.dispatchEvent(new CustomEvent('spell-result', {
      detail: { casterName: CHARACTER, targetName: 'Goblin Boss', checkBonus: 1, targetDC: 18, total: 11, checkFailed: true },
    }));
    expect(setPopupHtml.mock.calls.at(-1)[0].description).toContain('failed, spell not stopped');
  });
});
