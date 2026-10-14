// @maintained-by-ai
/**
 * CORE LANE — CharClassFeatures entry point.
 * Owns: registry dispatch (class name → region, case-sensitive), unknown-class
 * handling (null path, stonecunning automation flag, adrenaline max scaling),
 * the entry-level dodge badge (non-array activeBuffs robustness lives here),
 * and the weapon mastery modal lifecycle (seeding + close) driven from the
 * entry point itself.
 *
 * Class-specific feature content is owned by the per-class sibling files
 * (CharClassFeatures.<class>.test.jsx) — do NOT add it here. Delegated:
 * - Mastery-span click opens the modal → barbarian / fighter siblings
 *   (this file only tests what happens AFTER the click: seeding & close)
 * - Adrenaline/stonecunning/dodge coexisting WITH a class region →
 *   sorcerer / wizard siblings
 * - All class feature values, badges, DCs, popups → their own siblings
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as dataLoader from '../../../services/ui/dataLoader.js';

const CAMPAIGN = 'test-campaign';
const CLASS_NAMES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
  'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard',
];

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

// Fighter / paladin / ranger mount an effect that loads the style catalog;
// keep it inert so no test depends on real data files.
vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(),
}));

// Mock with a resourceKey-scoped testid so assertions can verify a specific
// tracked resource's computed max, not just that "some" label rendered.
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

// Mock that echoes the props the entry point is responsible for seeding,
// and exposes close so the modal lifecycle can be driven from the test.
vi.mock('../modals/WeaponKindMasteryModal.jsx', () => ({
  default: function MockWeaponKindMasteryModal({ existing, onClose }) {
    return (
      <div data-testid="weapon-mastery-modal">
        <span data-testid="mastery-existing">{JSON.stringify(existing)}</span>
        <button onClick={onClose}>close-mastery-modal</button>
      </div>
    );
  },
}));

// Minimal shape every registry component consumes without crashing; exact
// values per class are pinned by the per-class sibling files.
const UNIVERSAL_FEATURES = {
  bardicDie: 8, magicalSecrets: null, songOfRestDie: null,
  maxChannelDivinity: 1, destroyUndeadCR: null,
  maxWildShapeUses: 2, beastKnownForms: 0, wildShapeLimitations: 'beasts only', maxWildShapeChallengeRating: 1,
  maxFocusPoints: 4, martialArtsDie: 6, unarmoredMovementIncrease: 10,
  extraAttacks: 1, auraRange: null,
  expertise: [], sneakAttack: { dice_count: 3, dice_value: 6 },
  creatingSpellSlotCosts: [],
  invocationsKnown: 0, hasArcanum: false, arcanumLevels: {}, pactBoon: null,
  arcaneRecoveryLevels: 0, showWizardFeatures: true,
};

function statsFor(className, overrides = {}) {
  return {
    name: 'Test Hero',
    level: 5,
    rules: '5e',
    proficiency: 3,
    class: {
      name: className,
      major: {},
      subclass: {},
      class_levels: Array.from({ length: 5 }, (_, i) => ({
        level: i + 1,
        extra_attacks: 1,
        second_wind: 1,
        weapon_mastery: 'Guard',
      })),
      fightingStyles: [],
    },
    abilities: [
      { name: 'Wisdom', bonus: 2 },
      { name: 'Charisma', bonus: 3 },
    ],
    automation: { passives: [], specialActions: [], bonusActions: [], reactions: [] },
    ...overrides,
  };
}

function renderEntry(playerStats) {
  return render(<CharClassFeatures playerStats={playerStats} campaignName={CAMPAIGN} />);
}

function mockBuffs(buffs) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => (key === 'activeBuffs' ? buffs : undefined));
}

function classRegions(container) {
  return container.querySelectorAll('[data-testid^="char-class-"]');
}

describe('CharClassFeatures entry point', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classFeatures.getClassFeatures.mockReturnValue({ ...UNIVERSAL_FEATURES });
    dataLoader.loadFightingStyles.mockResolvedValue([]);
    runtimeState.getRuntimeValue.mockReturnValue(null);
    mockBuffs([]);
  });

  describe('registry dispatch', () => {
    it.each(CLASS_NAMES)('routes class name %s to its own region, and only that region', (className) => {
      const { container } = renderEntry(statsFor(className));
      expect(screen.getByTestId(`char-class-${className.toLowerCase()}`)).toBeInTheDocument();
      expect(classRegions(container)).toHaveLength(1);
    });

    it('dispatches nothing for a lowercase class name (registry keys are case-sensitive)', () => {
      const { container } = renderEntry(statsFor('cleric'));
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('unknown class handling', () => {
    it('renders nothing when the class is unknown and no innate trait qualifies — stonecunning needs automation:true', () => {
      const { container } = renderEntry(statsFor('Mystic', {
        automation: { specialActions: [{ effect: 'some_other_effect' }] },
        race: { traits: [{ name: 'Stonecunning', automation: false }] },
      }));
      expect(container).toBeEmptyDOMElement();
    });

    it.each([
      [3, 'Adrenaline Rush: 3/3'],
      [undefined, 'Adrenaline Rush: 0/0'],
    ])('unknown class with adrenaline rush renders max from proficiency %p', (proficiency, expected) => {
      renderEntry(statsFor('Mystic', {
        proficiency,
        automation: { specialActions: [{ effect: 'bonus_action_dash' }] },
      }));
      expect(screen.getByTestId('tracked-resource-adrenalineRushUses')).toHaveTextContent(expected);
    });

    it('unknown class with automated stonecunning renders max from proficiency', () => {
      renderEntry(statsFor('Mystic', {
        proficiency: 2,
        race: { traits: [{ name: 'Stonecunning', automation: true }] },
      }));
      expect(screen.getByTestId('tracked-resource-stonecunningUses')).toHaveTextContent('Stonecunning: 2/2');
    });
  });

  describe('dodge badge (cross-class)', () => {
    it('renders alongside innate traits even when no class region dispatches', () => {
      mockBuffs([{ effect: 'dodge' }]);
      const { container } = renderEntry(statsFor('Mystic', {
        automation: { specialActions: [{ effect: 'bonus_action_dash' }] },
      }));
      expect(screen.getByText('Dodge — Disadv on attacks vs you, Adv on DEX saves')).toBeInTheDocument();
      expect(screen.getByTestId('tracked-resource-adrenalineRushUses')).toBeInTheDocument();
      expect(classRegions(container)).toHaveLength(0);
    });

    it('renders nothing for buffs that contain no dodge effect', () => {
      mockBuffs([{ effect: 'some_other_effect' }]);
      const { container } = renderEntry(statsFor('Mystic'));
      expect(screen.queryByText(/Dodge/)).not.toBeInTheDocument();
      expect(container).toBeEmptyDOMElement();
    });

    it('survives a non-array activeBuffs value without crashing the class region', () => {
      mockBuffs('not-an-array');
      renderEntry(statsFor('Barbarian'));
      expect(screen.getByTestId('char-class-barbarian')).toBeInTheDocument();
      expect(screen.queryByText(/Dodge/)).not.toBeInTheDocument();
    });
  });

  describe('weapon mastery modal lifecycle', () => {
    // The click itself lives in the barbarian/fighter lanes; here we own
    // what the entry point does with the click: seed from runtime, close.
    function clickBarbarianMastery(existing) {
      runtimeState.getRuntimeValue.mockReturnValue(existing);
      renderEntry(statsFor('Barbarian'));
      fireEvent.click(screen.getByTestId('char-class-barbarian').querySelector('.clickable'));
    }

    it('seeds the modal with existing chosen weapons read from the runtime store', () => {
      clickBarbarianMastery(['Slash', 'Hack']);
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Test Hero', '_Weapon_Kind_Mastery_chosenWeapons', CAMPAIGN);
      expect(screen.getByTestId('weapon-mastery-modal')).toBeInTheDocument();
      expect(screen.getByTestId('mastery-existing')).toHaveTextContent('["Slash","Hack"]');
    });

    it.each([null, 'corrupted'])(
      'seeds an empty weapon list when the runtime value is %p',
      (existing) => {
        clickBarbarianMastery(existing);
        expect(screen.getByTestId('mastery-existing')).toHaveTextContent('[]');
      }
    );

    it('unmounts the modal when onClose fires', () => {
      clickBarbarianMastery([]);
      fireEvent.click(screen.getByText('close-mastery-modal'));
      expect(screen.queryByTestId('weapon-mastery-modal')).not.toBeInTheDocument();
    });
  });
});
