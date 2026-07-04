// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    it('uses 5e ruleset when rules field is undefined or null', () => {
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
});
