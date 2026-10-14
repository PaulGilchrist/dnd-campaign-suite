// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as unbreakableMajesty from '../../../services/combat/auras/unbreakableMajesty.js';

// Bard Features are reached through the CharClassFeatures registry entry
// point (class name 'Bard' → BardFeatures).

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
  getClassFeatures: vi.fn(),
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

// Mirrors the shape classRules.getBardFeatures returns in the real service.
const defaultBardFeatures = {
  bardicDie: 6,
  songOfRestDie: null,
  magicalSecrets: null,
  subclassMagicalSecrets: 0,
};

function mockBardFeatures(overrides = {}) {
  classFeatures.getClassFeatures.mockReturnValue({ ...defaultBardFeatures, ...overrides });
}

function mockRuntime({ buffs = undefined } = {}) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'activeBuffs') return buffs;
    return undefined;
  });
}

function bardStats(level, overrides = {}) {
  return {
    name: 'Test Bard',
    level,
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

function renderBard(playerStats) {
  render(<CharClassFeatures playerStats={playerStats} campaignName="test-campaign" />);
  return screen.getByTestId('char-class-bard');
}

describe('BardFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBardFeatures();
    mockRuntime({ buffs: [] });
    unbreakableMajesty.isUnbreakableMajestyActive.mockReturnValue(false);
    unbreakableMajesty.getUnbreakableMajestySaveDc.mockReturnValue(0);
  });

  describe('bardic inspiration die', () => {
    it.each([
      [1, 6],
      [5, 8],
      [10, 10],
      [15, 12],
    ])('at level %i renders the die from bardicDie (d%i)', (level, bardicDie) => {
      mockBardFeatures({ bardicDie });
      const section = renderBard(bardStats(level));
      expect(section.textContent).toContain(`Bardic Inspiration Die: d${bardicDie}`);
    });

    it('renders d0 when the class rules provide no die', () => {
      mockBardFeatures({ bardicDie: 0 });
      const section = renderBard(bardStats(1));
      expect(section.textContent).toContain('Bardic Inspiration Die: d0');
    });
  });

  describe('bardic inspiration uses', () => {
    it('tracks uses with max from the Charisma modifier', () => {
      renderBard(bardStats(1));
      expect(screen.getByTestId('tracked-resource-bardicInspirationUses'))
        .toHaveTextContent('Bardic Inspiration Uses: 3/3');
    });

    it.each([
      ['Charisma modifier is 0', [{ name: 'Charisma', bonus: 0 }]],
      ['Charisma ability is missing', []],
    ])('shows 0 uses when %s', (_label, abilities) => {
      renderBard(bardStats(1, { abilities }));
      expect(screen.getByTestId('tracked-resource-bardicInspirationUses'))
        .toHaveTextContent('Bardic Inspiration Uses: 0/0');
    });
  });

  describe('expertise', () => {
    it('lists joined expertise just above the level threshold (level 3)', () => {
      const section = renderBard(bardStats(3, { expertise: ['Athletics', 'Stealth', 'Persuasion'] }));
      expect(section.textContent).toContain('Expertise: Athletics, Stealth, Persuasion');
    });

    it.each([
      ['level is exactly 2', 2, ['Athletics']],
      ['expertise is undefined', 5, undefined],
      ['expertise is an empty array', 5, []],
    ])('omits expertise when %s', (_label, level, expertise) => {
      const section = renderBard(bardStats(level, { expertise }));
      expect(section.textContent).not.toContain('Expertise');
    });
  });

  describe('extra attacks via magical secrets', () => {
    it('renders when level > 5 and the bard has magical secrets', () => {
      mockBardFeatures({ magicalSecrets: 3 });
      const section = renderBard(bardStats(6));
      expect(section.textContent).toContain('Extra Attacks: 1');
    });

    it.each([
      ['level is exactly 5', 5, 3],
      ['magical secrets are not yet known (null)', 10, null],
      ['magical secrets key is absent (undefined)', 10, undefined],
    ])('omits extra attacks when %s', (_label, level, magicalSecrets) => {
      mockBardFeatures({ magicalSecrets });
      const section = renderBard(bardStats(level));
      expect(section.textContent).not.toContain('Extra Attacks');
    });
  });

  describe('magical secrets tracked resource', () => {
    it.each([
      ['class secrets only', 3, 0, 3],
      ['class and subclass secrets', 3, 2, 5],
      ['level 14 cap', 5, 0, 5],
    ])('sums max from magicalSecrets + subclassMagicalSecrets (%s)', (_label, secrets, subclass, expectedMax) => {
      mockBardFeatures({ magicalSecrets: secrets, subclassMagicalSecrets: subclass });
      renderBard(bardStats(14));
      expect(screen.getByTestId('tracked-resource-magicalSecrets'))
        .toHaveTextContent(`Magical Secrets: ${expectedMax}/${expectedMax}`);
    });

    it('omits the tracked resource when magicalSecrets is null', () => {
      mockBardFeatures({ magicalSecrets: null });
      renderBard(bardStats(1));
      expect(screen.queryByTestId('tracked-resource-magicalSecrets')).not.toBeInTheDocument();
    });
  });

  describe('beguiling magic', () => {
    it('renders a single-use tracked resource for a passive_rule with riderSave', () => {
      renderBard(bardStats(6, {
        automation: { passives: [{ type: 'passive_rule', riderSave: true }] },
      }));
      expect(screen.getByTestId('tracked-resource-postCastRider_Beguiling_Magic'))
        .toHaveTextContent('Beguiling Magic: 1/1');
    });

    it.each([
      ['passives is empty', []],
      ['passives is undefined', undefined],
      ['passive_rule lacks riderSave', [{ type: 'passive_rule' }]],
      ['riderSave is on a non-passive_rule entry', [{ type: 'active_rule', riderSave: true }]],
    ])('omits the tracked resource when %s', (_label, passives) => {
      renderBard(bardStats(6, { automation: { passives } }));
      expect(screen.queryByTestId('tracked-resource-postCastRider_Beguiling_Magic')).not.toBeInTheDocument();
    });
  });

  describe('song of rest die', () => {
    it.each([
      [5, 6],
      [9, 8],
      [13, 10],
      [17, 12],
    ])('at level %i renders the die from songOfRestDie (d%i)', (level, die) => {
      mockBardFeatures({ songOfRestDie: die });
      const section = renderBard(bardStats(level));
      expect(section.textContent).toContain(`Song of Rest Die: d${die}`);
    });

    it('omits song of rest when songOfRestDie is null', () => {
      mockBardFeatures({ songOfRestDie: null });
      const section = renderBard(bardStats(1));
      expect(section.textContent).not.toContain('Song of Rest');
    });
  });

  describe('unbreakable majesty', () => {
    it('renders an active majesty badge with the reported save DC', () => {
      unbreakableMajesty.isUnbreakableMajestyActive.mockReturnValue(true);
      unbreakableMajesty.getUnbreakableMajestySaveDc.mockReturnValue(15);
      const section = renderBard(bardStats(18));
      const button = screen.getByRole('button', { name: /Unbreakable Majesty DC 15/ });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('majesty-badge--active');
      expect(section.contains(button)).toBe(true);
    });

    it('clears the aura when the active badge is clicked', () => {
      unbreakableMajesty.isUnbreakableMajestyActive.mockReturnValue(true);
      unbreakableMajesty.getUnbreakableMajestySaveDc.mockReturnValue(15);
      renderBard(bardStats(18));
      fireEvent.click(screen.getByRole('button', { name: /Unbreakable Majesty/ }));
      expect(unbreakableMajesty.clearUnbreakableMajesty).toHaveBeenCalledWith('Test Bard', 'test-campaign');
    });

    it('does not render the badge and queries the aura for this player and campaign when inactive', () => {
      const section = renderBard(bardStats(18));
      expect(screen.queryByRole('button', { name: /Unbreakable Majesty/ })).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Unbreakable Majesty');
      expect(unbreakableMajesty.isUnbreakableMajestyActive).toHaveBeenCalledWith('Test Bard', 'test-campaign');
    });
  });

  describe('multi-minute buff badges', () => {
    it('renders automation badges for multi-minute durations and filters the rest', () => {
      mockRuntime({ buffs: [
        { name: 'Buff A', duration: '1_minute' },
        { name: 'Buff B', duration: 'hour' },
        { name: 'Buff C', duration: '1_round' },
      ] });
      const section = renderBard(bardStats(1));
      const badges = [...section.querySelectorAll('.automation-badge')].map(el => el.textContent);
      expect(badges).toContain('Buff A');
      expect(badges).toContain('Buff B');
      expect(badges).not.toContain('Buff C');
    });

    it('renders no badges when activeBuffs is empty', () => {
      mockRuntime({ buffs: [] });
      const section = renderBard(bardStats(1));
      expect(section.querySelectorAll('.automation-badge')).toHaveLength(0);
    });

    it('survives a non-array activeBuffs value without rendering badges', () => {
      mockRuntime({ buffs: undefined });
      const section = renderBard(bardStats(1));
      expect(section.querySelectorAll('.automation-badge')).toHaveLength(0);
    });
  });
});
