// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpecialActions from './CharSpecialActions.jsx';

// Mock executeHandler
vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

// Mock hasAutomation
vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn((action) => !!(action?.automation)),
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

// Mock renderMarkdownInline to pass through (what the component actually uses)
vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
  renderMarkdown: vi.fn((md) => md),
  renderMarkdownInline: vi.fn((md) => md),
}));

// Mock fighting styles with realistic return values (no `type` field)
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

describe('CharSpecialActions', () => {
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
    it('adds Great Weapon Fighting from fightingStyles when not already present', () => {
      const playerStats = createPlayerStats({
        class: { fightingStyles: ['Great Weapon Fighting'] },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText(/Great Weapon Fighting/)).toBeInTheDocument();
    });

    it('adds Protection from fightingStyles when not already present', () => {
      const playerStats = createPlayerStats({
        class: { fightingStyles: ['Protection'] },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText(/Protection/)).toBeInTheDocument();
    });

    it('does not duplicate a fighting style already in specialActions', () => {
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

    it('adds only the first matching fighting style when both GWF and Protection are present', () => {
      const playerStats = createPlayerStats({
        specialActions: [],
        class: { fightingStyles: ['Great Weapon Fighting', 'Protection'] },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.getByText(/Great Weapon Fighting/)).toBeInTheDocument();
      expect(screen.queryByText(/Protection/)).not.toBeInTheDocument();
    });

    it('does not add fighting styles when fightingStyles is undefined', () => {
      const playerStats = createPlayerStats({
        class: {},
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Great Weapon Fighting/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Protection/)).not.toBeInTheDocument();
    });

    it('does not add fighting styles when fightingStyles is empty', () => {
      const playerStats = createPlayerStats({
        class: { fightingStyles: [] },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Great Weapon Fighting/)).not.toBeInTheDocument();
    });
  });

  describe('deduplication across action lists', () => {
    it('filters out actions that appear in the actions list', () => {
      const playerStats = createPlayerStats({
        specialActions: [{ name: 'Attack', description: 'Make a weapon attack.' }],
        actions: [{ name: 'Attack', description: 'Make a weapon attack.' }],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Attack/)).not.toBeInTheDocument();
    });

    it('filters out actions that appear in the bonusActions list', () => {
      const playerStats = createPlayerStats({
        specialActions: [{ name: 'Dash', description: 'Take the Dash action.' }],
        bonusActions: [{ name: 'Dash', description: 'Take the Dash action.' }],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Dash/)).not.toBeInTheDocument();
    });

    it('filters out actions that appear in the reactions list', () => {
      const playerStats = createPlayerStats({
        specialActions: [{ name: 'Opportunity Attack', description: 'Attack on retreat.' }],
        reactions: [{ name: 'Opportunity Attack', description: 'Attack on retreat.' }],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Opportunity Attack/)).not.toBeInTheDocument();
    });

    it('filters out actions that appear in the characterAdvancement list', () => {
      const playerStats = createPlayerStats({
        specialActions: [{ name: 'Extra Attack', description: 'Attack twice.' }],
        characterAdvancement: [{ name: 'Extra Attack', description: 'Attack twice.' }],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Extra Attack/)).not.toBeInTheDocument();
    });

    it('filters out when an action name matches multiple lists', () => {
      const playerStats = createPlayerStats({
        specialActions: [{ name: 'Attack', description: 'Special attack.' }],
        actions: [{ name: 'Attack', description: 'Regular attack.' }],
        bonusActions: [{ name: 'Attack', description: 'Bonus attack.' }],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Attack/)).not.toBeInTheDocument();
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

  describe('popup behavior', () => {
    it('shows a popup when a special action with details is clicked', () => {
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
      expect(screen.getByText(/This feature comes from the Fighter class/)).toBeInTheDocument();
    });

    it('shows a popup when a non-clickable special action is clicked', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Rage', description: 'Enter a berserker rage.' },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Rage/));
      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      const elements = screen.getAllByText(/Enter a berserker rage/);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('dismisses the popup when the overlay is clicked', async () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Rage', description: 'Enter a berserker rage.' },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Rage/));
      await waitFor(() => {
        expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('popup-overlay'));
      await waitFor(() => {
        expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
      });
    });
  });

  describe('automation behavior', () => {
    it('executes automation when a special action with automation is clicked', async () => {
      executeHandler.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Blink Steps', description: 'Teleported 30 ft.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'temp_buff', effect: 'bonus_teleport' } },
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

    it('shows an automation info popup when executeHandler returns type popup', async () => {
      executeHandler.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Blink Steps', description: 'Teleported 30 ft.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'temp_buff', effect: 'bonus_teleport' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Blink Steps/));

      await waitFor(() => {
        expect(screen.getByText(/Teleported 30 ft/)).toBeInTheDocument();
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
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'temp_buff', effect: 'bonus_teleport' } },
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
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'temp_buff', effect: 'bonus_teleport' } },
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
  });

  describe('cannotAct prop', () => {
    it('prevents automation execution when cannotAct is true', async () => {
      executeHandler.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Blink Steps', description: 'Teleported 30 ft.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'temp_buff', effect: 'bonus_teleport' } },
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
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'temp_buff', effect: 'bonus_teleport' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" cannotAct={false} />);
      fireEvent.click(screen.getByText(/Blink Steps/));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
    });

    it('allows non-automation actions when cannotAct is true', () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Second Wind', description: 'Regain hit points.', details: 'Fighter class feature.' },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" cannotAct={true} />);
      fireEvent.click(screen.getByText(/Second Wind/));
      expect(screen.getByText(/Fighter class feature/)).toBeInTheDocument();
    });
  });

  describe('edge cases and null safety', () => {
    it('renders gracefully with empty specialActions array', () => {
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

    it('handles executeHandler returning null', async () => {
      executeHandler.mockResolvedValue(null);

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Blink Steps', description: 'Teleport up to 30 feet.', automation: { type: 'temp_buff', effect: 'bonus_teleport' } },
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

    it('handles executeHandler returning an error popup result', async () => {
      executeHandler.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Broken Action', description: 'Failed to execute Broken Action' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Broken Action', description: 'This will fail.', automation: { type: 'temp_buff', effect: 'bonus_teleport' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(/Broken Action/));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      });
      expect(screen.getByText(/Failed to execute Broken Action/)).toBeInTheDocument();
    });

    it('handles getFightingStyle returning null for unknown style', () => {
      // The mock already returns null for unknown names
      const playerStats = createPlayerStats({
        class: { fightingStyles: ['Unknown Style'] },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      expect(screen.queryByText(/Unknown Style/)).not.toBeInTheDocument();
    });
  });
});
