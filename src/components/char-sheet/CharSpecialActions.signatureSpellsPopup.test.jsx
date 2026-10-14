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

import { executeHandler } from '../../services/automation/index.js';
import { onSignatureSpellsSelected } from '../../services/automation/handlers/class-wizard/signatureSpellsHandler.js';

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

describe('CharSpecialActions - SignatureSpells Confirm Popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithPopup(overrides = {}) {
    const mockSetPopupHtml = vi.fn();
    const playerStats = createPlayerStats(overrides);
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
    render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
      wrapper: ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      ),
    });
    return mockSetPopupHtml;
  }

  describe('SignatureSpells confirm handler popup result', () => {
    it('opens modal, calls handler with selected spells, and shows popup HTML on popup result', async () => {
      const mockSetPopupHtml = renderWithPopup({
        specialActions: [
          { name: 'Signature Spells', description: 'Choose two level 3 spells.', automation: { type: 'signature_spells' } },
        ],
      });

      onSignatureSpellsSelected.mockResolvedValue({
        type: 'popup',
        payload: { name: 'Signature Spells', description: 'Spells prepared and ready to cast.' },
      });

      fireEvent.click(screen.getByText(/Signature Spells/));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(onSignatureSpellsSelected).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Signature Spells' }),
          expect.any(Object),
          'test',
          'Fireball',
          'Haste'
        );
      });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('fa-solid fa-magic');
      expect(popupCall).toContain('Signature Spells');
      expect(popupCall).toContain('Spells prepared and ready to cast.');

      expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
    });

    it.each([
      { name: 'null result', result: null, expectPopup: false },
      { name: 'undefined result', result: undefined, expectPopup: false },
      { name: 'object payload without name', result: { type: 'popup', payload: { description: 'Fallback name used.' } }, expectPopup: true },
      { name: 'string payload', result: { type: 'popup', payload: 'Direct string response.' }, expectPopup: true },
    ])('handles $name correctly', async ({ result, expectPopup }) => {
      const mockSetPopupHtml = renderWithPopup({
        specialActions: [
          { name: 'Signature Spells', description: 'Choose two level 3 spells.', automation: { type: 'signature_spells' } },
        ],
      });

      onSignatureSpellsSelected.mockResolvedValue(result);

      fireEvent.click(screen.getByText(/Signature Spells/));

      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(onSignatureSpellsSelected).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
      });

      if (expectPopup) {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      } else {
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
      }
    });
  });
});
