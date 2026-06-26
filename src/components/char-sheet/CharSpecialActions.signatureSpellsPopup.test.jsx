// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpecialActions from './CharSpecialActions.jsx';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';

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
import { onSignatureSpellsSelected } from '../../services/automation/handlers/class-wizard/signatureSpellsHandler.js';

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

describe('CharSpecialActions - SignatureSpells Confirm Popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SignatureSpells confirm handler popup result', () => {
    it('displays popup when onSignatureSpellsSelected returns a popup result', async () => {
      const mockSetPopupHtml = vi.fn();

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: {
          action: { name: 'Signature Spells', automation: { type: 'signature_spells' } },
          playerStats: basePlayerStats,
          campaignName: 'test',
          level3Options: ['Fireball', 'Haste', 'Counterspell'],
          selectedSpells: [],
        },
      });

      onSignatureSpellsSelected.mockResolvedValue({
        type: 'popup',
        payload: { name: 'Signature Spells', description: 'Spells prepared and ready to cast.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Signature Spells', description: 'Choose two level 3 spells.', automation: { type: 'signature_spells' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
        wrapper: ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
            {children}
          </DiceRollContext.Provider>
        ),
      });

      fireEvent.click(screen.getByText(/Signature Spells/));

      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('Signature Spells');
      expect(popupCall).toContain('Spells prepared and ready to cast.');
    });

    it('uses payload name fallback when popup has no name in signature spells', async () => {
      const mockSetPopupHtml = vi.fn();

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: {
          action: { name: 'Signature Spells' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          level3Options: ['Fireball', 'Haste'],
          selectedSpells: [],
        },
      });

      onSignatureSpellsSelected.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Signature spells selected.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Signature Spells', description: 'Choose two level 3 spells.', automation: { type: 'signature_spells' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
        wrapper: ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
            {children}
          </DiceRollContext.Provider>
        ),
      });

      fireEvent.click(screen.getByText(/Signature Spells/));

      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('Signature Spells');
      expect(popupCall).toContain('Signature spells selected.');
    });

    it('handles string payload in signature spells confirm popup', async () => {
      const mockSetPopupHtml = vi.fn();

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: {
          action: { name: 'Signature Spells' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          level3Options: ['Fireball', 'Haste'],
          selectedSpells: [],
        },
      });

      onSignatureSpellsSelected.mockResolvedValue({
        type: 'popup',
        payload: '<b>Custom HTML popup</b>',
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Signature Spells', description: 'Choose two level 3 spells.', automation: { type: 'signature_spells' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
        wrapper: ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
            {children}
          </DiceRollContext.Provider>
        ),
      });

      fireEvent.click(screen.getByText(/Signature Spells/));

      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith('<b>Custom HTML popup</b>');
      });
    });

    it('clears signature spells modal after confirm regardless of result type', async () => {
      const mockSetPopupHtml = vi.fn();

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: {
          action: { name: 'Signature Spells' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          level3Options: ['Fireball', 'Haste'],
          selectedSpells: [],
        },
      });

      onSignatureSpellsSelected.mockResolvedValue(null);

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Signature Spells', description: 'Choose two level 3 spells.', automation: { type: 'signature_spells' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
        wrapper: ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
            {children}
          </DiceRollContext.Provider>
        ),
      });

      fireEvent.click(screen.getByText(/Signature Spells/));

      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
      });
    });
  });
});
