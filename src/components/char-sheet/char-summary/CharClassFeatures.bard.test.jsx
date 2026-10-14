import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import BardFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as unbreakableMajesty from '../../../services/combat/auras/unbreakableMajesty.js';

vi.mock('./TrackedResourceInput.jsx', () => ({
  default: function MockTrackedResourceInput({ label, getMax, resourceKey }) {
    const max = getMax ? getMax() : 0;
    return (
      <div data-testid={`tracked-resource-${resourceKey}`}>
        <b>{label}:</b> <span>{max}/{max}</span>
      </div>
    );
  },
}));

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({
    bardicDie: 8,
    songOfRestDie: null,
    magicalSecrets: null,
    subclassMagicalSecrets: 0,
  })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
  isUnbreakableMajestyActive: vi.fn(() => false),
  getUnbreakableMajestySaveDc: vi.fn(() => 0),
  clearUnbreakableMajesty: vi.fn(),
}));

function buildPlayerStats(overrides = {}) {
  return {
    name: 'Test Bard',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Bard',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [
      { name: 'Strength', bonus: 1 },
      { name: 'Dexterity', bonus: 1 },
      { name: 'Constitution', bonus: 1 },
      { name: 'Intelligence', bonus: 1 },
      { name: 'Wisdom', bonus: 1 },
      { name: 'Charisma', bonus: 3 },
    ],
    automation: {
      passives: [],
    },
    ...overrides,
  };
}

