// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// Wizard Features are reached through the CharClassFeatures registry entry
// point (class name 'Wizard' → WizardFeatures, region testid 'char-class-wizard').
// Registry dispatch and entry-level dodge/adrenaline/stonecunning coexistence
// are owned by CharClassFeatures.test.jsx and the sorcerer sibling — here we
// verify only the wizard region's rendering behavior.

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

// Mirrors the shape classRules.getWizardFeatures returns in the real service
// (arcaneWard/arcaneWardMax are informational — the component re-derives the
// ward max itself from passives, level, and the INT modifier, never from
// these fields).
const defaultWizardFeatures = {
  arcaneRecoveryLevels: 1,
  arcaneWard: false,
  arcaneWardMax: 0,
  showWizardFeatures: true,
};

function mockWizardFeatures(overrides = {}) {
  classFeatures.getClassFeatures.mockReturnValue({ ...defaultWizardFeatures, ...overrides });
}

function mockRuntime({ portentDice = undefined, buffs = [] } = {}) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    switch (key) {
      case 'portentDice': return portentDice;
      case 'activeBuffs': return buffs;
      default: return undefined;
    }
  });
}

// Realistic six-ability list with Intelligence at index 3 — the wizard reads
// only the INT modifier, and it must find it by name, not by position.
function abilities(intBonus = 3) {
  return [
    { name: 'Strength', bonus: 0 },
    { name: 'Dexterity', bonus: 1 },
    { name: 'Constitution', bonus: 2 },
    { name: 'Intelligence', bonus: intBonus },
    { name: 'Wisdom', bonus: 1 },
    { name: 'Charisma', bonus: 0 },
  ];
}

