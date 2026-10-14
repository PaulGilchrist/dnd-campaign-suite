import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

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
    maxSorceryPoints: 5,
    metamagicKnown: 2,
    maxInnateSorcery: 0,
    creatingSpellSlotCosts: [],
  })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

const MOCK_CAMPAIGN = 'test-campaign';

function buildSorcererStats(overrides = {}) {
  return {
    name: 'Test Sorcerer',
    level: 5,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Sorcerer',
      class_levels: [{ level: 5 }],
      major: {},
      subclass: {},
      fightingStyles: [],
    },
    abilities: [],
    automation: { passives: [], specialActions: [] },
    ...overrides,
  };
}

function setBuffs(buffs) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'activeBuffs') return buffs;
    return undefined;
  });
}

function setTranceOfOrder(active) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'tranceOfOrderActive') return active;
    if (key === 'activeBuffs') return [];
    return undefined;
  });
}

describe('SorcererFeatures (via CharClassFeatures entry point)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [];
      return undefined;
    });
  });

  afterEach(cleanup);

  describe('tracked resources', () => {
    const resourceTests = [
      { label: 'Sorcery Points:', testId: 'tracked-resource-sorceryPoints', text: '5/5' },
      { label: 'Metamagic Known:', testId: 'tracked-resource-metamagicKnown', text: '2/2' },
      { label: 'Innate Sorcery:', testId: 'tracked-resource-innateSorceryUses', text: '0/0' },
    ];

    it.each(resourceTests)('renders $label with max from classFeatures', ({ label, testId, text }) => {
      const stats = buildSorcererStats();
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByTestId(testId)).toHaveTextContent(text);
    });

    it('renders sorcerous restoration when resource_restoration passive exists', () => {
      const stats = buildSorcererStats({
        automation: { passives: [{ type: 'resource_restoration' }] },
      });
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Sorcerous Restoration:')).toBeInTheDocument();
      expect(screen.getByTestId('tracked-resource-sorcerousRestorationUses')).toHaveTextContent('1/1');
    });

    it('does not render sorcerous restoration when resource_restoration passive is absent', () => {
      const stats = buildSorcererStats({ automation: { passives: [] } });
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText('Sorcerous Restoration:')).not.toBeInTheDocument();
    });
  });

  describe('active buff badges', () => {
    it('shows innate sorcery badge text when the buff is active', () => {
      setBuffs([{ name: 'Innate Sorcery' }]);
      const stats = buildSorcererStats();
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('+1 Save DC, Spell Adv')).toBeInTheDocument();
    });

    it('shows telepathic speech badge when the buff is active', () => {
      setBuffs([{ name: 'Telepathic Speech' }]);
      const stats = buildSorcererStats();
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Telepathic Speech')).toBeInTheDocument();
    });

    it('shows trance of order badge when tranceOfOrderActive is true', () => {
      setTranceOfOrder(true);
      const stats = buildSorcererStats();
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Trance of Order')).toBeInTheDocument();
    });
  });

  describe('revelation in flesh effect mapping', () => {
    const effectMappings = [
      { effect: 'aquatic_adaptation', label: 'Aquatic Adaptation' },
      { effect: 'glistening_flight', label: 'Glistening Flight' },
      { effect: 'see_the_invisible', label: 'See the Invisible' },
      { effect: 'wormhole_movement', label: 'Wormhole Movement' },
    ];

    it.each(effectMappings)('displays "$label" for effect "$effect"', ({ effect, label }) => {
      setBuffs([{ name: 'Revelation in Flesh', effect }]);
      const stats = buildSorcererStats();
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('renders multiple revelation effects joined with comma', () => {
      setBuffs([
        { name: 'Revelation in Flesh', effect: 'aquatic_adaptation' },
        { name: 'Revelation in Flesh', effect: 'glistening_flight' },
      ]);
      const stats = buildSorcererStats();
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      const badge = screen.getByText(/Aquatic Adaptation.*Glistening Flight/);
      expect(badge).toBeInTheDocument();
    });
  });

  describe('spell slot costs', () => {
    it('renders spell slot costs header when creatingSpellSlotCosts has entries', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        maxSorceryPoints: 5,
        metamagicKnown: 2,
        maxInnateSorcery: 0,
        creatingSpellSlotCosts: ['1 sorcery point', '2 sorcery points'],
      });
      const stats = buildSorcererStats();
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Spell Slot \(level 1-5\) Costs:/)).toBeInTheDocument();
      expect(screen.getByText(/1 sorcery point, 2 sorcery points/)).toBeInTheDocument();
    });

    it('does not render spell slot costs header when array is empty', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        maxSorceryPoints: 5,
        metamagicKnown: 2,
        maxInnateSorcery: 0,
        creatingSpellSlotCosts: [],
      });
      const stats = buildSorcererStats();
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText(/Spell Slot \(level 1-5\) Costs/)).not.toBeInTheDocument();
    });
  });

  describe('integration with entry point features', () => {
    it('renders dodge badge alongside sorcerer features when dodge buff is active', () => {
      setBuffs([{ effect: 'dodge' }]);
      const stats = buildSorcererStats();
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Dodge — Disadv on attacks vs you, Adv on DEX saves')).toBeInTheDocument();
      expect(screen.getByText('Sorcery Points:')).toBeInTheDocument();
    });

    it('renders adrenaline rush alongside sorcerer features when bonus_action_dash special action exists', () => {
      const stats = buildSorcererStats({
        automation: { specialActions: [{ effect: 'bonus_action_dash' }] },
      });
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Adrenaline Rush:')).toBeInTheDocument();
      expect(screen.getByTestId('tracked-resource-adrenalineRushUses')).toHaveTextContent('2/2');
      expect(screen.getByText('Sorcery Points:')).toBeInTheDocument();
    });

    it('renders stonecunning alongside sorcerer features when race has automation trait', () => {
      const stats = buildSorcererStats({
        race: { traits: [{ name: 'Stonecunning', automation: true }] },
      });
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Stonecunning:')).toBeInTheDocument();
      expect(screen.getByTestId('tracked-resource-stonecunningUses')).toHaveTextContent('2/2');
      expect(screen.getByText('Sorcery Points:')).toBeInTheDocument();
    });
  });
});
