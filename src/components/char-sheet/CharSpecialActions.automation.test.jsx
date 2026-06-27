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

import { executeHandler } from '../../services/automation/index.js';

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

describe('CharSpecialActions - Automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('automation behavior', () => {
    it('executes automation when a special action with interactive automation is clicked', async () => {
      executeHandler.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Blink Steps', description: 'Teleported 30 ft.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'teleport', distance: '30 ft' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Blink Steps/));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledWith(
          playerStats.specialActions[0],
          playerStats,
          'test',
          null
        );
      });
    });

    it('shows a teleport modal when automation returns a teleport modal', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'teleport',
        payload: {
          action: { name: 'Blink Steps', automation: { effect: 'bonus_teleport', distance: '30 ft' } },
          playerStats: basePlayerStats,
          campaignName: 'test',
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'teleport', distance: '30 ft' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Blink Steps/));

      await waitFor(() => {
        expect(screen.getByTestId('teleport-modal')).toBeInTheDocument();
      });
    });

    it('does not show a teleport modal for unknown modal types', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'unknown',
        payload: { action: { name: 'Unknown' } },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Unknown Action', description: 'Does something unknown.', automation: { type: 'custom' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Unknown Action/));

      await waitFor(() => {
        expect(screen.queryByTestId('teleport-modal')).not.toBeInTheDocument();
      });
    });

    it('renders automation actions with the clickable class', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'teleport', distance: '30 ft' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText(/Blink Steps/)).toHaveClass('clickable');
    });

    it('renders non-automation actions without the clickable class', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Second Wind', description: 'Regain hit points.' },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText(/Second Wind/)).not.toHaveClass('clickable');
    });

    it('renders passive_rule savant actions with the clickable class', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Abjuration Savant', description: 'Choose spells.', automation: { type: 'passive_rule', effect: 'abjuration_savant' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText(/Abjuration Savant/)).toHaveClass('clickable');
    });

    it('does not render passive_rule with non-savant effect as clickable', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Some Feature', description: 'Does something.', automation: { type: 'passive_rule', effect: 'unknown_effect' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText(/Some Feature/)).not.toHaveClass('clickable');
    });

    it('does not render non-interactive automation types as clickable', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Blink Steps', description: 'Teleport.', automation: { type: 'temp_buff', effect: 'bonus_teleport' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText(/Blink Steps/)).not.toHaveClass('clickable');
    });

    it('does not show a popup when executeHandler returns popup (popups removed from Special Actions)', async () => {
      executeHandler.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Berserker Rage', description: 'Enter a berserker rage.' },
      });
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Berserker Rage', description: 'Enter a berserker rage.', automation: { type: 'teleport', distance: '30 ft' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Berserker Rage/));
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });

    it('does not show a popup when a special action with details but no automation is clicked', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          {
            name: 'Second Wind',
            description: 'Regain hit points.',
            details: 'This feature comes from the Fighter class.',
          },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Second Wind/));
      expect(screen.queryByText(/This feature comes from the Fighter class/)).not.toBeInTheDocument();
    });

    it('does not show a popup when a non-clickable special action is clicked', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Berserker Rage', description: 'Enter a berserker rage.' },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Berserker Rage/));
      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });
  });

  describe('cannotAct prop', () => {
    it('prevents automation execution when cannotAct is true', async () => {
      executeHandler.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Blink Steps', description: 'Teleported 30 ft.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'teleport', distance: '30 ft' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" cannotAct={true} />);
      fireEvent.click(screen.getByText(/Blink Steps/));

      await waitFor(() => {
        expect(executeHandler).not.toHaveBeenCalled();
      });
    });

    it('allows automation execution when cannotAct is false', async () => {
      executeHandler.mockResolvedValue(null);

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'teleport', distance: '30 ft' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" cannotAct={false} />);
      fireEvent.click(screen.getByText(/Blink Steps/));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
    });
  });

  describe('interaction with modals', () => {
    it('renders TeleportModal with correct props when shown', async () => {
      const teleportPayload = {
        action: { name: 'Misty Step', automation: { effect: 'teleport', distance: '30 ft' } },
        playerStats: basePlayerStats,
        campaignName: 'test',
      };

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'teleport',
        payload: teleportPayload,
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Misty Step', description: 'Teleport 30 ft.', automation: { type: 'teleport', distance: '30 ft' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Misty Step/));

      await waitFor(() => {
        expect(screen.getByTestId('teleport-modal')).toBeInTheDocument();
      });
    });

    it('closes TeleportModal when close button is clicked', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'teleport',
        payload: {
          action: { name: 'Teleport' },
          playerStats: basePlayerStats,
          campaignName: 'test',
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Teleport', description: 'Teleport somewhere.', automation: { type: 'teleport', distance: '30 ft' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText('Teleport:'));

      await waitFor(() => {
        expect(screen.getByTestId('teleport-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('teleport-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('executeHandler edge cases', () => {
    it('handles executeHandler returning null', async () => {
      executeHandler.mockResolvedValue(null);

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'teleport', distance: '30 ft' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Blink Steps/));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
      expect(screen.queryByTestId('teleport-modal')).not.toBeInTheDocument();
    });

    it('does not show error popup result (popups removed from Special Actions)', async () => {
      executeHandler.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Broken Action', description: 'Failed to execute Broken Action' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Broken Action', description: 'This will fail.', automation: { type: 'teleport', distance: '30 ft' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Broken Action/));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });
  });

  describe('Savant modal flow', () => {
    it('shows a savant modal when automation returns a savant modal', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'abjurationSavant',
        payload: {
          action: { name: 'Abjuration Savant', automation: { type: 'passive_rule', effect: 'abjuration_savant' } },
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
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Abjuration Savant/));

      await waitFor(() => {
        expect(screen.getByTestId('abjuration-savant-modal')).toBeInTheDocument();
      });
    });

    it('renders SavantModal with correct props', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'divinationSavant',
        payload: {
          action: { name: 'Divination Savant' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          school: 'Divination',
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Divination Savant', description: 'Choose two divination spells.', automation: { type: 'passive_rule', effect: 'divination_savant' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Divination Savant/));

      await waitFor(() => {
        expect(screen.getByTestId('divination-savant-modal')).toBeInTheDocument();
      });
    });
  });
});
