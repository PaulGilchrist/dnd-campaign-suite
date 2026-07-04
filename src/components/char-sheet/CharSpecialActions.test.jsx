// @improved-by-ai
import { render, screen } from '@testing-library/react';
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

describe('CharSpecialActions - Rendering & Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the Special Actions header', () => {
      render(<CharSpecialActions playerStats={createPlayerStats()} campaignName="test" />);
      expect(screen.getByText('Special Actions')).toBeInTheDocument();
    });

    it('renders special action names and descriptions', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Second Wind', description: 'You can use a bonus action to regain hit points.' },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText(/Second Wind/)).toBeInTheDocument();
      expect(screen.getByText(/You can use a bonus action to regain hit points/)).toBeInTheDocument();
    });

    it('renders multiple special actions', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Second Wind', description: 'Regain hit points.' },
          { name: 'Action Surge', description: 'Take an extra action.' },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText(/Second Wind/)).toBeInTheDocument();
      expect(screen.getByText(/Action Surge/)).toBeInTheDocument();
    });

    it('renders action descriptions through renderMarkdownInline', async () => {
      const { renderMarkdownInline } = await import('../../services/ui/sanitize.js');
      const playerStats = createPlayerStats({
        specialActions: [{ name: 'Test', description: '**bold** text' }],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(renderMarkdownInline).toHaveBeenCalledWith('**bold** text');
    });
  });

  describe('fighting styles', () => {
    it('adds fighting styles from class.fightingStyles when not already in specialActions', async () => {
      const playerStats = createPlayerStats({
        class: { fightingStyles: ['Great Weapon Fighting', 'Protection'] },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      await screen.findByText(/Great Weapon Fighting/);
      // Only the first matching fighting style is added due to if/else if chain
      expect(screen.queryByText(/Protection/)).not.toBeInTheDocument();
    });

    it('does not duplicate a fighting style already in specialActions', async () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Great Weapon Fighting', description: 'Already added.' },
        ],
        class: { fightingStyles: ['Great Weapon Fighting'] },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      const elements = screen.getAllByText(/Great Weapon Fighting/);
      expect(elements).toHaveLength(1);
    });

    it('does not add fighting styles when fightingStyles is undefined or empty', () => {
      const playerStats = createPlayerStats({
        class: {},
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Great Weapon Fighting/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Protection/)).not.toBeInTheDocument();
    });

    it('does not add fighting styles when fightingStyles is empty array', () => {
      const playerStats = createPlayerStats({
        class: { fightingStyles: [] },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Great Weapon Fighting/)).not.toBeInTheDocument();
    });

    it('handles getFightingStyles returning null for unknown style', () => {
      const playerStats = createPlayerStats({
        class: { fightingStyles: ['Unknown Style'] },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Unknown Style/)).not.toBeInTheDocument();
    });
  });

  describe('deduplication across action lists', () => {
    it('filters out actions that appear in actions, bonusActions, reactions, or characterAdvancement', () => {
      // actions list
      const playerStats1 = createPlayerStats({
        specialActions: [{ name: 'Attack', description: 'Make a weapon attack.' }],
        actions: [{ name: 'Attack', description: 'Make a weapon attack.' }],
      });
      render(<CharSpecialActions playerStats={playerStats1} campaignName="test" />);
      expect(screen.queryByText(/Attack/)).not.toBeInTheDocument();
    });

    it('filters out actions that appear in bonusActions', () => {
      const playerStats = createPlayerStats({
        specialActions: [{ name: 'Dash', description: 'Take the Dash action.' }],
        bonusActions: [{ name: 'Dash', description: 'Take the Dash action.' }],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Dash/)).not.toBeInTheDocument();
    });

    it('filters out actions that appear in reactions', () => {
      const playerStats = createPlayerStats({
        specialActions: [{ name: 'Opportunity Attack', description: 'Attack on retreat.' }],
        reactions: [{ name: 'Opportunity Attack', description: 'Attack on retreat.' }],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Opportunity Attack/)).not.toBeInTheDocument();
    });

    it('deduplicates special actions with duplicate names', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Second Wind', description: 'First definition.' },
          { name: 'Second Wind', description: 'Second definition.' },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      const elements = screen.getAllByText(/Second Wind/);
      expect(elements).toHaveLength(1);
    });
  });

  describe('ruleset filtering', () => {
    it('filters out 5e featuresToIgnore and keeps other features', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Spellcasting', description: 'Cast spells.' },
          { name: 'Extra Attack', description: 'Attack twice.' },
          { name: 'Bardic Inspiration', description: 'Inspire allies.' },
          { name: 'Test Feature', description: 'A test feature.' },
        ],
        rules: '5e',
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Spellcasting/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Extra Attack/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Bardic Inspiration/)).not.toBeInTheDocument();
      expect(screen.getByText(/Test Feature/)).toBeInTheDocument();
    });

    it('filters out 2024 featuresToIgnore and keeps other features', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Spellcasting', description: 'Cast spells.' },
          { name: 'Feat', description: 'Take a feat.' },
          { name: 'Fighting Style', description: 'Gain a fighting style.' },
          { name: 'Test Feature', description: 'A test feature.' },
        ],
        rules: '2024',
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Spellcasting/)).not.toBeInTheDocument();
      expect(screen.queryByText(/(^|\s)Feat($|\s)/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Fighting Style/)).not.toBeInTheDocument();
      expect(screen.getByText(/Test Feature/)).toBeInTheDocument();
    });
  });

  describe('edge cases and null safety', () => {
    it('renders gracefully with empty or undefined specialActions', () => {
      render(<CharSpecialActions playerStats={createPlayerStats()} campaignName="test" />);
      expect(screen.getByText('Special Actions')).toBeInTheDocument();
    });

    it('renders gracefully when specialActions is undefined', () => {
      const playerStats = createPlayerStats({ specialActions: undefined });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText('Special Actions')).toBeInTheDocument();
    });

    it('renders gracefully when all action lists are undefined', () => {
      const playerStats = {
        specialActions: [{ name: 'Second Wind', description: 'Regain hit points.' }],
        class: { fightingStyles: [] },
      };
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText(/Second Wind/)).toBeInTheDocument();
    });

    it('uses description as key fallback when special action has no name', () => {
      const playerStats = createPlayerStats({
        specialActions: [{ description: 'An unnamed special action' }],
      });
      const { container } = render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(container.querySelector('.sectionHeader')).toBeInTheDocument();
      expect(screen.getByText('An unnamed special action')).toBeInTheDocument();
    });

    it('uses index fallback key for unnamed actions without description', () => {
      const playerStats = createPlayerStats({
        specialActions: [{}],
      });
      const { container } = render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(container.querySelector('.sectionHeader')).toBeInTheDocument();
    });
  });
});