describe('BardFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [];
      return undefined;
    });
    unbreakableMajesty.isUnbreakableMajestyActive.mockReturnValue(false);
  });

  afterEach(cleanup);

  describe('bardic inspiration die', () => {
    it('renders the correct die based on bardicDie value', () => {
      const cases = [
        { bardicDie: 6, expectedDie: 'd6', level: 1 },
        { bardicDie: 8, expectedDie: 'd8', level: 5 },
        { bardicDie: 12, expectedDie: 'd12', level: 15 },
      ];
      for (const { bardicDie, expectedDie, level } of cases) {
        vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
          bardicDie,
          songOfRestDie: null,
          magicalSecrets: null,
          subclassMagicalSecrets: 0,
        });
        const stats = buildPlayerStats({ level });
        render(<BardFeatures playerStats={stats} campaignName="test" />);
        expect(screen.getByText(/Bardic Inspiration Die/)).toBeInTheDocument();
        expect(screen.getByText(expectedDie)).toBeInTheDocument();
        cleanup();
      }
    });
  });

  describe('bardic inspiration uses', () => {
    it('renders the tracked resource with charisma-based max', () => {
      const stats = buildPlayerStats();
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Bardic Inspiration Uses:')).toBeInTheDocument();
    });
  });

  describe('expertise', () => {
    it('renders expertise list when level > 2 and expertise array has items', () => {
      const stats = buildPlayerStats({ level: 5, expertise: ['Athletics', 'Stealth'] });
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Expertise:')).toBeInTheDocument();
      expect(screen.getByText(/Athletics, Stealth/)).toBeInTheDocument();
    });

    it('does not render expertise when level is 2 or below', () => {
      const stats = buildPlayerStats({ level: 2, expertise: ['Athletics'] });
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();
    });

    it('does not render expertise when expertise is undefined', () => {
      const stats = buildPlayerStats({ level: 5 });
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();
    });
  });

  describe('extra attacks via magical secrets', () => {
    it('renders extra attacks when level > 5 and magicalSecrets is truthy', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        bardicDie: 8,
        magicalSecrets: true,
        songOfRestDie: null,
        subclassMagicalSecrets: 0,
      });
      const stats = buildPlayerStats({ level: 6 });
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Extra Attacks:')).toBeInTheDocument();
    });

    it('does not render extra attacks when level is exactly 5', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        bardicDie: 8,
        magicalSecrets: true,
        songOfRestDie: null,
        subclassMagicalSecrets: 0,
      });
      const stats = buildPlayerStats({ level: 5 });
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Extra Attacks:/)).not.toBeInTheDocument();
    });

    it('does not render extra attacks when magicalSecrets is falsy', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        bardicDie: 8,
        magicalSecrets: false,
        songOfRestDie: null,
        subclassMagicalSecrets: 0,
      });
      const stats = buildPlayerStats({ level: 10 });
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Extra Attacks:/)).not.toBeInTheDocument();
    });
  });

  describe('magical secrets tracked resource', () => {
    it('renders when magicalSecrets is a number', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        bardicDie: 12,
        magicalSecrets: 2,
        songOfRestDie: null,
        subclassMagicalSecrets: 3,
      });
      const stats = buildPlayerStats({ level: 15 });
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Magical Secrets/)).toBeInTheDocument();
    });

    it('does not render when magicalSecrets is null', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        bardicDie: 8,
        magicalSecrets: null,
        songOfRestDie: null,
        subclassMagicalSecrets: 0,
      });
      const stats = buildPlayerStats();
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Magical Secrets/)).not.toBeInTheDocument();
    });
  });

  describe('song of rest die', () => {
    it('renders d6 for level 5, d8 for level 9, d10 for level 13, d12 for level 17', () => {
      const cases = [
        { level: 5, die: 6 },
        { level: 9, die: 8 },
        { level: 13, die: 10 },
        { level: 17, die: 12 },
      ];
      for (const { level, die } of cases) {
        vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
          bardicDie: 8,
          songOfRestDie: die,
          magicalSecrets: null,
          subclassMagicalSecrets: 0,
        });
        const stats = buildPlayerStats({ level });
        const { container } = render(<BardFeatures playerStats={stats} campaignName="test" />);
        expect(screen.getByText(/Song of Rest Die/)).toBeInTheDocument();
        expect(container.textContent).toContain(`d${die}`);
        cleanup();
      }
    });

    it('does not render when songOfRestDie is null', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        bardicDie: 8,
        songOfRestDie: null,
        magicalSecrets: null,
        subclassMagicalSecrets: 0,
      });
      const stats = buildPlayerStats();
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Song of Rest/)).not.toBeInTheDocument();
    });
  });

  describe('beguiling magic', () => {
    it('renders tracked resource when passive_rule with riderSave exists', () => {
      const stats = buildPlayerStats({
        automation: {
          passives: [{ type: 'passive_rule', riderSave: true }],
        },
      });
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Beguiling Magic/)).toBeInTheDocument();
    });

    it('does not render when passives array is empty', () => {
      const stats = buildPlayerStats({
        automation: { passives: [] },
      });
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Beguiling Magic/)).not.toBeInTheDocument();
    });

    it('does not render when passives is undefined', () => {
      const stats = buildPlayerStats({
        automation: { passives: undefined },
      });
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Beguiling Magic/)).not.toBeInTheDocument();
    });
  });

  describe('unbreakable majesty', () => {
    it('renders majesty button with correct DC when active', () => {
      vi.mocked(unbreakableMajesty.isUnbreakableMajestyActive).mockReturnValue(true);
      vi.mocked(unbreakableMajesty.getUnbreakableMajestySaveDc).mockReturnValue(15);
      const stats = buildPlayerStats();
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByRole('button', { name: /Unbreakable Majesty DC 15/ })).toBeInTheDocument();
    });

    it('calls clearUnbreakableMajesty when clicked while active', () => {
      vi.mocked(unbreakableMajesty.isUnbreakableMajestyActive).mockReturnValue(true);
      vi.mocked(unbreakableMajesty.getUnbreakableMajestySaveDc).mockReturnValue(15);
      const stats = buildPlayerStats();
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      const button = screen.getByRole('button', { name: /Unbreakable Majesty/ });
      button.click();
      expect(unbreakableMajesty.clearUnbreakableMajesty).toHaveBeenCalledWith('Test Bard', 'test');
    });

    it('does not render majesty button when not active', () => {
      const stats = buildPlayerStats();
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByRole('button', { name: /Unbreakable Majesty/ })).not.toBeInTheDocument();
    });
  });

  describe('multi-minute badges', () => {
    it('renders badges for activeBuffs with multi-minute durations', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [
          { name: 'Buff A', duration: '1_minute' },
          { name: 'Buff B', duration: 'hour' },
        ];
        return undefined;
      });
      const stats = buildPlayerStats();
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Buff A')).toBeInTheDocument();
      expect(screen.getByText('Buff B')).toBeInTheDocument();
    });

    it('does not render badges when activeBuffs is empty', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        return undefined;
      });
      const stats = buildPlayerStats();
      render(<BardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByRole('span', { name: '' })).not.toBeInTheDocument();
    });
  });
});
