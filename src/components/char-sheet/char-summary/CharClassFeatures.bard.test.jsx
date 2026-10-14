// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as unbreakableMajesty from '../../../services/combat/auras/unbreakableMajesty.js';

// Owns: Bard region rendering only — what BardFeatures displays from the
// values the class-rules service returns (that service's level math is
// pinned by classRules.test.js; registry dispatch by CharClassFeatures.test.jsx).

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

function mockBardFeatures(overrides = {}) {
  classFeatures.getClassFeatures.mockReturnValue({
    bardicDie: 6,
    songOfRestDie: null,
    magicalSecrets: null,
    subclassMagicalSecrets: 0,
    ...overrides,
  });
}

function mockBuffs(buffs) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) =>
    (key === 'activeBuffs' ? buffs : undefined));
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
    automation: { passives: [] },
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
    mockBuffs([]);
    unbreakableMajesty.isUnbreakableMajestyActive.mockReturnValue(false);
    unbreakableMajesty.getUnbreakableMajestySaveDc.mockReturnValue(0);
  });

  it.each([
    [8, 'Bardic Inspiration Die: d8'],
    [12, 'Bardic Inspiration Die: d12'],
    [undefined, 'Bardic Inspiration Die: d0'],
  ])('renders the inspiration die from class rules %p', (bardicDie, expected) => {
    mockBardFeatures({ bardicDie });
    expect(renderBard(bardStats(5)).textContent).toContain(expected);
  });

  it.each([
    [3, 'Bardic Inspiration Uses: 3/3'],
    [0, 'Bardic Inspiration Uses: 0/0'],
  ])('tracks inspiration uses from the Charisma modifier %p', (bonus, expected) => {
    renderBard(bardStats(1, {
      abilities: [{ name: 'Charisma', bonus }],
    }));
    expect(screen.getByTestId('tracked-resource-bardicInspirationUses')).toHaveTextContent(expected);
  });

  it('tracks inspiration uses as 0/0 when the Charisma ability is missing', () => {
    renderBard(bardStats(1, { abilities: [] }));
    expect(screen.getByTestId('tracked-resource-bardicInspirationUses')).toHaveTextContent('Bardic Inspiration Uses: 0/0');
  });

  it('renders joined expertise above level 2', () => {
    const section = renderBard(bardStats(3, { expertise: ['Athletics', 'Stealth', 'Persuasion'] }));
    expect(section.textContent).toContain('Expertise: Athletics, Stealth, Persuasion');
  });

  it.each([
    ['locked at level 2', 2, ['Athletics']],
    ['expertise is missing', 5, undefined],
    ['expertise is empty', 5, []],
  ])('omits expertise when %s', (_label, level, expertise) => {
    expect(renderBard(bardStats(level, { expertise })).textContent).not.toContain('Expertise:');
  });

  it.each([
    ['shown above level 5 with secrets', 6, 3, true],
    ['locked at exactly level 5', 5, 3, false],
    ['hidden without secrets', 10, null, false],
  ])('extra attacks via magical secrets: %s', (_label, level, magicalSecrets, shouldShow) => {
    mockBardFeatures({ magicalSecrets });
    const text = renderBard(bardStats(level)).textContent;
    if (shouldShow) {
      expect(text).toContain('Extra Attacks: 1');
    } else {
      expect(text).not.toContain('Extra Attacks');
    }
  });

  it.each([
    [null, false],
    [3, true],
  ])('renders the Magical Secrets tracked resource only when secrets are known (%p)', (magicalSecrets, shouldShow) => {
    mockBardFeatures({ magicalSecrets, subclassMagicalSecrets: 2 });
    renderBard(bardStats(14));
    const resource = screen.queryByTestId('tracked-resource-magicalSecrets');
    if (shouldShow) {
      expect(resource).toHaveTextContent('Magical Secrets: 5/5');
    } else {
      expect(resource).not.toBeInTheDocument();
    }
  });

  it('renders a single-use Beguiling Magic tracker for a passive_rule with riderSave', () => {
    renderBard(bardStats(6, {
      automation: { passives: [{ type: 'passive_rule', riderSave: true }] },
    }));
    expect(screen.getByTestId('tracked-resource-postCastRider_Beguiling_Magic')).toHaveTextContent('Beguiling Magic: 1/1');
  });

  it.each([
    ['no passives at all', undefined],
    ['no passives listed', []],
    ['a passive_rule without riderSave', [{ type: 'passive_rule' }]],
    ['riderSave on a non-passive_rule entry', [{ type: 'active_rule', riderSave: true }]],
  ])('omits the Beguiling Magic tracker when %s', (_label, passives) => {
    renderBard(bardStats(6, { automation: { passives } }));
    expect(screen.queryByTestId('tracked-resource-postCastRider_Beguiling_Magic')).not.toBeInTheDocument();
  });

  it.each([
    [8, true],
    [null, false],
  ])('renders the Song of Rest die when songOfRestDie is %p', (die, shouldShow) => {
    mockBardFeatures({ songOfRestDie: die });
    const text = renderBard(bardStats(9)).textContent;
    if (shouldShow) {
      expect(text).toContain('Song of Rest Die: d8');
    } else {
      expect(text).not.toContain('Song of Rest');
    }
  });

  it('shows an active Unbreakable Majesty badge with its save DC and clears the aura on click', () => {
    unbreakableMajesty.isUnbreakableMajestyActive.mockReturnValue(true);
    unbreakableMajesty.getUnbreakableMajestySaveDc.mockReturnValue(15);
    const section = renderBard(bardStats(18));
    const button = screen.getByRole('button', { name: /Unbreakable Majesty DC 15/ });
    expect(button).toHaveClass('majesty-badge--active');
    expect(section.contains(button)).toBe(true);
    fireEvent.click(button);
    expect(unbreakableMajesty.clearUnbreakableMajesty).toHaveBeenCalledWith('Test Bard', 'test-campaign');
  });

  it('hides majesty and queries the aura for this player and campaign when inactive', () => {
    const section = renderBard(bardStats(18));
    expect(screen.queryByRole('button', { name: /Unbreakable Majesty/ })).not.toBeInTheDocument();
    expect(section.textContent).not.toContain('Unbreakable Majesty');
    expect(unbreakableMajesty.isUnbreakableMajestyActive).toHaveBeenCalledWith('Test Bard', 'test-campaign');
  });

  it('badges multi-minute buffs and filters shorter or unlisted durations', () => {
    mockBuffs([
      { name: 'Buff A', duration: '1_minute' },
      { name: 'Buff B', duration: 'hour' },
      { name: 'Buff C', duration: '1_round' },
      { name: 'Buff D', duration: '1_hour' },
    ]);
    const badges = [...renderBard(bardStats(1)).querySelectorAll('.automation-badge')].map(el => el.textContent);
    expect(badges).toEqual(['Buff A', 'Buff B']);
  });

  it.each([[[]], [undefined], ['corrupted']])(
    'renders no buff badges when activeBuffs is %p',
    (buffs) => {
      mockBuffs(buffs);
      expect(renderBard(bardStats(1)).querySelectorAll('.automation-badge')).toHaveLength(0);
    }
  );
});
