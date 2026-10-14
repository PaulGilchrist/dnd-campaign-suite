import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';

// Reuse the shared modal mocks for all modals, automation, runtime, etc.
// The only thing we customize here is the fighting styles mock to include
// all four styles the component checks for (Great Weapon Fighting,
// Interception, Protection, Two-Weapon Fighting).
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(() => Promise.resolve([
    { name: 'Great Weapon Fighting', description: 'When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit.' },
    { name: 'Interception', description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to reduce the damage by 1d10 + your proficiency bonus.' },
    { name: 'Protection', description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll.' },
    { name: 'Two-Weapon Fighting', description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the bonus attack.' },
  ])),
}));

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

describe('CharSpecialActions - Rendering & Filtering', () => {
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

  });

  describe('fighting styles', () => {
    it('adds fighting styles from class.fightingStyles when not already in specialActions', async () => {
      const playerStats = createPlayerStats({
        class: { fightingStyles: ['Great Weapon Fighting'] },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      await waitFor(() => {
        expect(screen.queryByText(/Great Weapon Fighting/)).toBeInTheDocument();
      });
    });

    it('does not duplicate a fighting style already in specialActions', async () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Great Weapon Fighting', description: 'Already added.' },
        ],
        class: { fightingStyles: ['Great Weapon Fighting'] },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      await waitFor(() => {
        const elements = screen.getAllByText(/Great Weapon Fighting/);
        expect(elements).toHaveLength(1);
      });
    });
  });


  describe('ruleset filtering', () => {
    it('filters out featuresToIgnore and keeps other features for 5e ruleset', () => {
      render(
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

      expect(screen.queryByText(/Spellcasting/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Extra Attack/)).not.toBeInTheDocument();
      expect(screen.getByText(/Bardic Inspiration/)).toBeInTheDocument();
      expect(screen.getByText(/Test Feature/)).toBeInTheDocument();
    });

    it('filters out featuresToIgnore and keeps other features for 2024 ruleset', () => {
      render(
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

      expect(screen.queryByText(/Spellcasting/)).not.toBeInTheDocument();
      expect(screen.queryByText(/(^|\s)Feat($|\s)/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Fighting Style/)).not.toBeInTheDocument();
      expect(screen.getByText(/Test Feature/)).toBeInTheDocument();
    });
  });
});
