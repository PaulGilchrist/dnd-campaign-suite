// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// Wizard Features are reached through the CharClassFeatures registry entry
// point (class name 'Wizard' → WizardFeatures, region testid 'char-class-wizard').

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
// ward max itself from passives, level, and the INT modifier).
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

const PORTENT_ACTION = { automation: { type: 'portent' } };

function portentStats(level = 5) {
  return wizardStats(level, { specialActions: [PORTENT_ACTION] });
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

  describe('class features wiring', () => {
    it('reads class features for the exact playerStats object it was given', () => {
      const stats = wizardStats();
      renderWizard(stats);
      expect(classFeatures.getClassFeatures).toHaveBeenCalledWith(stats);
    });

    it('subscribes to portent dice and buffs under the player name and campaign', () => {
      renderWizard(wizardStats());
      expect(runtimeState.useRuntimeValue).toHaveBeenCalledWith('Test Wizard', 'portentDice', CAMPAIGN);
      expect(runtimeState.useRuntimeValue).toHaveBeenCalledWith('Test Wizard', 'activeBuffs', CAMPAIGN);
    });
  });

  describe('arcane recovery', () => {
    it.each([1, 2, 3])('tracks arcane recovery max %i from the service', (levels) => {
      mockWizardFeatures({ arcaneRecoveryLevels: levels });
      renderWizard(wizardStats());
      expect(screen.getByTestId('tracked-resource-arcaneRecoveryLevels'))
        .toHaveTextContent(`Arcane Recovery Levels: ${levels}/${levels}`);
    });

    it('falls back to 0 max when the service omits arcaneRecoveryLevels', () => {
      mockWizardFeatures({ arcaneRecoveryLevels: undefined });
      renderWizard(wizardStats());
      expect(screen.getByTestId('tracked-resource-arcaneRecoveryLevels'))
        .toHaveTextContent('Arcane Recovery Levels: 0/0');
    });
  });

  describe('arcane ward', () => {
    it.each([
      ['an arcane_ward passive at level 5 with INT 3', [{ type: 'arcane_ward' }], 5, 3, 13],
      ['a passive_rule arcane_ward passive at level 5 with INT 3', [{ type: 'passive_rule', effect: 'arcane_ward' }], 5, 3, 13],
      ['an arcane_ward passive at level 12 with INT 4', [{ type: 'arcane_ward' }], 12, 4, 28],
      ['an arcane_ward passive at level 20 with INT 5', [{ type: 'arcane_ward' }], 20, 5, 45],
    ])('computes ward max as 2 × level + INT when given %s', (_label, passives, level, intBonus, expected) => {
      const stats = wizardStats(level, {
        abilities: abilities(intBonus),
        automation: { passives, reactions: [] },
      });
      renderWizard(stats);
      expect(screen.getByTestId('tracked-resource-arcaneWardHp'))
        .toHaveTextContent(`Arcane Ward HP: ${expected}/${expected}`);
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
      ['no passives at all', []],
      ['an unrelated passive type', [{ type: 'something_else' }]],
      ['a passive_rule without the arcane_ward effect', [{ type: 'passive_rule', effect: 'quickened' }]],
      ['no automation block', undefined],
    ])('omits the ward counter when given %s', (_label, passives) => {
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

    it.each([
      ['an empty array', []],
      ['invalid JSON text', 'not json'],
      ['a JSON object instead of an array', '{"a":1}'],
      ['null (never set)', null],
      ['undefined (never set)', undefined],
    ])('shows the no-dice state for %s', (_label, value) => {
      mockRuntime({ portentDice: value });
      const section = renderWizard(portentStats());
      expect(section.textContent).toContain('No dice remaining');
      expect(section.textContent).toContain('0 remaining (refreshes on Long Rest)');
      expect(section.querySelectorAll('.portent-die')).toHaveLength(0);
    });

    it.each([
      ['no special actions', []],
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
      ['a projected_ward reaction at 30 ft', { type: 'projected_ward', range: 30 }, 30],
      ['a projected_ward reaction at 60 ft', { type: 'projected_ward', range: 60 }, 60],
      ['a reaction matched by name', { name: 'Projected Ward', range: 45 }, 45],
      ['a projected_ward reaction without a range (defaults to 30 ft)', { type: 'projected_ward' }, 30],
    ])('renders the reaction badge for %s', (_label, reaction, range) => {
      const stats = wizardStats(5, { automation: { passives: [], reactions: [reaction] } });
      const section = renderWizard(stats);
      expect(section.textContent).toContain(`Projected Ward: Allies within ${range} ft. (Reaction)`);
    });

    it.each([
      ['no reactions', []],
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
      const section = renderWizard(wizardStats());
      const badge = screen.getByText(`The Third Eye: ${label}`);
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('automation-badge');
      expect(section.textContent).toContain(`The Third Eye: ${label}`);
    });

    it.each([
      ['an unmapped effect', 'mystery_effect'],
      ['a buff with no effect', undefined],
    ])('falls back to "Active" for %s', (_label, effect) => {
      mockRuntime({ buffs: [{ name: 'The Third Eye', effect }] });
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

    it.each([
      ['null', null],
      ['undefined', undefined],
    ])('survives a non-array activeBuffs value (%s) while still rendering its resources', (_label, buffs) => {
      mockRuntime({ buffs });
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

    it('renders the wizard region when showWizardFeatures is true', () => {
      mockWizardFeatures({ showWizardFeatures: true });
      const section = renderWizard(wizardStats());
      expect(section).toBeInTheDocument();
      expect(screen.getByTestId('tracked-resource-arcaneRecoveryLevels')).toBeInTheDocument();
    });

    it('renders by default when showWizardFeatures is omitted', () => {
      mockWizardFeatures({ showWizardFeatures: undefined });
      expect(renderWizard(wizardStats())).toBeInTheDocument();
    });
  });

  describe('coexistence with entry-point features', () => {
    it('renders dodge, adrenaline rush, and stonecunning alongside the wizard region', () => {
      mockRuntime({ buffs: [{ effect: 'dodge' }] });
      const stats = wizardStats(5, {
        proficiency: 3,
        automation: { passives: [], reactions: [], specialActions: [{ effect: 'bonus_action_dash' }] },
        race: { traits: [{ name: 'Stonecunning', automation: true }] },
      });
      renderWizard(stats);
      expect(screen.getByText('Dodge — Disadv on attacks vs you, Adv on DEX saves')).toBeInTheDocument();
      expect(screen.getByTestId('tracked-resource-adrenalineRushUses')).toHaveTextContent('Adrenaline Rush: 3/3');
      expect(screen.getByTestId('tracked-resource-stonecunningUses')).toHaveTextContent('Stonecunning: 3/3');
      expect(screen.getByTestId('tracked-resource-arcaneRecoveryLevels')).toHaveTextContent('Arcane Recovery Levels: 1/1');
    });
  });
});
