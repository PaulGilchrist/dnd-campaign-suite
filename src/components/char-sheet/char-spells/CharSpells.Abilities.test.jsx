// @improved-by-ai
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

import { mockPlayerStats, mockHandleTogglePreparedSpells } from './CharSpells.test.helpers.js';

import * as buffService from '../../../services/combat/buffs/buffService.js';

import useActionPopup from '../../../hooks/combat/useActionPopup.js';

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useMetamagic.js', () => {
  const mockFn = () => ({
    currentSP: 10,
    maxSP: 10,
    spendSorceryPoints: vi.fn(),
    logMetamagic: vi.fn(),
  });
  mockFn.getCurrentSorceryPoints = vi.fn(() => 10);
  mockFn.getMaxSorceryPoints = vi.fn(() => 10);
  return { default: mockFn, getCurrentSorceryPoints: mockFn.getCurrentSorceryPoints, getMaxSorceryPoints: mockFn.getMaxSorceryPoints };
});

vi.mock('../popups/MetamagicPopup.jsx', () => ({
  default: function MockMetamagicPopup({ onConfirm, onSkip }) {
    return (
      <div data-testid="metamagic-popup">
        <button data-testid="mock-confirm" onClick={() => onConfirm({ options: [], totalCost: 0, twinTarget: null })}>
          Mock Confirm
        </button>
        <button data-testid="mock-skip" onClick={onSkip}>
          Mock Skip
        </button>
      </div>
    );
  },
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function MockCharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
  },
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingMultiTarget: null,
    handleMultiTargetConfirm: vi.fn(),
    handleMultiTargetSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingHeroesFeast: null,
    handleHeroesFeastConfirm: vi.fn(),
    handleHeroesFeastSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
    pendingLesserRestoration: null,
    handleLesserRestorationConfirm: vi.fn(),
    handleLesserRestorationSkip: vi.fn(),
    pendingMageArmor: null,
    handleMageArmorConfirm: vi.fn(),
    handleMageArmorSkip: vi.fn(),
    pendingShieldOfFaith: null,
    handleShieldOfFaithConfirm: vi.fn(),
    handleShieldOfFaithSkip: vi.fn(),
    pendingProtectionFromEnergy: null,
    handleProtectionFromEnergyConfirm: vi.fn(),
    handleProtectionFromEnergySkip: vi.fn(),
    pendingResistance: null,
    handleResistanceConfirm: vi.fn(),
    handleResistanceSkip: vi.fn(),
    pendingRemoveCurse: null,
    handleRemoveCurseConfirm: vi.fn(),
    handleRemoveCurseSkip: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
    gateUpcast: vi.fn(() => false),
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
    getCantripAutoLevel: vi.fn(() => null),
  })),
}));

