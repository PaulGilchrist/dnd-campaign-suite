// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// Warlock Features are reached through the CharClassFeatures registry entry
// point (class name 'Warlock' → WarlockFeatures, region testid 'char-class-warlock').

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

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

const CAMPAIGN = 'test-campaign';

// Mirrors the shape classRules.getWarlockFeatures returns in the real
// service (5e lv5 baseline).
const defaultWarlockFeatures = {
  invocationsKnown: 4,
  hasArcanum: false,
  arcanumLevels: {},
  pactBoon: 'Pact of the Blade',
  invocations: ['Agonizing Blast', 'Eldritch Sight'],
};

function mockWarlockFeatures(overrides = {}) {
  classFeatures.getClassFeatures.mockReturnValue({ ...defaultWarlockFeatures, ...overrides });
}

function mockRuntime({ buffs = [], awakenedMindTarget = undefined } = {}) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    switch (key) {
      case 'activeBuffs': return buffs;
      case 'awakenedMindTarget': return awakenedMindTarget;
      default: return undefined;
    }
  });
}

function warlockStats(level = 5, overrides = {}) {
  return {
    name: 'Test Warlock',
    level,
    rules: '5e',
    proficiency: 3,
    class: {
      name: 'Warlock',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [{ name: 'Charisma', bonus: 3 }],
    automation: { bonusActions: [] },
    ...overrides,
  };
}

// Patron lives on class.major OR class.subclass — this helper places the
// name in exactly one slot so tests prove the "either slot" match.
function patronStats(slot, patronName, level = 5, overrides = {}) {
  return warlockStats(level, {
    class: {
      name: 'Warlock',
      major: slot === 'major' ? { name: patronName } : {},
      subclass: slot === 'subclass' ? { name: patronName } : {},
      class_levels: [],
      fightingStyles: [],
    },
    ...overrides,
  });
}

function renderWarlock(playerStats) {
  render(<CharClassFeatures playerStats={playerStats} campaignName={CAMPAIGN} />);
  return screen.getByTestId('char-class-warlock');
}

describe('WarlockFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWarlockFeatures();
    mockRuntime();
  });

  describe('class features wiring', () => {
    it('reads class features for the exact playerStats object it was given', () => {
      const stats = warlockStats();
      renderWarlock(stats);
      expect(classFeatures.getClassFeatures).toHaveBeenCalledWith(stats);
    });
  });

  describe('invocations', () => {
    it.each([
      [4, 'Eldritch Invocations', 'Eldritch Invocations: 4'],
      [0, 'Invocations Known', 'Invocations Known: 0'],
      [null, 'Invocations Known', 'Invocations Known: '],
      [undefined, 'Invocations Known', 'Invocations Known: '],
    ])('labels known-count %s as "%s" and renders the raw value after it', (_known, label, expectedText) => {
      mockWarlockFeatures({ invocationsKnown: _known });
      renderWarlock(warlockStats());
      const labelEl = screen.getByText(`${label}:`);
      expect(labelEl.closest('div').textContent).toBe(expectedText);
    });

    it('renders invocations alphabetically sorted, comma-joined', () => {
      mockWarlockFeatures({
        invocations: ['Zephyr Invocation', 'Agonizing Blast', 'Mighty Invocation'],
      });
      const section = renderWarlock(warlockStats());
      expect(screen.getByText('Agonizing Blast, Mighty Invocation, Zephyr Invocation')).toBeInTheDocument();
      expect(section.textContent).toContain('Invocations: Agonizing Blast, Mighty Invocation, Zephyr Invocation');
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty array (no falsy-value fallback to an empty row)', []],
    ])('omits the invocations list row when invocations is %s', (_label, invocations) => {
      mockWarlockFeatures({ invocations });
      const section = renderWarlock(warlockStats());
      // Exact query for the list row's <b> label — the count row's
      // "Eldritch Invocations:" must not satisfy this via substring.
      expect(screen.queryByText('Invocations:')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Agonizing Blast');
    });

    it('renders the default invocation list verbatim', () => {
      const section = renderWarlock(warlockStats());
      expect(section.textContent).toContain('Invocations: Agonizing Blast, Eldritch Sight');
    });
  });

  describe('pact boon', () => {
    it('renders the pact boon row and a titled button when pactBoon is present', () => {
      const section = renderWarlock(warlockStats());
      expect(section.textContent).toContain('Pact Boon: Pact of the Blade');
      const button = screen.getByRole('button', { name: /Pact of the Blade/ });
      expect(button).toHaveAttribute('title', 'Pact Boon: Pact of the Blade');
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty string (|| null guard)', ''],
    ])('omits the pact boon row and button entirely when pactBoon is %s', (_label, pactBoon) => {
      mockWarlockFeatures({ pactBoon });
      const section = renderWarlock(warlockStats());
      expect(section.textContent).not.toContain('Pact Boon');
      expect(screen.queryByRole('button', { name: /Pact of the Blade/ })).not.toBeInTheDocument();
    });
  });

  describe('arcanum', () => {
    it('renders one fixed 1/1 slot per arcanum level with count > 0', () => {
      mockWarlockFeatures({
        hasArcanum: true,
        arcanumLevels: { level6: 1, level7: 1, level8: 0, level9: 1 },
      });
      renderWarlock(warlockStats(13));
      expect(screen.getByTestId('tracked-resource-mysticArcanumLevel6')).toHaveTextContent('6th Level Arcanum: 1/1');
      expect(screen.getByTestId('tracked-resource-mysticArcanumLevel7')).toHaveTextContent('7th Level Arcanum: 1/1');
      expect(screen.getByTestId('tracked-resource-mysticArcanumLevel9')).toHaveTextContent('9th Level Arcanum: 1/1');
      expect(screen.queryByTestId('tracked-resource-mysticArcanumLevel8')).not.toBeInTheDocument();
    });

    it.each([
      ['hasArcanum false even with nonzero counts', false, { level6: 1, level7: 1 }],
      ['hasArcanum true but every count 0', true, { level6: 0, level7: 0, level8: 0, level9: 0 }],
      ['hasArcanum true but arcanumLevels undefined (|| {} guard)', true, undefined],
    ])('omits every arcanum slot when %s', (_label, hasArcanum, arcanumLevels) => {
      mockWarlockFeatures({ hasArcanum, arcanumLevels });
      const section = renderWarlock(warlockStats(13));
      expect(section.textContent).not.toContain('Arcanum');
    });
  });

  describe('celestial patron', () => {
    it.each([
      ['major', 'Celestial Patron', 5, 6],
      ['subclass', 'Celestial Patron', 10, 11],
    ])('tracks Healing Light at 1 + level (%i → %i) when patron is set on %s', (slot, patron, level, expectedMax) => {
      renderWarlock(patronStats(slot, patron, level));
      expect(screen.getByTestId('tracked-resource-healinglightPool'))
        .toHaveTextContent(`Healing Light: ${expectedMax}/${expectedMax}`);
    });

    it('does not render healing light for a non-celestial patron', () => {
      const section = renderWarlock(patronStats('major', 'Fiend'));
      expect(screen.queryByTestId('tracked-resource-healinglightPool')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Healing Light');
    });
  });

  describe('fiend patron', () => {
    it.each([
      ['major', 'Fiend'],
      ['major', 'Fiend Patron'],
      ['subclass', 'Fiend'],
      ['subclass', 'Fiend Patron'],
    ])('tracks Dark One\'s Own Luck for name "%s" on %s', (slot, patron) => {
      renderWarlock(patronStats(slot, patron));
      expect(screen.getByTestId('tracked-resource-darkOnesLuckUses')).toBeInTheDocument();
    });

    it.each([
      [3, 3],
      [0, 1],
      [-2, 1],
    ])('clamps Dark One\'s Own Luck max to max(1, chaMod) — cha %i → %i', (cha, expectedMax) => {
      renderWarlock(patronStats('major', 'Fiend', 5, {
        abilities: [{ name: 'Charisma', bonus: cha }],
      }));
      expect(screen.getByTestId('tracked-resource-darkOnesLuckUses'))
        .toHaveTextContent(`Dark One's Own Luck: ${expectedMax}/${expectedMax}`);
    });

    it('does not render dark one\'s own luck for a non-fiend patron', () => {
      const section = renderWarlock(patronStats('major', 'Celestial Patron'));
      expect(screen.queryByTestId('tracked-resource-darkOnesLuckUses')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Dark One');
    });
  });

  describe('great old one patron', () => {
    it.each([
      ['major', 'Great Old One Patron'],
      ['subclass', 'Great Old One Patron'],
    ])('shows the awakened mind badge with target when patron is set on %s', (slot, patron) => {
      mockRuntime({ awakenedMindTarget: 'A goblin' });
      const section = renderWarlock(patronStats(slot, patron));
      expect(section.textContent).toContain('Awakened Mind: A goblin');
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty string', ''],
    ])('omits the awakened mind badge when target is %s', (_label, target) => {
      mockRuntime({ awakenedMindTarget: target });
      const section = renderWarlock(patronStats('major', 'Great Old One Patron'));
      expect(section.textContent).not.toContain('Awakened Mind');
    });

    it('omits the awakened mind badge for a non-great-old-one patron even with a target', () => {
      mockRuntime({ awakenedMindTarget: 'A goblin' });
      const section = renderWarlock(patronStats('major', 'Fiend'));
      expect(section.textContent).not.toContain('Awakened Mind');
    });
  });

  describe('steps of the fey', () => {
    it.each([
      [3, 3],
      [1, 1],
      [0, 1],
      [-2, 1],
    ])('clamps Steps of the Fey max to max(chaMod, 1) — cha %i → %i', (cha, expectedMax) => {
      const stats = warlockStats(5, {
        abilities: [{ name: 'Charisma', bonus: cha }],
        automation: { bonusActions: [{ type: 'steps_of_the_fey' }] },
      });
      renderWarlock(stats);
      expect(screen.getByTestId('tracked-resource-_Steps_of_the_Fey_freeCastCount'))
        .toHaveTextContent(`Steps of the Fey: ${expectedMax}/${expectedMax}`);
    });

    it.each([
      ['an empty array', []],
      ['undefined', undefined],
      ['automation itself undefined', undefined],
    ])('omits steps of the fey when bonusActions is %s', (_label, bonusActions) => {
      const stats = warlockStats(5, {
        automation: bonusActions === undefined ? undefined : { bonusActions },
      });
      const section = renderWarlock(stats);
      expect(screen.queryByTestId('tracked-resource-_Steps_of_the_Fey_freeCastCount')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Steps of the Fey');
    });
  });
});