function wizardStats(level = 5, overrides = {}) {
  return {
    name: 'Test Wizard',
    level,
    rules: '5e',
    proficiency: 3,
    class: {
      name: 'Wizard',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: abilities(),
    automation: { passives: [], reactions: [] },
    specialActions: [],
    ...overrides,
  };
}

function portentStats(level = 5) {
  return wizardStats(level, { specialActions: [{ automation: { type: 'portent' } }] });
}

function renderWizard(playerStats) {
  render(<CharClassFeatures playerStats={playerStats} campaignName={CAMPAIGN} />);
  return screen.getByTestId('char-class-wizard');
}

describe('WizardFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWizardFeatures();
    mockRuntime();
  });

  it('wires the service and runtime subscriptions to the exact character it was given', () => {
    const stats = wizardStats();
    renderWizard(stats);
    expect(classFeatures.getClassFeatures).toHaveBeenCalledWith(stats);
    expect(runtimeState.useRuntimeValue).toHaveBeenCalledWith('Test Wizard', 'portentDice', CAMPAIGN);
    expect(runtimeState.useRuntimeValue).toHaveBeenCalledWith('Test Wizard', 'activeBuffs', CAMPAIGN);
  });

  describe('arcane recovery', () => {
    it.each([
      ['a value from the service', 2, 'Arcane Recovery Levels: 2/2'],
      ['an omitted value (falls back to 0)', undefined, 'Arcane Recovery Levels: 0/0'],
    ])('tracks the arcane recovery max from %s', (_label, levels, expected) => {
      mockWizardFeatures({ arcaneRecoveryLevels: levels });
      renderWizard(wizardStats());
      expect(screen.getByTestId('tracked-resource-arcaneRecoveryLevels'))
        .toHaveTextContent(expected);
    });
  });

  describe('arcane ward', () => {
    // One level/INT pair is enough to pin the 2 × level + INT formula
    // (5 × 2 + 3 = 13 — all three terms distinct so hardcoding any one
    // fails); each row exercises a different passive-detection shape.
    it.each([
      ['an arcane_ward passive', [{ type: 'arcane_ward' }], {}],
      [
        'a passive_rule arcane_ward passive (and ignores the service\'s informational arcaneWardMax)',
        [{ type: 'passive_rule', effect: 'arcane_ward' }],
        { arcaneWard: true, arcaneWardMax: 99 },
      ],
    ])('computes ward max as 2 × level + INT at level 5 with INT 3, given %s', (_label, passives, featureOverrides) => {
      mockWizardFeatures(featureOverrides);
      const stats = wizardStats(5, { automation: { passives, reactions: [] } });
      renderWizard(stats);
      expect(screen.getByTestId('tracked-resource-arcaneWardHp'))
        .toHaveTextContent('Arcane Ward HP: 13/13');
    });

    it('treats a missing INT modifier as 0 when computing ward max', () => {
      const stats = wizardStats(5, {
        abilities: [{ name: 'Strength', bonus: 2 }],
        automation: { passives: [{ type: 'arcane_ward' }], reactions: [] },
      });
      renderWizard(stats);
      expect(screen.getByTestId('tracked-resource-arcaneWardHp'))
        .toHaveTextContent('Arcane Ward HP: 10/10');
    });

    it.each([
      ['passives of unrelated shapes', [{ type: 'something_else' }, { type: 'passive_rule', effect: 'quickened' }], {}],
      ['no automation block', undefined, {}],
      ['no passives even when the service claims a ward', [], { arcaneWard: true, arcaneWardMax: 42 }],
    ])('omits the ward counter when given %s', (_label, passives, featureOverrides) => {
      mockWizardFeatures(featureOverrides);
      const stats = wizardStats(5, { automation: { passives, reactions: [] } });
      const section = renderWizard(stats);
      expect(screen.queryByTestId('tracked-resource-arcaneWardHp')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Arcane Ward');
    });
  });

  describe('portent', () => {
    it('renders the dice display with every die in order, comma-separated', () => {
      mockRuntime({ portentDice: [12, 7, 19] });
      const section = renderWizard(portentStats());
      const display = section.querySelector('.portent-dice-display');
      expect(display).not.toBeNull();
      expect(display.textContent).toBe('12, 7, 19');
      expect(display.querySelectorAll('.portent-die')).toHaveLength(3);
      expect(section.textContent).toContain('3 remaining (refreshes on Long Rest)');
    });

    it('parses a JSON string of dice into the same display', () => {
      mockRuntime({ portentDice: '[15, 3]' });
      const section = renderWizard(portentStats());
      const display = section.querySelector('.portent-dice-display');
      expect(display.textContent).toBe('15, 3');
      expect(display.querySelectorAll('.portent-die')).toHaveLength(2);
      expect(section.textContent).toContain('2 remaining (refreshes on Long Rest)');
    });

    // Rows hit distinct parse paths: empty array, JSON.parse throw, parsed
    // non-array, and the nullish early-return (null takes this same path).
    it.each([
      ['an empty array', []],
      ['invalid JSON text', 'not json'],
      ['a JSON object instead of an array', '{"a":1}'],
      ['undefined (never set)', undefined],
    ])('shows the no-dice state for %s', (_label, value) => {
      mockRuntime({ portentDice: value });
      const section = renderWizard(portentStats());
      expect(section.textContent).toContain('No dice remaining');
      expect(section.textContent).toContain('0 remaining (refreshes on Long Rest)');
      expect(section.querySelectorAll('.portent-die')).toHaveLength(0);
    });

    // An empty specialActions array hits the same ?? [] path as undefined.
    it.each([
      ['a non-portent special action', [{ automation: { type: 'other' } }]],
      ['portent carried outside the automation wrapper', [{ type: 'portent' }]],
      ['no specialActions block', undefined],
    ])('omits the portent section entirely when given %s', (_label, specialActions) => {
      const stats = wizardStats(5, { specialActions });
      const section = renderWizard(stats);
      expect(section.textContent).not.toContain('Portent Dice');
      expect(section.textContent).not.toContain('remaining (refreshes on Long Rest)');
    });
  });

  describe('projected ward', () => {
    it.each([
      ['a projected_ward reaction at 60 ft', { type: 'projected_ward', range: 60 }, 60],
      ['a reaction matched by name', { name: 'Projected Ward', range: 45 }, 45],
      ['a projected_ward reaction without a range (defaults to 30 ft)', { type: 'projected_ward' }, 30],
    ])('renders the reaction badge for %s', (_label, reaction, range) => {
      const stats = wizardStats(5, { automation: { passives: [], reactions: [reaction] } });
      const section = renderWizard(stats);
      expect(section.textContent).toContain(`Projected Ward: Allies within ${range} ft. (Reaction)`);
    });

    it.each([
      ['an unrelated reaction', [{ type: 'opportunity_attack' }]],
      ['no automation block', undefined],
    ])('omits the badge when given %s', (_label, reactions) => {
      const stats = wizardStats(5, { automation: { passives: [], reactions } });
      const section = renderWizard(stats);
      expect(section.textContent).not.toContain('Projected Ward');
    });
  });

  describe('the third eye', () => {
    it.each([
      ['darkvision_120', 'Darkvision 120 ft.'],
      ['greater_comprehension', 'Greater Comprehension'],
      ['see_invisibility', 'See Invisibility'],
    ])('displays "$label" for effect "$effect"', (effect, label) => {
      mockRuntime({ buffs: [{ name: 'The Third Eye', effect }] });
      renderWizard(wizardStats());
      const badge = screen.getByText(`The Third Eye: ${label}`);
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('automation-badge');
    });

    it('falls back to "Active" for an unmapped effect', () => {
      mockRuntime({ buffs: [{ name: 'The Third Eye', effect: 'mystery_effect' }] });
      const section = renderWizard(wizardStats());
      expect(screen.getByText('The Third Eye: Active')).toBeInTheDocument();
      expect(section.textContent).not.toContain('mystery');
    });

    it('ignores third-eye effects carried by a differently-named buff', () => {
      mockRuntime({ buffs: [{ name: 'Other Feature', effect: 'see_invisibility' }] });
      const section = renderWizard(wizardStats());
      expect(section.textContent).not.toContain('The Third Eye');
      expect(section.textContent).not.toContain('See Invisibility');
    });

    it('survives a non-array activeBuffs value while still rendering its resources', () => {
      mockRuntime({ buffs: null });
      const section = renderWizard(wizardStats());
      expect(section.textContent).not.toContain('The Third Eye');
      expect(screen.getByTestId('tracked-resource-arcaneRecoveryLevels'))
        .toHaveTextContent('Arcane Recovery Levels: 1/1');
    });
  });

  describe('show wizard features toggle', () => {
    it('renders nothing when showWizardFeatures is false', () => {
      mockWizardFeatures({ showWizardFeatures: false });
      render(<CharClassFeatures playerStats={wizardStats()} campaignName={CAMPAIGN} />);
      expect(screen.queryByTestId('char-class-wizard')).not.toBeInTheDocument();
    });

    // The "renders when true" path is already exercised by every other test
    // here (the default mock has showWizardFeatures: true); this pins the
    // ?? true default for an omitted flag.
    it('renders by default when showWizardFeatures is omitted', () => {
      mockWizardFeatures({ showWizardFeatures: undefined });
      expect(renderWizard(wizardStats())).toBeInTheDocument();
    });
  });
});
