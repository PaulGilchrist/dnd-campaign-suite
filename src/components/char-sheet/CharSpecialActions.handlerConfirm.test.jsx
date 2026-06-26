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
import { onSpellMasterySelected } from '../../services/automation/handlers/class-wizard/spellMasteryHandler.js';
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

describe('CharSpecialActions - Handler Confirm Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SignatureSpells confirm handler', () => {
    it('calls onSignatureSpellsSelected with the action from modal payload', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: {
          action: { name: 'Signature Spells', automation: { type: 'signature_spells' } },
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
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Signature Spells/));

      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(onSignatureSpellsSelected).toHaveBeenCalledWith(
          { name: 'Signature Spells', automation: { type: 'signature_spells' } },
          playerStats,
          'test',
          'Fireball',
          'Haste'
        );
      });
    });

    it('does not show popup when result is not type popup', async () => {
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
        type: 'other',
        payload: { message: 'Something else happened' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Signature Spells', description: 'Choose two level 3 spells.', automation: { type: 'signature_spells' } },
        ],
      });
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Signature Spells/));

      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
      });

      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });

  });

  describe('SpellMastery confirm handler', () => {
    it('calls onSpellMasterySelected with the action from modal payload', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'spellMastery',
        payload: {
          action: { name: 'Spell Mastery', automation: { type: 'spell_mastery' } },
          playerStats: basePlayerStats,
          campaignName: 'test',
          level1Options: ['Mage Armor', 'Shield'],
          level2Options: ['Web', 'Misty Step'],
          currentLevel1: '',
          currentLevel2: '',
        },
      });

      onSpellMasterySelected.mockResolvedValue(null);

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Spell Mastery', description: 'Choose level 1 and 2 spells.', automation: { type: 'spell_mastery' } },
        ],
      });
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Spell Mastery/));

      await waitFor(() => {
        expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(onSpellMasterySelected).toHaveBeenCalledWith(
          { name: 'Spell Mastery', automation: { type: 'spell_mastery' } },
          playerStats,
          'test',
          'Mage Armor',
          'Shield'
        );
      });
    });

    it('does not show popup when result is not type popup', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'spellMastery',
        payload: {
          action: { name: 'Spell Mastery' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          level1Options: ['Mage Armor', 'Shield'],
          level2Options: ['Web', 'Misty Step'],
          currentLevel1: '',
          currentLevel2: '',
        },
      });

      onSpellMasterySelected.mockResolvedValue({
        type: 'other',
        payload: { message: 'Something else happened' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Spell Mastery', description: 'Choose level 1 and 2 spells.', automation: { type: 'spell_mastery' } },
        ],
      });
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Spell Mastery/));

      await waitFor(() => {
        expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
      });

      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });

  });

  describe('Savant confirm handler', () => {
    it('calls onSavantSelected with the action, playerStats, campaignName, spell1, spell2, and school', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'evocationSavant',
        payload: {
          action: { name: 'Evocation Savant', automation: { type: 'passive_rule', effect: 'evocation_savant' } },
          playerStats: basePlayerStats,
          campaignName: 'test',
          school: 'Evocation',
          spellOptions: ['Fireball', 'Scorching Burst'],
        },
      });

      onSavantSelected.mockResolvedValue(null);

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Evocation Savant', description: 'Choose two evocation spells.', automation: { type: 'passive_rule', effect: 'evocation_savant' } },
        ],
      });
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Evocation Savant/));

      await waitFor(() => {
        expect(screen.getByTestId('evocation-savant-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(onSavantSelected).toHaveBeenCalledWith(
          { name: 'Evocation Savant', automation: { type: 'passive_rule', effect: 'evocation_savant' } },
          playerStats,
          'test',
          'Fireball',
          'Scorching Burst',
          'Evocation'
        );
      });
    });

    it('does not show popup when result is not type popup', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'abjurationSavant',
        payload: {
          action: { name: 'Abjuration Savant' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          school: 'Abjuration',
          spellOptions: ['Shield', 'Mage Armor'],
        },
      });

      onSavantSelected.mockResolvedValue({
        type: 'other',
        payload: { message: 'Something else happened' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Abjuration Savant', description: 'Choose two abjuration spells.', automation: { type: 'passive_rule', effect: 'abjuration_savant' } },
        ],
      });
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Abjuration Savant/));

      await waitFor(() => {
        expect(screen.getByTestId('abjuration-savant-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(screen.queryByTestId('abjuration-savant-modal')).not.toBeInTheDocument();
      });

      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });

  });

  describe('executeHandler result type edge cases', () => {
    it('handles executeHandler returning result with no type field', async () => {
      executeHandler.mockResolvedValue({
        payload: { someData: 'value' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'teleport', distance: '30 ft' } },
        ],
      });
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Blink Steps/));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });

      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
      expect(screen.queryByTestId('teleport-modal')).not.toBeInTheDocument();
    });

    it('handles executeHandler returning result with unknown modalName', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'unknownModalType',
        payload: { action: { name: 'Unknown' } },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Unknown Action', description: 'Does something unknown.', automation: { type: 'teleport', distance: '30 ft' } },
        ],
      });
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Unknown Action/));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });

      expect(screen.queryByTestId('teleport-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('abjuration-savant-modal')).not.toBeInTheDocument();
    });

    it('handles executeHandler returning result with modalName that does not include Savant', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'wizardSavant',
        payload: { action: { name: 'Wizard Savant' } },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Wizard Savant', description: 'Does something.', automation: { type: 'signature_spells' } },
        ],
      });
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Wizard Savant/));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });

      expect(screen.queryByTestId('abjuration-savant-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('divination-savant-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('evocation-savant-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('illusion-savant-modal')).not.toBeInTheDocument();
    });

    it('handles executeHandler returning result with modalName that includes Savant', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'abjurationSavant',
        payload: {
          action: { name: 'Abjuration Savant' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          school: 'Abjuration',
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Abjuration Savant', description: 'Choose two abjuration spells.', automation: { type: 'passive_rule', effect: 'abjuration_savant' } },
        ],
      });
      renderWithDiceRollContext(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Abjuration Savant/));

      await waitFor(() => {
        expect(screen.getByTestId('abjuration-savant-modal')).toBeInTheDocument();
      });
    });
  });
});
