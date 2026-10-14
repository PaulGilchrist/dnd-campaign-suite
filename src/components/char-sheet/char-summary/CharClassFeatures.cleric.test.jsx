// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// Cleric Features are reached through the CharClassFeatures registry entry
// point (class name 'Cleric' → ClericFeatures, region testid 'char-class-cleric').
// Row content for other classes and the registry dispatch itself are covered
// by CharClassFeatures.*.test.jsx siblings; this file owns the Cleric rows.

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

  it.each([
    [2, '2/2'],
    [0, '0/0'],
    [undefined, '0/0'],
  ])('renders Channel Divinity %s from the service and receives the exact playerStats (missing falls back to 0)', (max, expectedText) => {
    mockClericFeatures({ maxChannelDivinity: max });
    const stats = clericStats(2);
    renderCleric(stats);
    expect(classFeatures.getClassFeatures).toHaveBeenCalledWith(stats);
    expect(screen.getByTestId('tracked-resource-channelDivinityCharges'))
      .toHaveTextContent(`Channel Divinity Charges: ${expectedText}`);
  });

  it.each([
    [0, true],
    [0.5, true],
    [5, true],
    [null, false],
  ])('renders the Destroy Undead row for CR %p, and omits it entirely when the rating is null (row shown: %s)', (cr, shown) => {
    mockClericFeatures({ destroyUndeadCR: cr });
    const section = renderCleric(clericStats(1));
    if (shown) {
      expect(section.textContent).toContain(`Destroy Undead Challenge Rating: ${cr}`);
    } else {
      expect(section.textContent).not.toContain('Destroy Undead');
    }
  });

  it.each([
    ['major', { major: { name: 'Life Domain' } }, 5, '25/25'],
    ['subclass', { subclass: { name: 'Life Domain' } }, 1, '5/5'],
    ['no subclass chosen', {}, 5, null],
    ['a non-Life subclass', { subclass: { name: 'War Domain' } }, 5, null],
  ])('renders the Preserve Life pool at 5 × level (via %s) only for Life Domain', (_via, classData, level, expectedText) => {
    const section = renderCleric(clericStats(level, { class: clericClass(classData) }));
    const pool = screen.queryByTestId('tracked-resource-preserveLifePool');
    if (expectedText) {
      expect(pool).toHaveTextContent(`Preserve Life Pool: ${expectedText}`);
    } else {
      expect(pool).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Preserve Life');
    }
  });

  it.each([
    [3, '3/3'],
    [0, '1/1'],
    [-2, '1/1'],
    [undefined, '1/1'],
  ])('caps Warding Flare uses at max(1, Wisdom modifier %s)', (wisBonus, expectedText) => {
    const abilities = wisBonus === undefined ? [] : [{ name: 'Wisdom', bonus: wisBonus }];
    renderCleric(clericStats(1, { abilities }));
    expect(screen.getByTestId('tracked-resource-wardingflareUses'))
      .toHaveTextContent(`Warding Flare Uses: ${expectedText}`);
  });
});
