// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import ClericFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';

// Helper to verify a resource section displays the expected label and max value.
// The real TrackedResourceInput splits text across elements (label, current span, "/", max),
// so we query the parent div and check its normalized text content.
function expectResourceToDisplay(label, maxValue) {
  const labelEl = screen.getByText(new RegExp(`^${label}:$`));
  const sectionDiv = labelEl.closest('div.clickable');
  expect(sectionDiv).toBeTruthy();
  expect(sectionDiv.textContent).toContain(maxValue);
}

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
  default: vi.fn(({ maxGetter }) => ({
    current: maxGetter ? maxGetter() : 0,
    max: maxGetter ? maxGetter() : 0,
    update: vi.fn(),
  })),
}));

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({
    maxChannelDivinity: 2,
    destroyUndeadCR: 5,
  })),
}));

function buildPlayerStats(overrides = {}) {
  return {
    name: 'Test Cleric',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Cleric',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [
      { name: 'Wisdom', bonus: 3 },
      { name: 'Charisma', bonus: 1 },
    ],
    automation: {},
    ...overrides,
  };
}

describe('ClericFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
      maxChannelDivinity: 2,
      destroyUndeadCR: 5,
    });
  });

  describe('channel divinity charges', () => {
    it('renders with label and max value from class features', () => {
      const stats = buildPlayerStats({ level: 5 });
      render(<ClericFeatures playerStats={stats} campaignName="test" />);
      expectResourceToDisplay('Channel Divinity Charges', '2');
    });
  });

  describe('destroy undead CR', () => {
    it('renders label and value when destroyUndeadCR is a non-null number', () => {
      const stats = buildPlayerStats();
      render(<ClericFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Destroy Undead Challenge Rating:/)).toBeInTheDocument();
      expect(screen.getByText(/5/)).toBeInTheDocument();
    });

    it('renders when destroyUndeadCR is 0', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        maxChannelDivinity: 2,
        destroyUndeadCR: 0,
      });
      const stats = buildPlayerStats();
      render(<ClericFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Destroy Undead Challenge Rating:/)).toBeInTheDocument();
      expect(screen.getByText(/0/)).toBeInTheDocument();
    });

    it('does not render when destroyUndeadCR is null', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        maxChannelDivinity: 2,
        destroyUndeadCR: null,
      });
      const stats = buildPlayerStats();
      render(<ClericFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Destroy Undead/)).not.toBeInTheDocument();
    });
  });

  describe('preserve life pool', () => {
    it('renders for Life Domain via major name', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Cleric',
          major: { name: 'Life Domain' },
          subclass: {},
          class_levels: [],
          fightingStyles: [],
        },
      });
      render(<ClericFeatures playerStats={stats} campaignName="test" />);
      expectResourceToDisplay('Preserve Life Pool', '25');
    });

    it('calculates max as 5 * level for Life Domain', () => {
      const stats = buildPlayerStats({
        level: 10,
        class: {
          name: 'Cleric',
          major: { name: 'Life Domain' },
          subclass: { name: 'Life Domain' },
          class_levels: [],
          fightingStyles: [],
        },
      });
      render(<ClericFeatures playerStats={stats} campaignName="test" />);
      expectResourceToDisplay('Preserve Life Pool', '50');
    });

    it('does not render for non-Life Domain subclass', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Cleric',
          major: {},
          subclass: { name: 'War Domain' },
          class_levels: [],
          fightingStyles: [],
        },
      });
      render(<ClericFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Preserve Life Pool/)).not.toBeInTheDocument();
    });
  });

  describe('warding flare uses', () => {
    it('renders with label', () => {
      const stats = buildPlayerStats();
      render(<ClericFeatures playerStats={stats} campaignName="test" />);
      expectResourceToDisplay('Warding Flare Uses', '3');
    });

    it('uses Math.max(1, wisMod) for max with various wisdom modifiers', () => {
      const cases = [
        { wisBonus: 3, expectedMax: '3' },
        { wisBonus: -2, expectedMax: '1' },
        { wisBonus: 0, expectedMax: '1' },
        { wisBonus: 10, expectedMax: '10' },
      ];
      for (const { wisBonus, expectedMax } of cases) {
        const stats = buildPlayerStats({
          abilities: [{ name: 'Wisdom', bonus: wisBonus }],
        });
        render(<ClericFeatures playerStats={stats} campaignName="test" />);
        expectResourceToDisplay('Warding Flare Uses', expectedMax);
        cleanup();
      }
    });
  });
});
