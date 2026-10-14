import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// TrackedResourceInput mock that renders label text so tests can assert
// on visible content instead of data-testid implementation details.
vi.mock('./TrackedResourceInput.jsx', () => {
  return {
    default: function MockTrackedResourceInput({ label, getMax }) {
      const max = getMax ? getMax() : 0;
      return React.createElement('div', null, `${label}: ${max}`);
    },
  };
});

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({
    invocationsKnown: 4,
    hasArcanum: false,
    arcanumLevels: {},
    pactBoon: 'Pact of the Blade',
    invocations: ['Agonizing Blast', 'Eldritch Sight'],
  })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

const defaultWarlockFeatures = {
  invocationsKnown: 4,
  hasArcanum: false,
  arcanumLevels: {},
  pactBoon: 'Pact of the Blade',
  invocations: ['Agonizing Blast', 'Eldritch Sight'],
};

const basePlayerStats = {
  name: 'TestWarlock',
  level: 5,
  abilities: [{ name: 'Charisma', bonus: 3 }],
  proficiency: 3,
  class: {
    name: 'Warlock',
    major: {},
    subclass: {},
    class_levels: [],
    fightingStyles: [],
  },
  automation: { bonusActions: [] },
};

function buildPlayerStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function renderComponent(playerStats, campaign = 'test') {
  return render(<CharClassFeatures playerStats={playerStats} campaignName={campaign} />);
}

