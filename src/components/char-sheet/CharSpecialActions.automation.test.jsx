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

function createSpecialAction(name, automation) {
  return { name, description: `${name} description.`, automation };
}

describe('CharSpecialActions - Automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('automation behavior', () => {
    it('executes automation when clicked and cannotAct is false', async () => {
      executeHandler.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Blink Steps', description: 'Teleported 30 ft.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Blink Steps', { type: 'teleport', distance: '30 ft' }),
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" cannotAct={false} />);
      fireEvent.click(screen.getAllByText(/Blink Steps/)[0]);

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledWith(
          playerStats.specialActions[0],
          playerStats,
          'test',
          null
        );
      });
    });

    it('does not execute automation when cannotAct is true', async () => {
      executeHandler.mockResolvedValue(null);

      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Blink Steps', { type: 'teleport', distance: '30 ft' }),
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" cannotAct={true} />);
      fireEvent.click(screen.getAllByText(/Blink Steps/)[0]);

      await waitFor(() => {
        expect(executeHandler).not.toHaveBeenCalled();
      });
    });

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
          createSpecialAction('Misty Step', { type: 'teleport', distance: '30 ft' }),
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getAllByText(/Misty Step/)[0]);

      await waitFor(() => {
        expect(screen.getByTestId('teleport-modal')).toBeInTheDocument();
      });
    });

    it('renders SavantModal when automation returns a savant modal', async () => {
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
          createSpecialAction('Abjuration Savant', { type: 'passive_rule', effect: 'abjuration_savant' }),
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getAllByText(/Abjuration Savant/)[0]);

      await waitFor(() => {
        expect(screen.getByTestId('abjuration-savant-modal')).toBeInTheDocument();
      });
    });

    it('does not render any modal when executeHandler returns null', async () => {
      executeHandler.mockResolvedValue(null);

      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Blink Steps', { type: 'teleport', distance: '30 ft' }),
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getAllByText(/Blink Steps/)[0]);

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
      expect(screen.queryByTestId('teleport-modal')).not.toBeInTheDocument();
    });
  });
});
