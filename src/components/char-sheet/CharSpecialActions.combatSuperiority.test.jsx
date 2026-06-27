// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  default: ({ payload, onConfirm, onReopenSelection, onClose }) => (
    <div data-testid="combat-superiority-modal">
      <span>Combat Superiority</span>
      <span data-testid="cs-modal-selections">{payload?.selectionMode ? 'selection' : 'maneuver'}</span>
      <button onClick={() => onConfirm(['Bull Strike'], null)}>Confirm Maneuver</button>
      <button onClick={() => onConfirm([], null)}>Confirm Selection</button>
      <button onClick={() => onReopenSelection?.()}>Manage Maneuvers</button>
      <button onClick={onClose}>Close</button>
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
vi.mock('../../services/character/fightingStyles.js', () => ({
  getFightingStyle: vi.fn((name) => {
    if (name === 'Great Weapon Fighting') {
      return { name: 'Great Weapon Fighting', description: 'When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit.' };
    }
    if (name === 'Protection') {
      return { name: 'Protection', description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.' };
    }
    return null;
  }),
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

import { executeHandler } from '../../services/automation/index.js';
// eslint-disable-next-line no-unused-vars
import { onSignatureSpellsSelected } from '../../services/automation/handlers/class-wizard/signatureSpellsHandler.js';
// eslint-disable-next-line no-unused-vars
import { onSpellMasterySelected } from '../../services/automation/handlers/class-wizard/spellMasteryHandler.js';
// eslint-disable-next-line no-unused-vars
import { onSavantSelected } from '../../services/automation/handlers/class-wizard/SavantHandler.js';

const basePlayerStats = {
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

describe('CharSpecialActions - Combat Superiority Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combatSuperiority modal flow', () => {
    it('shows combat superiority modal when automation returns it', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'combatSuperiority',
        payload: {
          action: { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
          allManeuvers: [
            { name: 'Bull Strike', description: 'Push target.', actionType: 'bonus_action' },
            { name: 'Trip Attack', description: 'Knock prone.', actionType: 'attack_rider' },
          ],
          knownManeuvers: ['Bull Strike', 'Trip Attack'],
          maxOptions: 4,
          selectionMode: false,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Combat Superiority', description: 'Use a maneuver.', automation: { type: 'combat_superiority' } },
        ],
      });
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Combat Superiority/));

      await waitFor(() => {
        expect(screen.getByTestId('combat-superiority-modal')).toBeInTheDocument();
      });
    });

    it('shows combat superiority modal in selection mode', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'combatSuperiority',
        payload: {
          action: { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
          allManeuvers: [
            { name: 'Bull Strike', description: 'Push target.', actionType: 'bonus_action' },
            { name: 'Trip Attack', description: 'Knock prone.', actionType: 'attack_rider' },
          ],
          knownManeuvers: [],
          maxOptions: 4,
          selectionMode: true,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Combat Superiority', description: 'Choose maneuvers.', automation: { type: 'combat_superiority' } },
        ],
      });
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Combat Superiority/));

      await waitFor(() => {
        expect(screen.getByTestId('combat-superiority-modal')).toBeInTheDocument();
        expect(screen.getByTestId('cs-modal-selections')).toHaveTextContent('selection');
      });
    });

    it('closes combat superiority modal when close button is clicked', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'combatSuperiority',
        payload: {
          action: { name: 'Combat Superiority' },
          allManeuvers: [],
          knownManeuvers: [],
          maxOptions: 4,
          selectionMode: false,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Combat Superiority', description: 'Use a maneuver.', automation: { type: 'combat_superiority' } },
        ],
      });
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Combat Superiority/));

      await waitFor(() => {
        expect(screen.getByTestId('combat-superiority-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('combat-superiority-modal')).not.toBeInTheDocument();
      });
    });

    it('calls onReopenSelection when manage maneuvers button is clicked', async () => {
      const setPopupHtmlMock = vi.fn();

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'combatSuperiority',
        payload: {
          action: { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
          allManeuvers: [],
          knownManeuvers: ['Bull Strike'],
          maxOptions: 4,
          selectionMode: false,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Combat Superiority', description: 'Use a maneuver.', automation: { type: 'combat_superiority' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
        wrapper: ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: setPopupHtmlMock }}>
            {children}
          </DiceRollContext.Provider>
        ),
      });
      fireEvent.click(screen.getByText(/Combat Superiority/));

      await waitFor(() => {
        expect(screen.getByTestId('combat-superiority-modal')).toBeInTheDocument();
      });

      // Clear the initial executeHandler mock for the reopen flow
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'combatSuperiority',
        payload: {
          action: { name: 'Combat Superiority', automation: { type: 'combat_superiority', forceSelectionMode: true } },
          allManeuvers: [],
          knownManeuvers: [],
          maxOptions: 4,
          selectionMode: true,
        },
      });

      fireEvent.click(screen.getByText('Manage Maneuvers'));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledTimes(2);
      });
    });
  });
});

describe('CharSpecialActions - handleAutomationClick combatSuperiority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets combatSuperiorityModal state when result modalName is combatSuperiority', async () => {
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: {
        action: { name: 'Combat Superiority' },
        allManeuvers: [],
        knownManeuvers: [],
        maxOptions: 4,
        selectionMode: false,
      },
    });

    const playerStats = createPlayerStats({
      specialActions: [
        { name: 'Combat Superiority', description: 'Use a maneuver.', automation: { type: 'combat_superiority' } },
      ],
    });
    renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
    fireEvent.click(screen.getByText(/Combat Superiority/));

    await waitFor(() => {
      expect(screen.getByTestId('combat-superiority-modal')).toBeInTheDocument();
    });
  });
});