describe('WarlockFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(classFeatures.getClassFeatures).mockReturnValue({ ...defaultWarlockFeatures });
    runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [];
      return undefined;
    });
  });

  describe('invocations display', () => {
    it('renders "Eldritch Invocations" label when invocationsKnown > 0', () => {
      const stats = buildPlayerStats({ level: 5 });
      renderComponent(stats);
      expect(screen.getByText(/Eldritch Invocations:/)).toBeInTheDocument();
    });

    it.each([0, null, undefined])(
      'renders "Invocations Known" label when invocationsKnown is %s',
      (value) => {
        vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
          ...defaultWarlockFeatures,
          invocationsKnown: value,
        });
        renderComponent(buildPlayerStats());
        expect(screen.getByText(/Invocations Known:/)).toBeInTheDocument();
      },
    );

    it('renders invocations list sorted alphabetically', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        ...defaultWarlockFeatures,
        invocations: ['Zephyr Invocation', 'Agonizing Blast', 'Mighty Invocation'],
      });
      const stats = buildPlayerStats();
      renderComponent(stats);
      expect(
        screen.getByText(/Agonizing Blast, Mighty Invocation, Zephyr Invocation/),
      ).toBeInTheDocument();
    });

    it.each([null, undefined])(
      'does not render invocations list when invocations is %s',
      (value) => {
        vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
          ...defaultWarlockFeatures,
          invocations: value,
        });
        renderComponent(buildPlayerStats());
        expect(screen.queryByText('Agonizing Blast')).not.toBeInTheDocument();
      },
    );

    it('renders invocations count matching invocationsKnown value', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        ...defaultWarlockFeatures,
        invocationsKnown: 7,
        invocations: ['Inv1', 'Inv2', 'Inv3', 'Inv4', 'Inv5', 'Inv6', 'Inv7'],
      });
      const stats = buildPlayerStats();
      const { container } = renderComponent(stats);
      expect(container.textContent).toContain('Eldritch Invocations');
      expect(container.textContent).toContain('7');
    });
  });

  describe('pact boon', () => {
    it('renders pact boon text and button when pactBoon is present', () => {
      const stats = buildPlayerStats();
      renderComponent(stats);
      expect(screen.getByText('Pact Boon:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pact of the Blade/ })).toBeInTheDocument();
    });

    it.each([null, undefined])(
      'does not render pact boon when pactBoon is %s',
      (value) => {
        vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
          ...defaultWarlockFeatures,
          pactBoon: value,
        });
        renderComponent(buildPlayerStats());
        expect(screen.queryByText('Pact Boon')).not.toBeInTheDocument();
      },
    );

    it('renders pact boon button with correct title attribute', () => {
      const stats = buildPlayerStats();
      renderComponent(stats);
      const button = screen.getByRole('button', { name: /Pact of the Blade/ });
      expect(button).toHaveAttribute('title', 'Pact Boon: Pact of the Blade');
    });

  });

  describe('arcanum', () => {
    it('renders arcanum tracked resources for levels with count > 0', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        ...defaultWarlockFeatures,
        hasArcanum: true,
        arcanumLevels: { level6: 1, level7: 1, level8: 0, level9: 1 },
      });
      const stats = buildPlayerStats({ level: 13 });
      renderComponent(stats);
      expect(screen.getByText(/6th Level Arcanum:/)).toBeInTheDocument();
      expect(screen.getByText(/7th Level Arcanum:/)).toBeInTheDocument();
      expect(screen.getByText(/9th Level Arcanum:/)).toBeInTheDocument();
      expect(screen.queryByText(/8th Level Arcanum:/)).not.toBeInTheDocument();
    });

    it('does not render arcanum when hasArcanum is false', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        ...defaultWarlockFeatures,
        hasArcanum: false,
        arcanumLevels: { level6: 0, level7: 0, level8: 0, level9: 0 },
      });
      const stats = buildPlayerStats({ level: 13 });
      renderComponent(stats);
      expect(screen.queryByText(/Arcanum/)).not.toBeInTheDocument();
    });

    it('does not render arcanum tracked resources when hasArcanum is true but all counts are 0', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        ...defaultWarlockFeatures,
        hasArcanum: true,
        arcanumLevels: { level6: 0, level7: 0, level8: 0, level9: 0 },
      });
      const stats = buildPlayerStats({ level: 13 });
      renderComponent(stats);
      expect(screen.queryByText(/Arcanum/)).not.toBeInTheDocument();
    });
  });

  describe('celestial patron', () => {
    function celestialStats(overrides = {}) {
      return buildPlayerStats({
        level: 5,
        class: {
          name: 'Warlock',
          major: { name: 'Celestial Patron' },
          subclass: { name: 'Celestial Patron' },
          class_levels: [],
          fightingStyles: [],
        },
        ...overrides,
      });
    }

    it('renders healing light tracked resource when major is Celestial Patron', () => {
      const stats = celestialStats();
      renderComponent(stats);
      expect(screen.getByText(/Healing Light:/)).toBeInTheDocument();
    });

    it('renders healing light tracked resource when subclass is Celestial Patron', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Warlock',
          major: {},
          subclass: { name: 'Celestial Patron' },
          class_levels: [],
          fightingStyles: [],
        },
      });
      renderComponent(stats);
      expect(screen.getByText(/Healing Light:/)).toBeInTheDocument();
    });

    it('does not render healing light for non-celestial patron', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Warlock',
          major: { name: 'Fiend' },
          subclass: { name: 'Fiend' },
          class_levels: [],
          fightingStyles: [],
        },
      });
      renderComponent(stats);
      expect(screen.queryByText(/Healing Light/)).not.toBeInTheDocument();
    });

    it('renders healing light max as 1 + level', () => {
      const stats = celestialStats({ level: 10 });
      renderComponent(stats);
      expect(screen.getByText(/Healing Light: 11/)).toBeInTheDocument();
    });
  });

  describe('fiend patron', () => {
    function fiendStats(overrides = {}) {
      return buildPlayerStats({
        level: 5,
        class: {
          name: 'Warlock',
          major: { name: 'Fiend' },
          subclass: {},
          class_levels: [],
          fightingStyles: [],
        },
        ...overrides,
      });
    }

    it('renders dark one\'s own luck when major is Fiend', () => {
      const stats = fiendStats();
      renderComponent(stats);
      expect(screen.getByText(/Dark One's Own Luck:/)).toBeInTheDocument();
    });

    it('renders dark one\'s own luck when subclass is Fiend Patron', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Warlock',
          major: {},
          subclass: { name: 'Fiend Patron' },
          class_levels: [],
          fightingStyles: [],
        },
      });
      renderComponent(stats);
      expect(screen.getByText(/Dark One's Own Luck:/)).toBeInTheDocument();
    });

    it('does not render dark one\'s own luck for non-fiend patron', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Warlock',
          major: { name: 'Celestial Patron' },
          subclass: {},
          class_levels: [],
          fightingStyles: [],
        },
      });
      renderComponent(stats);
      expect(screen.queryByText(/Dark One's Own Luck/)).not.toBeInTheDocument();
    });

    it('renders dark one\'s own luck max as max(1, chaMod)', () => {
      const stats = fiendStats();
      renderComponent(stats);
      expect(screen.getByText(/Dark One's Own Luck: 3/)).toBeInTheDocument();
    });
  });

  describe('great old one patron', () => {
    function goeStats(overrides = {}) {
      return buildPlayerStats({
        class: {
          name: 'Warlock',
          major: { name: 'Great Old One Patron' },
          subclass: { name: 'Great Old One Patron' },
          class_levels: [],
          fightingStyles: [],
        },
        ...overrides,
      });
    }

    it('shows awakened mind badge when patron matches and target is set', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'awakenedMindTarget') return 'A goblin';
        return undefined;
      });
      const stats = goeStats();
      renderComponent(stats);
      expect(screen.getByText(/Awakened Mind: A goblin/)).toBeInTheDocument();
    });

    it.each([null, ''])(
      'does not show awakened mind badge when target is %s',
      (value) => {
        runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
          if (key === 'awakenedMindTarget') return value;
          return undefined;
        });
        renderComponent(goeStats());
        expect(screen.queryByText(/Awakened Mind/)).not.toBeInTheDocument();
      },
    );

    it('does not show awakened mind badge for non-great old one patron', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'awakenedMindTarget') return 'A goblin';
        return undefined;
      });
      const stats = buildPlayerStats({
        class: {
          name: 'Warlock',
          major: { name: 'Fiend' },
          subclass: {},
          class_levels: [],
          fightingStyles: [],
        },
      });
      renderComponent(stats);
      expect(screen.queryByText(/Awakened Mind/)).not.toBeInTheDocument();
    });
  });

  describe('steps of the fey', () => {
    it('renders steps of the fey when bonus action exists', () => {
      const stats = buildPlayerStats({
        automation: { bonusActions: [{ type: 'steps_of_the_fey' }] },
      });
      renderComponent(stats);
      expect(screen.getByText(/Steps of the Fey:/)).toBeInTheDocument();
    });

    it.each([{ bonusActions: [] }, { bonusActions: undefined }])(
      'does not render steps of the fey when bonusActions is %s',
      ({ bonusActions }) => {
        const stats = buildPlayerStats({ automation: { bonusActions } });
        renderComponent(stats);
        expect(screen.queryByText(/Steps of the Fey/)).not.toBeInTheDocument();
      },
    );

    it('renders steps of the fey max as max(chaMod, 1) with chaMod 3', () => {
      const stats = buildPlayerStats({
        abilities: [{ name: 'Charisma', bonus: 3 }],
        automation: { bonusActions: [{ type: 'steps_of_the_fey' }] },
      });
      renderComponent(stats);
      expect(screen.getByText(/Steps of the Fey: 3/)).toBeInTheDocument();
    });

  });
});
