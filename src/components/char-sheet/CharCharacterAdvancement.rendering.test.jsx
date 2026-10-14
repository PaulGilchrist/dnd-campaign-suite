import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

const { mockGetRuntimeValue, mockSetRuntimeValue } = vi.hoisted(() => ({
  mockGetRuntimeValue: vi.fn(),
  mockSetRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: mockGetRuntimeValue,
  setRuntimeValue: mockSetRuntimeValue,
}));

describe('CharCharacterAdvancement - Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeValue.mockReturnValue(null);
  });

  afterEach(cleanup);

  describe('null/missing data handling', () => {
    it.each([
      { value: [], label: 'empty array' },
      { value: undefined, label: 'undefined' },
      { value: null, label: 'null' },
    ])('renders the section header when characterAdvancement is %s', ({ label }) => {
      const playerStats = label === 'null' ? { name: 'Test Character' } : {
        name: 'Test Character',
        characterAdvancement: [],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Character Advancement')).toBeInTheDocument();
    });

    it('renders features when playerStats has no name property', () => {
      const playerStats = {
        characterAdvancement: [
          { name: 'Feature', description: 'Desc' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Character Advancement')).toBeInTheDocument();
      expect(screen.getByText('Feature:')).toBeInTheDocument();
    });
  });

  describe('feature rendering', () => {
    it('renders feature name and description for each feature', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'Darkvision', description: 'See in darkness' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Darkvision:')).toBeInTheDocument();
      expect(screen.getByText('See in darkness')).toBeInTheDocument();
    });

    it('renders multiple features in order', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'First', description: '1' },
          { name: 'Second', description: '2' },
          { name: 'Third', description: '3' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('First:')).toBeInTheDocument();
      expect(screen.getByText('Second:')).toBeInTheDocument();
      expect(screen.getByText('Third:')).toBeInTheDocument();
    });
  });

  describe('count suffix for duplicates', () => {
    it('appends " * N" count suffix when the same feature name appears multiple times', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'Mystic Arcanum', description: '9th level' },
          { name: 'Mystic Arcanum', description: '9th level' },
          { name: 'Mystic Arcanum', description: '9th level' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Mystic Arcanum * 3:')).toBeInTheDocument();
    });

    it('groups by feature name only, ignoring description differences', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'Feature A', description: 'First' },
          { name: 'Feature B', description: 'Second' },
          { name: 'Feature A', description: 'First again' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Feature A * 2:')).toBeInTheDocument();
      expect(screen.getByText('Feature B:')).toBeInTheDocument();
    });

    it('uses the first feature\'s data when duplicates are grouped', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'Dup Feature', description: 'First description' },
          { name: 'Dup Feature', description: 'Second description' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Dup Feature * 2:')).toBeInTheDocument();
      expect(screen.getByText('First description')).toBeInTheDocument();
      expect(screen.queryByText('Second description')).not.toBeInTheDocument();
    });
  });

  describe('filtering with featuresToIgnore', () => {
    it('filters out 5e featuresToIgnore entries like Spellcasting and Extra Attack', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'Spellcasting', description: 'Casts spells' },
          { name: 'Extra Attack', description: 'Attacks twice' },
          { name: 'Valid Feature', description: 'Should appear' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Valid Feature:')).toBeInTheDocument();
      expect(screen.queryByText('Spellcasting:')).not.toBeInTheDocument();
      expect(screen.queryByText('Extra Attack:')).not.toBeInTheDocument();
    });

    it('filters out 2024-specific featuresToIgnore when ruleset is 2024', () => {
      const playerStats = {
        name: 'Test Character',
        rules: '2024',
        characterAdvancement: [
          { name: 'Fighter Subclass', description: 'Subclass' },
          { name: 'Barbarian Subclass', description: 'Subclass' },
          { name: 'Feat', description: 'A feat' },
          { name: 'Darkvision', description: 'See in darkness' },
          { name: 'Valid Feature', description: 'Should appear' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Valid Feature:')).toBeInTheDocument();
      expect(screen.queryByText('Fighter Subclass:')).not.toBeInTheDocument();
      expect(screen.queryByText('Barbarian Subclass:')).not.toBeInTheDocument();
      expect(screen.queryByText('Feat:')).not.toBeInTheDocument();
      expect(screen.queryByText('Darkvision:')).not.toBeInTheDocument();
    });

    it.each([null, undefined])('defaults to 5e filtering when playerStats.rules is %s', (rulesValue) => {
      const playerStats = {
        name: 'Test Character',
        rules: rulesValue,
        characterAdvancement: [
          { name: 'Spellcasting', description: 'Casts spells' },
          { name: 'Valid Feature', description: 'Should appear' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Valid Feature:')).toBeInTheDocument();
      expect(screen.queryByText('Spellcasting:')).not.toBeInTheDocument();
    });
  });

  describe('edge cases for feature data', () => {
    it('renders a feature with an empty name', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: '', description: 'Empty name feature' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText(':')).toBeInTheDocument();
      expect(screen.getByText('Empty name feature')).toBeInTheDocument();
    });

    it('renders a feature with an empty string description', () => {
      const playerStats = {
        name: 'Test Character',
        characterAdvancement: [
          { name: 'Feature', description: '' },
        ],
      };
      render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
      expect(screen.getByText('Feature:')).toBeInTheDocument();
    });
  });
});
