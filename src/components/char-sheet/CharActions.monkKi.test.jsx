// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import { executeHandler } from '../../services/automation/index.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  useRuntimeValue: vi.fn(() => null),
  listeners: new Map(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
  evaluateAutoExpression: vi.fn(() => null),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null, handleActionMetamagicConfirm: vi.fn(), handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(), handleSpellAttackClick: vi.fn(), handleSpellDamageClick: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    return null;
  }),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null, gateMetamagic: vi.fn(), handleConfirm: vi.fn(), handleSkip: vi.fn(),
    pendingAid: null, handleAidConfirm: vi.fn(), handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null, handleGreaterRestorationConfirm: vi.fn(), handleGreaterRestorationSkip: vi.fn(),
    pendingRemoveCurse: null, handleRemoveCurseConfirm: vi.fn(), handleRemoveCurseSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: vi.fn(() => []) })),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => {
    if (name.startsWith('+')) return { baseName: name.replace(/^\+\d+\s*/, '') };
    return { baseName: name };
  }),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({ maxFocusPoints: 2 })),
}));

vi.mock('../../services/character/featRangeService.js', () => ({
  computeFeatRangeEffects: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [3, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [3, 2, 3, 2], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 48, rolls: [6, 6, 6, 6, 6, 6, 6, 6], modifier: 0 })),
}));

vi.mock('./useInitiativeEffects.js', () => ({
  default: vi.fn(),
}));

vi.mock('./CharBonusActions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-bonus-actions">CharBonusActions</div>),
}));

vi.mock('./CharActionModals.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-action-modals">CharActionModals</div>),
}));

vi.mock('./CharActionSpellPopups.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-action-spell-popups">CharActionSpellPopups</div>),
}));

const BASE_PLAYER_STATS = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  actions: [],
  bonusActions: [],
  spellAbilities: { spells: [] },
  equipment: [],
};

function createStats(overrides = {}) {
  return { ...BASE_PLAYER_STATS, ...overrides };
}

describe('CharActions monk ki', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    getRuntimeValue.mockImplementation(() => null);
    hasAutomation.mockImplementation(() => false);
  });

  describe('monk ki: focus point skip logic', () => {
    const testCases = [
      { actionName: 'Flurry of Blows', buffs: [], flurryHarm: true, expectFPConsume: false, label: 'Flurry of Blows with Flurry of Healing and Harm' },
      { actionName: 'Flurry of Blows', buffs: [{ effect: 'cloak_of_shadows' }], flurryHarm: false, expectFPConsume: false, label: 'Flurry of Blows with Cloak of Shadows' },
      { actionName: 'Hand of Healing', buffs: [], flurryHarm: true, expectFPConsume: false, label: 'Hand of Healing with Flurry of Healing and Harm' },
      { actionName: 'Hand of Healing', buffs: [{ effect: 'cloak_of_shadows' }], flurryHarm: false, expectFPConsume: true, label: 'Hand of Healing with Cloak of Shadows' },
    ];

    for (const tc of testCases) {
      it(`does ${tc.expectFPConsume ? '' : 'not '}consume focus point for ${tc.label}`, async () => {
        hasAutomation.mockReturnValue(true);
        executeHandler.mockResolvedValue({ type: 'popup', payload: `<b>${tc.actionName}</b>` });

        if (tc.buffs.length > 0) {
          getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'activeBuffs') return tc.buffs;
            return null;
          });
        }

        const stats = createStats({
          class: { class_levels: [{ level: 5, focus_points: 2 }] },
          level: 5,
          ...(tc.flurryHarm ? { specialActions: [{ name: 'Flurry of Healing and Harm' }] } : {}),
          actions: [{ name: tc.actionName, description: 'Test action.', automation: { type: 'auto_effect' } }],
        });

        await act(async () => { render(<CharActions playerStats={stats} />); });
        const actionNameEl = screen.getByText(new RegExp(`${tc.actionName}:`));
        await act(async () => { fireEvent.click(actionNameEl); });
        await waitFor(() => {
          if (tc.expectFPConsume) {
            expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'focusPoints', expect.any(Number), undefined);
          } else {
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', 'focusPoints', expect.any(Number), undefined);
          }
          expect(executeHandler).toHaveBeenCalled();
        });
      });
    }
  });

  describe('monk ki: no FP remaining', () => {
    const testCases = [
      { rules: '5e', expectedMessage: '<b>Flurry of Blows</b><br/>No ki points remaining.', label: '5e' },
      { rules: '2024', expectedMessage: '<b>Flurry of Blows</b><br/>No Focus Points remaining.', label: '2024' },
    ];

    for (const tc of testCases) {
      it(`shows no-FP message when focus points are 0 (${tc.label})`, async () => {
        hasAutomation.mockReturnValue(true);
        getRuntimeValue.mockImplementation((_name, key) => {
          if (key === 'focusPoints') return 0;
          return null;
        });
        const mockSetPopupHtml = vi.fn();
        useLoggedDiceRoll.mockReturnValue({
          popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(),
        });

        const wrapper = ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
            {children}
          </DiceRollContext.Provider>
        );

        await act(async () => {
          render(<CharActions playerStats={createStats({
            class: { class_levels: [{ level: 5, focus_points: 2 }] },
            level: 5,
            rules: tc.rules,
            actions: [{ name: 'Flurry of Blows', description: 'No FP.', automation: { type: 'auto_effect' } }],
          })} />, { wrapper });
        });
        const actionName = screen.getByText(/Flurry of Blows:/);
        await act(async () => { fireEvent.click(actionName); });
        await waitFor(() => {
          expect(mockSetPopupHtml).toHaveBeenCalledWith(tc.expectedMessage);
        });
      });
    }
  });
});
