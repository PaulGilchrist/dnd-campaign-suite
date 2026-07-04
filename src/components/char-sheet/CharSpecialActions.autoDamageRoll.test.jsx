// @cleaned-by-ai
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpecialActions from './CharSpecialActions.jsx';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';

const renderWithDiceRollContext = (component, options = {}) => {
  const wrapper = ({ children }) => (
    <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
      {children}
    </DiceRollContext.Provider>
  );
  return render(component, { wrapper, ...options });
};

// Mock ui-config to eliminate delays
vi.mock('../../config/ui-config.js', () => ({
  SHOW_DICE_ROLL_DELAY: 0,
}));

// Mock executeHandler
vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

// Mock automation service
vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn((action) => !!(action?.automation)),
  isInteractiveAutomation: vi.fn((action) => {
    if (!action?.automation) return false;
    const auto = Array.isArray(action.automation) ? action.automation[0] : action.automation;
    const interactiveTypes = ['teleport', 'signature_spells', 'spell_mastery', 'combat_superiority', 'weapon_kind_mastery', 'weapon_mastery_choice'];
    if (auto.type === 'passive_rule') {
      const interactiveEffects = ['abjuration_savant', 'divination_savant', 'evocation_savant', 'illusion_savant'];
      return interactiveEffects.includes(auto.effect);
    }
    return interactiveTypes.includes(auto.type);
  }),
}));