vi.mock('../../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

const getSpellAbilitiesSection = (container) => {
  return container.querySelector('.spell-abilities');
};

const getValuesDiv = (section) => {
  const divs = section.querySelectorAll(':scope > div');
  return divs[2];
};

describe('CharSpells', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));
  });

  describe('Spell abilities display', () => {
    it('renders spell ability section with correct to hit, modifier, and save DC values', () => {
      const { container } = render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const section = getSpellAbilitiesSection(container);
      expect(section).not.toBeNull();

      const { getByText } = within(section);
      expect(getByText(/Attack \(to hit\):/)).toBeInTheDocument();
      expect(getByText(/\+5/)).toBeInTheDocument();
      expect(getByText(/Modifier:/)).toBeInTheDocument();
      expect(getByText(/\+3/)).toBeInTheDocument();
      expect(getByText(/Save DC:/)).toBeInTheDocument();
      expect(getByText(/13/)).toBeInTheDocument();
    });

    it('renders cantrips known with the correct value', () => {
      const { container } = render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const section = getSpellAbilitiesSection(container);
      const valuesDiv = getValuesDiv(section);
      const { getByText } = within(valuesDiv);
      expect(getByText(/Cantrips Known:/)).toBeInTheDocument();
      expect(getByText(/3/)).toBeInTheDocument();
    });

    it('renders prepared spells count when prepared_spells is defined', () => {
      const { container } = render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const section = getSpellAbilitiesSection(container);
      const valuesDiv = getValuesDiv(section);
      const { getByText } = within(valuesDiv);
      expect(getByText(/Prepared Spells:/)).toBeInTheDocument();
      expect(getByText(/5/)).toBeInTheDocument();
    });

    it('renders prepared spells count using spells_known when prepared_spells is undefined', () => {
      const statsWithSpellsKnown = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          prepared_spells: undefined,
          spells_known: 8,
        },
      };

      const { container } = render(
        <CharSpells
          playerStats={statsWithSpellsKnown}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const section = getSpellAbilitiesSection(container);
      const valuesDiv = getValuesDiv(section);
      const { getByText } = within(valuesDiv);
      expect(getByText(/Prepared Spells:/)).toBeInTheDocument();
      expect(getByText(/8/)).toBeInTheDocument();
    });

    it('renders "All" for prepared spells when both prepared_spells and spells_known are undefined', () => {
      const statsWithoutPrepared = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          prepared_spells: undefined,
          spells_known: undefined,
        },
      };

      const { container } = render(
        <CharSpells
          playerStats={statsWithoutPrepared}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const section = getSpellAbilitiesSection(container);
      const valuesDiv = getValuesDiv(section);
      const { getByText } = within(valuesDiv);
      expect(getByText(/Prepared Spells:/)).toBeInTheDocument();
      expect(getByText(/All/)).toBeInTheDocument();
    });

    it('renders max prepared spells with the correct value', () => {
      const { container } = render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const section = getSpellAbilitiesSection(container);
      const valuesDiv = getValuesDiv(section);
      const { getByText } = within(valuesDiv);
      expect(getByText(/Max Prepared:/)).toBeInTheDocument();
      expect(getByText(/5/)).toBeInTheDocument();
    });

    it('renders "All" for max prepared when maxPreparedSpells is undefined', () => {
      const statsWithoutMaxPrepared = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          maxPreparedSpells: undefined,
        },
      };

      const { container } = render(
        <CharSpells
          playerStats={statsWithoutMaxPrepared}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const section = getSpellAbilitiesSection(container);
      const valuesDiv = getValuesDiv(section);
      const { getByText } = within(valuesDiv);
      expect(getByText(/Max Prepared:/)).toBeInTheDocument();
      expect(getByText(/All/)).toBeInTheDocument();
    });

    it('defaults cantrips_known to 0 when undefined', () => {
      const statsWithoutCantrips = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          cantrips_known: undefined,
        },
      };

      const { container } = render(
        <CharSpells
          playerStats={statsWithoutCantrips}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const section = getSpellAbilitiesSection(container);
      const valuesDiv = getValuesDiv(section);
      const { getByText } = within(valuesDiv);
      expect(getByText(/Cantrips Known:/)).toBeInTheDocument();
      expect(getByText(/0/)).toBeInTheDocument();
    });

    it('hides prepared spells section for 2024 ruleset', () => {
      const stats2024 = {
        ...mockPlayerStats,
        rules: '2024',
      };

      const { container } = render(
        <CharSpells
          playerStats={stats2024}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const section = getSpellAbilitiesSection(container);
      const valuesDiv = getValuesDiv(section);
      const { getByText, queryByText } = within(valuesDiv);
      expect(getByText(/Cantrips Known:/)).toBeInTheDocument();
      expect(queryByText(/Prepared Spells:/)).not.toBeInTheDocument();
      expect(queryByText(/Max Prepared:/)).not.toBeInTheDocument();
    });

    it('applies exhaustion penalty to to hit value', () => {
      const { container } = render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
          exhaustionPenalty={2}
        />,
      );

      const section = getSpellAbilitiesSection(container);
      const { getByText } = within(section);
      expect(getByText(/Attack \(to hit\):/)).toBeInTheDocument();
      expect(getByText(/\+3/)).toBeInTheDocument();
    });

    it('applies exhaustion penalty to modifier value', () => {
      const { container } = render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
          exhaustionPenalty={2}
        />,
      );

      const section = getSpellAbilitiesSection(container);
      const { getByText } = within(section);
      expect(getByText(/Modifier:/)).toBeInTheDocument();
      expect(getByText(/\+1/)).toBeInTheDocument();
    });

    it('adds +1 to save DC when innate sorcery is active', () => {
      vi.mocked(buffService.isInnateSorceryActive).mockReturnValue(true);

      const { container } = render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const section = getSpellAbilitiesSection(container);
      const { getByText } = within(section);
      expect(getByText(/Save DC:/)).toBeInTheDocument();
      expect(getByText(/14/)).toBeInTheDocument();
    });

    it('renders the spell abilities container element', () => {
      const { container } = render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const spellAbilitiesDiv = getSpellAbilitiesSection(container);
      expect(spellAbilitiesDiv).not.toBeNull();
    });

    it('renders the spell table when spells array is populated', () => {
      render(
        <CharSpells
          playerStats={mockPlayerStats}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      const table = document.querySelector('.table-spells');
      expect(table).not.toBeNull();
      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    it('does not render spell abilities or table when spellAbilities is null', () => {
      const statsNoAbilities = {
        ...mockPlayerStats,
        spellAbilities: null,
      };

      const { container } = render(
        <CharSpells
          playerStats={statsNoAbilities}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(getSpellAbilitiesSection(container)).toBeNull();
      expect(container.querySelector('.table-spells')).toBeNull();
    });

    it('does not render spell abilities or table when spellAbilities is undefined', () => {
      const statsUndefinedAbilities = {
        ...mockPlayerStats,
        spellAbilities: undefined,
      };

      const { container } = render(
        <CharSpells
          playerStats={statsUndefinedAbilities}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(getSpellAbilitiesSection(container)).toBeNull();
      expect(container.querySelector('.table-spells')).toBeNull();
    });

    it('does not render spell abilities or table when spellAbilities has no spells', () => {
      const statsEmptySpells = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [],
        },
      };

      const { container } = render(
        <CharSpells
          playerStats={statsEmptySpells}
          handleTogglePreparedSpells={mockHandleTogglePreparedSpells}
        />,
      );

      expect(getSpellAbilitiesSection(container)).toBeNull();
      expect(container.querySelector('.table-spells')).toBeNull();
    });
  });
});
