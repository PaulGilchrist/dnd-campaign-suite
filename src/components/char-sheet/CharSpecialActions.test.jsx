// @cleaned-by-ai
import { render, screen, waitFor, within } from '@testing-library/react';
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
    it('renders the Special Actions header and special actions with names and descriptions', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Second Wind', description: 'You can use a bonus action to regain hit points.' },
          { name: 'Action Surge', description: 'Take an extra action.' },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText('Special Actions')).toBeInTheDocument();
      expect(screen.getByText(/Second Wind/)).toBeInTheDocument();
      expect(screen.getByText(/You can use a bonus action to regain hit points/)).toBeInTheDocument();
      expect(screen.getByText(/Action Surge/)).toBeInTheDocument();
    });

    it('renders gracefully with no special actions', () => {
      render(<CharSpecialActions playerStats={createPlayerStats()} campaignName="test" />);
      expect(screen.getByText('Special Actions')).toBeInTheDocument();
    });

    it('renders unnamed special actions using description as fallback', () => {
      const playerStats = createPlayerStats({
        specialActions: [{ description: 'An unnamed special action' }],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText('An unnamed special action')).toBeInTheDocument();
    });

    it('deduplicates special actions with duplicate names showing only one', () => {
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

  describe('fighting styles', () => {
    it('adds fighting styles from class.fightingStyles when not already in specialActions', async () => {
      const playerStats = createPlayerStats({
        class: { fightingStyles: ['Great Weapon Fighting', 'Protection'] },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      await waitFor(() => expect(screen.queryByText(/Great Weapon Fighting/)).toBeInTheDocument());
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
  });

  describe('deduplication across action lists', () => {
    it('filters out actions that appear in other action lists (actions, bonusActions, reactions, characterAdvancement)', () => {
      const playerStats = createPlayerStats({
        specialActions: [{ name: 'Attack', description: 'Make a weapon attack.' }],
        actions: [{ name: 'Attack', description: 'Make a weapon attack.' }],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Attack/)).not.toBeInTheDocument();
    });
  });

  describe('ruleset filtering', () => {
    it('filters out featuresToIgnore and keeps other features for 5e ruleset', async () => {
      const { container } = render(
        <CharSpecialActions playerStats={createPlayerStats({
          specialActions: [
            { name: 'Spellcasting', description: 'Cast spells.' },
            { name: 'Extra Attack', description: 'Attack twice.' },
            { name: 'Bardic Inspiration', description: 'Inspire allies.' },
            { name: 'Test Feature', description: 'A test feature.' },
          ],
          rules: '5e',
        })} campaignName="test" />
      );

      await waitFor(() => {
        expect(within(container).queryByText(/Spellcasting/)).not.toBeInTheDocument();
        expect(within(container).queryByText(/Extra Attack/)).not.toBeInTheDocument();
        expect(within(container).getByText(/Bardic Inspiration/)).toBeInTheDocument();
        expect(within(container).getByText(/Test Feature/)).toBeInTheDocument();
      });
    });

    it('filters out featuresToIgnore and keeps other features for 2024 ruleset', async () => {
      const { container } = render(
        <CharSpecialActions playerStats={createPlayerStats({
          specialActions: [
            { name: 'Spellcasting', description: 'Cast spells.' },
            { name: 'Feat', description: 'Take a feat.' },
            { name: 'Fighting Style', description: 'Gain a fighting style.' },
            { name: 'Test Feature', description: 'A test feature.' },
          ],
          rules: '2024',
        })} campaignName="test" />
      );

      await waitFor(() => {
        expect(within(container).queryByText(/Spellcasting/)).not.toBeInTheDocument();
        expect(within(container).queryByText(/(^|\s)Feat($|\s)/)).not.toBeInTheDocument();
        expect(within(container).queryByText(/Fighting Style/)).not.toBeInTheDocument();
        expect(within(container).getByText(/Test Feature/)).toBeInTheDocument();
      });
    });
  });
});