// Mock TeleportModal
vi.mock('./modals/TeleportModal.jsx', () => ({
  default: ({ action, onClose }) => (
    <div data-testid="teleport-modal">
      <span>{action?.name || 'Teleport'}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock SignatureSpellsModal
vi.mock('./modals/arcane/SignatureSpellsModal.jsx', () => ({
  default: ({ payload: _payload, onConfirm, onClose }) => (
    <div data-testid="signature-spells-modal" role="presentation" onClick={onClose}>
      <h3>Signature Spells</h3>
      <button onClick={() => onConfirm('Fireball', 'Haste')}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock SpellMasteryModal
vi.mock('./modals/arcane/SpellMasteryModal.jsx', () => ({
  default: ({ payload: _payload, onConfirm, onClose }) => (
    <div data-testid="spell-mastery-modal" role="presentation" onClick={onClose}>
      <h3>Spell Mastery</h3>
      <button onClick={() => onConfirm('Mage Armor', 'Shield')}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock SavantModal
vi.mock('./modals/arcane/SavantModal.jsx', () => ({
  default: ({ payload, onConfirm, onClose }) => (
    <div data-testid={`${payload?.school?.toLowerCase() || 'savant'}-savant-modal`} role="presentation" onClick={onClose}>
      <span>{payload?.school || 'Savant'} Savant</span>
      <button onClick={() => onConfirm(payload?.spellOptions?.[0] || 'Shield', payload?.spellOptions?.[1] || 'Mage Armor')}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock WeaponKindMasteryModal
vi.mock('./modals/WeaponKindMasteryModal.jsx', () => ({
  default: ({ action, _playerStats, _campaignName, _meleeOnly, onClose, _existing }) => (
    <div data-testid="weapon-kind-mastery-modal">
      <span>{action?.name || 'Weapon Kind Mastery'}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock WeaponMasteryChoiceModal
vi.mock('./modals/WeaponMasteryChoiceModal.jsx', () => ({
  default: ({ action: _action, _playerStats, _campaignName, _masteryProperties, onClose, _onConfirm }) => (
    <div data-testid="weapon-mastery-choice-modal">
      <span>Weapon Mastery Choice</span>
      <button onClick={onClose}>Close</button>
      <button onClick={() => _onConfirm && _onConfirm('Finesse')}>Confirm</button>
    </div>
  ),
}));

// Mock CombatSuperiorityModal
vi.mock('./modals/CombatSuperiorityModal.jsx', () => ({
  default: ({ _payload, onConfirm, _onReopenSelection, _onClose }) => (
    <div data-testid="combat-superiority-modal">
      <span>Combat Superiority</span>
      <button onClick={() => onConfirm([], null)}>Close</button>
    </div>
  ),
}));

// Mock renderMarkdownInline
vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
  renderMarkdown: vi.fn((md) => md),
  renderMarkdownInline: vi.fn((md) => md),
}));

// Mock fighting styles
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(() => Promise.resolve([
    { name: 'Great Weapon Fighting', description: 'When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit.' },
    { name: 'Protection', description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.' },
  ])),
}));

// Mock the handler functions called by modal confirm callbacks
vi.mock('../../services/automation/handlers/class-wizard/signatureSpellsHandler.js', () => ({
  onSignatureSpellsSelected: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-wizard/spellMasteryHandler.js', () => ({
  onSpellMasterySelected: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-wizard/SavantHandler.js', () => ({
  onSavantSelected: vi.fn(),
}));

// Mock dice roller
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionDoubled: vi.fn(),
}));

// Capture the autoDamageRoll callback and rollDamage function
let capturedAutoDamageRoll = null;
let capturedRollDamageFn = null;

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn((characterName, campaignName, options) => {
    capturedAutoDamageRoll = options?.autoDamageRoll || null;
    const mockRollDamage = vi.fn();
    capturedRollDamageFn = mockRollDamage;
    return {
      rollAttack: vi.fn(),
      rollDamage: mockRollDamage,
      autoDamageRoll: options?.autoDamageRoll,
    };
  }),
}));

// Mock useCombatSuperiorityModal
vi.mock('../../hooks/combat/useCombatSuperiorityModal.js', () => ({
  useCombatSuperiorityModal: vi.fn(() => ({
    combatSuperiorityModal: null,
    setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleCombatSuperiorityReopenSelection: vi.fn(),
  })),
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';

const basePlayerStats = {
  name: 'TestCharacter',
  specialActions: [],
  class: {
    fightingStyles: [],
  },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
};

function createPlayerStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharSpecialActions - autoDamageRoll callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedAutoDamageRoll = null;
    capturedRollDamageFn = null;
    rollExpression.mockReturnValue({ total: 7, rolls: [5, 2], modifier: 0 });
    rollExpressionDoubled.mockReturnValue({ total: 14, rolls: [5, 2, 5, 2], modifier: 0, doubledRolls: [5, 2, 5, 2] });
  });

  function getAutoDamageRoll() {
    return capturedAutoDamageRoll;
  }

  function getRollDamageCalls() {
    return capturedRollDamageFn?.mock?.calls || [];
  }

  describe('formula parsing and damage roll', () => {
    function buildAutoDamage(overrides = {}) {
      return {
        name: 'Riposte',
        formula: '2d6+ 1 [Superiority]',
        damageType: 'Slashing',
        targetName: 'Goblin',
        attackerName: 'TestCharacter',
        ...overrides,
      };
    }

    it.each([
      { isCrit: false, rollFn: 'rollExpression', baseTotal: 5, superiority: 1, expectedTotal: 6, expectedRolls: [3, 2, 1], description: 'non-crit superiority' },
      { isCrit: true, rollFn: 'rollExpressionDoubled', baseTotal: 10, superiority: 1, expectedTotal: 11, expectedRolls: [3, 2, 3, 2, 1], description: 'crit superiority' },
    ])('calls rollDamage with superiority formula ($description)', async ({ isCrit, rollFn, baseTotal, _superiority, expectedTotal, expectedRolls }) => {
      if (rollFn === 'rollExpression') {
        rollExpression.mockReturnValue({ total: baseTotal, rolls: [3, 2], modifier: 0 });
      } else {
        rollExpressionDoubled.mockReturnValue({ total: baseTotal, rolls: [3, 2, 3, 2], modifier: 0, doubledRolls: [3, 2, 3, 2] });
      }

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Combat Superiority', description: 'Use a maneuver.', automation: { type: 'combat_superiority' } },
        ],
      });

      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" characters={[]} />);

      const autoDamageRoll = getAutoDamageRoll();
      expect(autoDamageRoll).toBeDefined();

      const mockAutoDamage = buildAutoDamage({ formula: '2d6+ 1 [Superiority]' });
      await autoDamageRoll(mockAutoDamage, isCrit);

      expect(rollFn === 'rollExpression' ? rollExpression : rollExpressionDoubled).toHaveBeenCalledWith('2d6');

      const calls = getRollDamageCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe('Riposte');
      expect(calls[0][1]).toBe('2d6+ 1 [Superiority]');
      expect(calls[0][2]).toBe(expectedTotal);
      expect(calls[0][3]).toEqual(expectedRolls);
      expect(calls[0][4]).toBe(0);
      expect(calls[0][5].isAutoCrit).toBe(isCrit);
      expect(calls[0][5].damageType).toBe('Slashing');
      expect(calls[0][5].targetName).toBe('Goblin');
      expect(calls[0][5].attackerName).toBe('TestCharacter');
      expect(calls[0][5].playerStats).toBeDefined();
    });

    it.each([
      { isCrit: false, rollFn: 'rollExpression', formula: '2d6+3', expectedTotal: 8, expectedRolls: [6, 2], description: 'non-crit standard' },
      { isCrit: true, rollFn: 'rollExpressionDoubled', formula: '2d6+3', expectedTotal: 16, expectedRolls: [6, 2, 6, 2], doubledRolls: [6, 2, 6, 2], description: 'crit standard' },
    ])('calls rollDamage with standard formula ($description)', async ({ isCrit, rollFn, formula, expectedTotal, expectedRolls, doubledRolls }) => {
      if (rollFn === 'rollExpression') {
        rollExpression.mockReturnValue({ total: expectedTotal, rolls: expectedRolls, modifier: 0 });
      } else {
        rollExpressionDoubled.mockReturnValue({ total: expectedTotal, rolls: expectedRolls, modifier: 0, doubledRolls });
      }

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Combat Superiority', description: 'Use a maneuver.', automation: { type: 'combat_superiority' } },
        ],
      });

      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" characters={[]} />);

      const autoDamageRoll = getAutoDamageRoll();

      const mockAutoDamage = {
        name: 'Longsword Attack',
        formula,
        damageType: 'Slashing',
        targetName: 'Goblin',
        attackerName: 'TestCharacter',
      };

      await autoDamageRoll(mockAutoDamage, isCrit);

      expect(rollFn === 'rollExpression' ? rollExpression : rollExpressionDoubled).toHaveBeenCalledWith(formula);
      const calls = getRollDamageCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe('Longsword Attack');
      expect(calls[0][1]).toBe(formula);
      expect(calls[0][2]).toBe(expectedTotal);
      expect(calls[0][3]).toEqual(expectedRolls);
      expect(calls[0][4]).toBe(0);
      expect(calls[0][5].isAutoCrit).toBe(isCrit);
      if (doubledRolls) {
        expect(calls[0][5].doubledRolls).toEqual(doubledRolls);
      }
      expect(calls[0][5].damageType).toBe('Slashing');
      expect(calls[0][5].targetName).toBe('Goblin');
      expect(calls[0][5].attackerName).toBe('TestCharacter');
      expect(calls[0][5].playerStats).toBeDefined();
    });
  });

  describe('riposte popup handling', () => {
    function renderWithPopup(setPopupHtmlMock) {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Combat Superiority', description: 'Use a maneuver.', automation: { type: 'combat_superiority' } },
        ],
      });

      return {
        autoDamageRoll: (() => {
          render(<CharSpecialActions playerStats={playerStats} campaignName="test" characters={[]} />, {
            wrapper: ({ children }) => (
              <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: setPopupHtmlMock }}>
                {children}
              </DiceRollContext.Provider>
            ),
          });
          return getAutoDamageRoll();
        })(),
      };
    }

    it.each([
      { payload: '<b>Counterattack!</b> You deal extra damage.', expected: '<b>Counterattack!</b> You deal extra damage.', description: 'string payload' },
      { payload: { name: 'Combat Superiority', description: 'You strike back at the attacker.' }, expectedContains: ['Combat Superiority', 'You strike back at the attacker.'], description: 'object payload with name' },
      { payload: { description: 'Some riposte effect.' }, expectedContains: ['Combat Superiority', 'Some riposte effect.'], description: 'object payload without name uses fallback' },
    ])('shows riposte popup when autoDamage has ripostePopup as $description', async ({ payload, expected, expectedContains }) => {
      const mockSetPopupHtml = vi.fn();
      rollExpression.mockReturnValue({ total: 5, rolls: [3, 2], modifier: 0 });

      const { autoDamageRoll } = renderWithPopup(mockSetPopupHtml);

      const mockAutoDamage = {
        name: 'Riposte',
        formula: '2d6+ 1 [Superiority]',
        damageType: 'Slashing',
        targetName: 'Goblin',
        attackerName: 'TestCharacter',
        ripostePopup: payload,
      };

      await autoDamageRoll(mockAutoDamage, false);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      if (expected) {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expected);
      } else {
        const popupCall = mockSetPopupHtml.mock.calls[0][0];
        for (const text of expectedContains) {
          expect(popupCall).toContain(text);
        }
      }
    });
  });

  describe('null safety', () => {
    it('does not call rollDamage when formula roll returns null', async () => {
      rollExpression.mockReturnValue(null);

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Combat Superiority', description: 'Use a maneuver.', automation: { type: 'combat_superiority' } },
        ],
      });

      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" characters={[]} />);

      const autoDamageRoll = getAutoDamageRoll();
      await autoDamageRoll({
        name: 'Test Attack',
        formula: 'invalid formula',
        damageType: 'Slashing',
        targetName: 'Goblin',
        attackerName: 'TestCharacter',
      }, false);

      expect(getRollDamageCalls()).toHaveLength(0);
    });
  });
});
