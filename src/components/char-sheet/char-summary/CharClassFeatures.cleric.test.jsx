// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// Cleric Features are reached through the CharClassFeatures registry entry
// point (class name 'Cleric' → ClericFeatures, region testid 'char-class-cleric').

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

// Mock with a resourceKey-scoped testid so assertions can verify a specific
// tracked resource's computed max, not just that "some" number rendered.
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

// Mirrors the shape classRules.getClericFeatures returns in the real service.
const defaultClericFeatures = { maxChannelDivinity: 2, destroyUndeadCR: 5 };

function mockClericFeatures(overrides = {}) {
  classFeatures.getClassFeatures.mockReturnValue({ ...defaultClericFeatures, ...overrides });
}

function clericClass(overrides = {}) {
  return { name: 'Cleric', major: {}, subclass: {}, class_levels: [], fightingStyles: [], ...overrides };
}

function clericStats(level, overrides = {}) {
  return {
    name: 'Test Cleric',
    level,
    rules: '5e',
    proficiency: 2,
    class: clericClass(),
    abilities: [
      { name: 'Strength', bonus: 1 },
      { name: 'Dexterity', bonus: 1 },
      { name: 'Constitution', bonus: 1 },
      { name: 'Intelligence', bonus: 1 },
      { name: 'Wisdom', bonus: 3 },
      { name: 'Charisma', bonus: 1 },
    ],
    automation: { passives: [], specialActions: [] },
    ...overrides,
  };
}

function renderCleric(playerStats) {
  render(<CharClassFeatures playerStats={playerStats} campaignName="test-campaign" />);
  return screen.getByTestId('char-class-cleric');
}

describe('ClericFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClericFeatures();
    runtimeState.useRuntimeValue.mockReturnValue([]);
  });

  describe('class features wiring', () => {
    it('reads class features for the exact playerStats object it was given', () => {
      const stats = clericStats(5);
      renderCleric(stats);
      expect(classFeatures.getClassFeatures).toHaveBeenCalledWith(stats);
    });
  });

  describe('channel divinity charges', () => {
    it.each([
      [2, 2],
      [3, 3],
      [0, 0],
    ])('renders %i charges from maxChannelDivinity', (_charges, expected) => {
      mockClericFeatures({ maxChannelDivinity: expected });
      renderCleric(clericStats(2));
      expect(screen.getByTestId('tracked-resource-channelDivinityCharges'))
        .toHaveTextContent(`Channel Divinity Charges: ${expected}/${expected}`);
    });

    it('falls back to 0 charges when maxChannelDivinity is missing', () => {
      mockClericFeatures({ maxChannelDivinity: undefined });
      renderCleric(clericStats(1));
      expect(screen.getByTestId('tracked-resource-channelDivinityCharges'))
        .toHaveTextContent('Channel Divinity Charges: 0/0');
    });
  });

  describe('destroy undead CR', () => {
    it.each([5, 0, 0.5])('renders the Challenge Rating %p straight from the service', (cr) => {
      mockClericFeatures({ destroyUndeadCR: cr });
      const section = renderCleric(clericStats(1));
      expect(section.textContent).toContain(`Destroy Undead Challenge Rating: ${cr}`);
    });

    it('omits the row when destroyUndeadCR is null', () => {
      mockClericFeatures({ destroyUndeadCR: null });
      const section = renderCleric(clericStats(1));
      expect(section.textContent).not.toContain('Destroy Undead');
    });
  });

  describe('preserve life pool', () => {
    it.each([
      ['major.name', { major: { name: 'Life Domain' } }, 1, 5],
      ['major.name', { major: { name: 'Life Domain' } }, 5, 25],
      ['subclass.name', { subclass: { name: 'Life Domain' } }, 10, 50],
    ])('renders 5 × level max (level %i) when Life Domain is detected via %s', (_via, classData, level, expectedMax) => {
      renderCleric(clericStats(level, { class: clericClass(classData) }));
      expect(screen.getByTestId('tracked-resource-preserveLifePool'))
        .toHaveTextContent(`Preserve Life Pool: ${expectedMax}/${expectedMax}`);
    });

    it.each([
      ['no subclass has been chosen', {}],
      ['a non-Life subclass is chosen', { subclass: { name: 'War Domain' } }],
    ])('omits the pool when %s', (_label, classData) => {
      const section = renderCleric(clericStats(5, { class: clericClass(classData) }));
      expect(screen.queryByTestId('tracked-resource-preserveLifePool')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Preserve Life');
    });
  });

  describe('warding flare uses', () => {
    it.each([
      [3, 3],
      [10, 10],
      [0, 1],
      [-2, 1],
    ])('with Wisdom modifier %i shows max %i uses (never below 1)', (wisBonus, expectedMax) => {
      const stats = clericStats(1, { abilities: [{ name: 'Wisdom', bonus: wisBonus }] });
      renderCleric(stats);
      expect(screen.getByTestId('tracked-resource-wardingflareUses'))
        .toHaveTextContent(`Warding Flare Uses: ${expectedMax}/${expectedMax}`);
    });

    it('shows 1 use when the Wisdom ability is missing entirely', () => {
      renderCleric(clericStats(1, { abilities: [] }));
      expect(screen.getByTestId('tracked-resource-wardingflareUses'))
        .toHaveTextContent('Warding Flare Uses: 1/1');
    });
  });
});
