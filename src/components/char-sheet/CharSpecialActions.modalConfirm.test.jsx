// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpecialActions from './CharSpecialActions.jsx';

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
    const interactiveTypes = ['teleport', 'signature_spells', 'spell_mastery'];
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

describe('CharSpecialActions - Modal Confirm Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SignatureSpells modal flow', () => {
    it('shows a signature spells modal when automation returns it', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: {
          action: { name: 'Signature Spells' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          level3Options: ['Fireball', 'Haste', 'Counterspell'],
          selectedSpells: [],
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Signature Spells', description: 'Choose two level 3 spells.', automation: { type: 'signature_spells' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Signature Spells/));

      await waitFor(() => {
        expect(screen.getByText(/Signature Spells/)).toBeInTheDocument();
      });
    });

    it('closes signature spells modal on confirm and shows popup', async () => {
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
        payload: { name: 'Signature Spells', description: 'You can now cast Fireball and Haste.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Signature Spells', description: 'Choose two level 3 spells.', automation: { type: 'signature_spells' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Signature Spells/));

      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });

      // Click the confirm button in the mocked modal
      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(onSignatureSpellsSelected).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
      });

      // The popup should be shown from the confirm handler result
      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });

    it('dismisses popup when clicking the overlay after signature spells confirm', async () => {
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
        payload: { name: 'Signature Spells', description: 'You can now cast Fireball and Haste.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Signature Spells', description: 'Choose two level 3 spells.', automation: { type: 'signature_spells' } },
        ],
      });
      const { container } = render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(container.querySelector('b.clickable'));

      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      });

      // Click the overlay to dismiss
      fireEvent.click(screen.getByTestId('popup-overlay'));

      await waitFor(() => {
        expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
      });
    });
  });

  describe('SpellMastery modal flow', () => {
    it('shows a spell mastery modal when automation returns it', async () => {
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

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Spell Mastery', description: 'Choose level 1 and 2 spells.', automation: { type: 'spell_mastery' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Spell Mastery/));

      await waitFor(() => {
        expect(screen.getByText(/Spell Mastery/)).toBeInTheDocument();
      });
    });

    it('closes spell mastery modal on confirm and shows popup', async () => {
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
        type: 'popup',
        payload: { name: 'Spell Mastery', description: 'You can now cast Mage Armor and Shield.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Spell Mastery', description: 'Choose level 1 and 2 spells.', automation: { type: 'spell_mastery' } },
        ],
      });
      const { container } = render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(container.querySelector('b.clickable'));

      await waitFor(() => {
        expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(onSpellMasterySelected).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });

    it('dismisses popup when clicking the overlay after spell mastery confirm', async () => {
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
        type: 'popup',
        payload: { name: 'Spell Mastery', description: 'You can now cast Mage Armor and Shield.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Spell Mastery', description: 'Choose level 1 and 2 spells.', automation: { type: 'spell_mastery' } },
        ],
      });
      const { container } = render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(container.querySelector('b.clickable'));

      await waitFor(() => {
        expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      });

      // Click the overlay to dismiss
      fireEvent.click(screen.getByTestId('popup-overlay'));

      await waitFor(() => {
        expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
      });
    });
  });

  describe('Savant modal confirm flow', () => {
    it('closes savant modal on confirm and shows popup', async () => {
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
        type: 'popup',
        payload: { name: 'Abjuration Savant', description: 'You have added Shield and Mage Armor.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Abjuration Savant', description: 'Choose two abjuration spells.', automation: { type: 'passive_rule', effect: 'abjuration_savant' } },
        ],
      });
      const { container } = render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(container.querySelector('b.clickable'));

      await waitFor(() => {
        expect(screen.getByTestId('abjuration-savant-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(onSavantSelected).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('abjuration-savant-modal')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });

    it('dismisses popup when clicking the overlay after savant confirm', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'evocationSavant',
        payload: {
          action: { name: 'Evocation Savant' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          school: 'Evocation',
          spellOptions: ['Fireball', 'Scorching Burst'],
        },
      });

      onSavantSelected.mockResolvedValue({
        type: 'popup',
        payload: { name: 'Evocation Savant', description: 'You have added Fireball and Scorching Burst.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Evocation Savant', description: 'Choose two evocation spells.', automation: { type: 'passive_rule', effect: 'evocation_savant' } },
        ],
      });
      const { container } = render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(container.querySelector('b.clickable'));

      await waitFor(() => {
        expect(screen.getByTestId('evocation-savant-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      });

      // Click the overlay to dismiss
      fireEvent.click(screen.getByTestId('popup-overlay'));

      await waitFor(() => {
        expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
      });
    });
  });
});
