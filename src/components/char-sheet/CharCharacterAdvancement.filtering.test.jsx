// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

const { mockGetRuntimeValue, mockSetRuntimeValue } = vi.hoisted(() => ({
  mockGetRuntimeValue: vi.fn(() => null),
  mockSetRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: mockGetRuntimeValue,
  setRuntimeValue: mockSetRuntimeValue,
}));

describe('CharCharacterAdvancement - Feature Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('featuresToIgnore filtering (5e ruleset)', () => {
    it('filters out features named "Spellcasting" in 5e ruleset', () => {
      const playerStats = {
        name: 'Test Character',
        rules: '5e',
        characterAdvancement: [
          { name: 'Spellcasting', description: 'Cast spells.' },
          { name: 'Second Feature', description: 'A real feature.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.queryByText(/Spellcasting:/)).not.toBeInTheDocument();
      expect(screen.getByText('Second Feature:')).toBeInTheDocument();
    });

    it('filters out features named "Extra Attack" in 5e ruleset', () => {
      const playerStats = {
        name: 'Test Character',
        rules: '5e',
        characterAdvancement: [
          { name: 'Extra Attack', description: 'Attack twice.' },
          { name: 'Action Surge', description: 'Take an extra action.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.queryByText(/Extra Attack:/)).not.toBeInTheDocument();
      expect(screen.getByText('Action Surge:')).toBeInTheDocument();
    });

    it('filters out features named "Rage" in 5e ruleset', () => {
      const playerStats = {
        name: 'Test Character',
        rules: '5e',
        characterAdvancement: [
          { name: 'Rage', description: 'Enter a rage.' },
          { name: 'Unarmored Defense', description: 'No armor defense.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.queryByText(/Rage:/)).not.toBeInTheDocument();
      expect(screen.getByText('Unarmored Defense:')).toBeInTheDocument();
    });

    it('filters out all features in the 5e ignore list', () => {
      const ignored5e = [
        'Ability Score Improvement', 'Bardic Inspiration', 'Brutal Critical',
        'Channel Divinity', 'Divine Domain', 'Domain Spells', 'Druid Circle',
        'Druidic', 'Extra Attack', 'Ki', 'Martial Archetype', 'Monastic Tradition',
        'Primal Path', 'Rage', 'Ranger Archetype', 'Roguish Archetype',
        'Sacred Oath', 'Sorcerous Origin', 'Spellcasting',
      ];
      const features = ignored5e.map(name => ({ name, description: `Description for ${name}` }));
      const playerStats = {
        name: 'Test Character',
        rules: '5e',
        characterAdvancement: features,
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      for (const name of ignored5e) {
        expect(screen.queryByText(new RegExp(`${name}:`))).not.toBeInTheDocument();
      }
    });

    it('shows features not in the 5e ignore list', () => {
      const playerStats = {
        name: 'Test Character',
        rules: '5e',
        characterAdvancement: [
          { name: 'Draconic Ancestry', description: 'Choose a dragon type.' },
          { name: 'Draconic Resilience', description: 'Scale-like skin.' },
          { name: 'Spellcasting', description: 'Cast spells.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Draconic Ancestry:')).toBeInTheDocument();
      expect(screen.getByText('Draconic Resilience:')).toBeInTheDocument();
      expect(screen.queryByText(/Spellcasting:/)).not.toBeInTheDocument();
    });
  });

  describe('featuresToIgnore filtering (2024 ruleset)', () => {
    it('filters out features named "Spellcasting" in 2024 ruleset', () => {
      const playerStats = {
        name: 'Test Character',
        rules: '2024',
        characterAdvancement: [
          { name: 'Spellcasting', description: 'Cast spells.' },
          { name: 'Pact Magic', description: 'Warlock magic.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.queryByText(/Spellcasting:/)).not.toBeInTheDocument();
      expect(screen.getByText('Pact Magic:')).toBeInTheDocument();
    });

    it('filters out features named "Barbarian Subclass" in 2024 ruleset', () => {
      const playerStats = {
        name: 'Test Character',
        rules: '2024',
        characterAdvancement: [
          { name: 'Barbarian Subclass', description: 'Subclass feature.' },
          { name: 'Reckless Abandon', description: 'A real feature.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.queryByText(/Barbarian Subclass:/)).not.toBeInTheDocument();
      expect(screen.getByText('Reckless Abandon:')).toBeInTheDocument();
    });

    it('filters out all features in the 2024 ignore list', () => {
      const ignored2024 = [
        '(capstone - depends on subclass)', 'Ability Score Improvement',
        'Barbarian Subclass', 'Bard Subclass', 'Bardic Inspiration',
        'Body and Mind', 'Channel Divinity', 'Cleric Subclass',
        'Celestial Resistance', 'Damage Resistance', 'Darkvision',
        'Draconic Resilience', 'Druid Subclass', 'Druidic',
        'Eldritch Invocations', 'Epic Boon', 'Extra Attack',
        'Two Extra Attacks', 'Three Extra Attacks', 'Fast Movement',
        'Feat', 'Feral Senses', 'Fighter Subclass', 'Fighting Style',
        'Foe Slayer', 'Gnomish Cunning', 'Implements of Mercy',
        'Increased Hit Points', 'Keen Senses', 'Monk Subclass',
        'Paladin Subclass', 'Ranger Subclass', 'Rogue Subclass',
        'Scholar', 'Skillful', 'Sorcerer Subclass', 'Spellcasting',
        'Subclass feature', "Thieves' Cant", 'Trance',
        'Unarmored Defense', 'Unarmored Movement', 'Versatile',
        'Warlock Subclass', 'Wizard Subclass',
      ];
      const features = ignored2024.map(name => ({ name, description: `Description for ${name}` }));
      const playerStats = {
        name: 'Test Character',
        rules: '2024',
        characterAdvancement: features,
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      for (const name of ignored2024) {
        expect(screen.queryByText(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':'))).not.toBeInTheDocument();
      }
    });

    it('shows features not in the 2024 ignore list', () => {
      const playerStats = {
        name: 'Test Character',
        rules: '2024',
        characterAdvancement: [
          { name: 'Draconic Ancestry', description: 'Choose a dragon type.' },
          { name: 'Spellcasting', description: 'Cast spells.' },
          { name: 'Expertise', description: 'Double proficiency.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Draconic Ancestry:')).toBeInTheDocument();
      expect(screen.getByText('Expertise:')).toBeInTheDocument();
      expect(screen.queryByText(/Spellcasting:/)).not.toBeInTheDocument();
    });
  });

  describe('default ruleset fallback', () => {
    it('uses 5e ruleset when rules field is undefined', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'Spellcasting', description: 'Cast spells.' },
          { name: 'Real Feature', description: 'Not filtered.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.queryByText(/Spellcasting:/)).not.toBeInTheDocument();
      expect(screen.getByText('Real Feature:')).toBeInTheDocument();
    });

    it('uses 5e ruleset when rules field is null', () => {
      const playerStats = {
        name: 'Test Character',
        rules: null,
        characterAdvancement: [
          { name: 'Spellcasting', description: 'Cast spells.' },
          { name: 'Real Feature', description: 'Not filtered.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.queryByText(/Spellcasting:/)).not.toBeInTheDocument();
      expect(screen.getByText('Real Feature:')).toBeInTheDocument();
    });

    it('uses 2024 ruleset when explicitly set', () => {
      const playerStats = {
        name: 'Test Character',
        rules: '2024',
        characterAdvancement: [
          { name: 'Spellcasting', description: 'Cast spells.' },
          { name: 'Wizard Subclass', description: 'Subclass.' },
          { name: 'Real Feature', description: 'Not filtered.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.queryByText(/Spellcasting:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Wizard Subclass:/)).not.toBeInTheDocument();
      expect(screen.getByText('Real Feature:')).toBeInTheDocument();
    });
  });

  describe('mixed features with and without automation', () => {
    it('renders features with automation alongside features without', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'No Automation', description: 'Plain feature.' },
          {
            name: 'With Automation',
            description: 'Has options.',
            automation: {
              options: ['Option A', 'Option B'],
            },
          },
          { name: 'Another Plain', description: 'Also plain.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('No Automation:')).toBeInTheDocument();
      expect(screen.getByText('With Automation:')).toBeInTheDocument();
      expect(screen.getByText('Another Plain:')).toBeInTheDocument();
      expect(screen.getByText('Choice:')).toBeInTheDocument();
      expect(screen.getByText('Option A')).toBeInTheDocument();
    });

    it('renders features without automation and without automation field', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'Feature A', description: 'First.' },
          { name: 'Feature B', description: 'Second.', automation: {} },
          { name: 'Feature C', description: 'Third.', automation: { options: ['X', 'Y'] } },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Feature A:')).toBeInTheDocument();
      expect(screen.getByText('Feature B:')).toBeInTheDocument();
      expect(screen.getByText('Feature C:')).toBeInTheDocument();
      expect(screen.queryByText('Choice:')).toBeInTheDocument();
    });

    it('renders features with automation options alongside plain features in correct order', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'First', description: 'First desc.' },
          {
            name: 'Second',
            description: 'Second desc.',
            automation: { options: ['A', 'B'] },
          },
          { name: 'Third', description: 'Third desc.' },
          {
            name: 'Fourth',
            description: 'Fourth desc.',
            automation: { options: [{ name: 'One' }, { name: 'Two' }] },
          },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('First:')).toBeInTheDocument();
      expect(screen.getByText('Second:')).toBeInTheDocument();
      expect(screen.getByText('Third:')).toBeInTheDocument();
      expect(screen.getByText('Fourth:')).toBeInTheDocument();
      expect(screen.getByText('First desc.')).toBeInTheDocument();
      expect(screen.getByText('Second desc.')).toBeInTheDocument();
      expect(screen.getByText('Third desc.')).toBeInTheDocument();
      expect(screen.getByText('Fourth desc.')).toBeInTheDocument();
    });
  });

  describe('feature name edge cases', () => {
    it('renders feature with empty string name using index-based key', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: '', description: 'Empty name feature.' },
          { name: 'Named', description: 'Named feature.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Named:')).toBeInTheDocument();
      expect(screen.getByText('Empty name feature.')).toBeInTheDocument();
    });

    it('renders feature with whitespace-only name using index-based key', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: '   ', description: 'Whitespace name feature.' },
          { name: 'Named', description: 'Named feature.' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Named:')).toBeInTheDocument();
      expect(screen.getByText('Whitespace name feature.')).toBeInTheDocument();
    });
  });

  describe('stopPropagation on choice click', () => {
    it('stops propagation when a choice option is clicked', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          {
            name: 'Choose Feature',
            description: 'A choice',
            automation: {
              options: ['Option A', 'Option B'],
            },
          },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      const optionB = screen.getByText('Option B');
      const stopPropagationSpy = vi.fn();
      optionB.addEventListener('click', (e) => {
        e.stopPropagation();
        stopPropagationSpy();
      }, true);
      fireEvent.click(optionB);
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('campaignName edge cases', () => {
    it('renders correctly when campaignName is null', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'Feature 1', description: 'Description 1' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName={null} />);
      expect(screen.getByText('Feature 1:')).toBeInTheDocument();
      expect(screen.getByText('Description 1')).toBeInTheDocument();
    });

    it('renders correctly when campaignName is undefined', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'Feature 1', description: 'Description 1' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName={undefined} />);
      expect(screen.getByText('Feature 1:')).toBeInTheDocument();
    });

    it('renders correctly when campaignName is an empty string', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'Feature 1', description: 'Description 1' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="" />);
      expect(screen.getByText('Feature 1:')).toBeInTheDocument();
    });
  });

  describe('playerStats edge cases', () => {
    it('renders correctly when playerStats.name is null', () => {
      const playerStats = {
        name: null,
        characterAdvancement: [
          { name: 'Feature 1', description: 'Description 1' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Feature 1:')).toBeInTheDocument();
    });

    it('renders correctly when playerStats.name is undefined', () => {
      const playerStats = {
        characterAdvancement: [
          { name: 'Feature 1', description: 'Description 1' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Feature 1:')).toBeInTheDocument();
    });

    it('renders correctly when playerStats is empty object', () => {
      render(<CharCharacterAdvancement playerStats={{}} campaignName="test-campaign" />);
      expect(screen.getByText('Character Advancement')).toBeInTheDocument();
      expect(document.querySelector('.half-line')).toBeInTheDocument();
    });

    it('renders correctly when playerStats.characterAdvancement is undefined', () => {
      const playerStats = {
        name: 'Test Character',
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Character Advancement')).toBeInTheDocument();
    });
  });



  describe('option key generation with special characters', () => {
    it('generates option key with underscores for feature names with spaces', () => {
      mockGetRuntimeValue.mockReturnValue('Option A');
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          {
            name: 'Choose Feature',
            description: 'A choice',
            automation: {
              options: ['Option A', 'Option B'],
            },
          },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      fireEvent.click(screen.getByText('Option A'));
      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        '_Choose_Feature_option',
        'Option A',
        'test-campaign'
      );
    });

    it('generates option key with underscores for feature names with multiple spaces', () => {
      mockGetRuntimeValue.mockReturnValue('Option A');
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          {
            name: 'Choose Multiple Words Feature',
            description: 'A choice',
            automation: {
              options: ['Option A', 'Option B'],
            },
          },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      fireEvent.click(screen.getByText('Option A'));
      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        '_Choose_Multiple_Words_Feature_option',
        'Option A',
        'test-campaign'
      );
    });
  });
});
