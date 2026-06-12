import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue } from '../../../hooks/useRuntimeState.js';

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/combat/buffService.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

const mockPlayerStats = {
  name: 'TestCharacter',
  automation: {
    actions: [],
  },
  spellAbilities: {
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spell_slots_level_3: 2,
  },
};

const mockSpell = {
  name: 'Fireball',
  level: 3,
  description: 'A bright flash of lightning blazes out.',
  casting_time: '1 action',
  range: '150 feet',
  duration: 'Instantaneous',
  damage: {
    damage_at_slot_level: {
      '3': '8d6',
      '4': '9d6',
      '5': '10d6',
    },
    damage_at_character_level: {
      '10': '10d6',
      '15': '12d6',
      '20': '12d6',
    },
  },
};

const mockUpcastLevels = [
  { level: 3, formula: '8d6', availableSlots: 2 },
  { level: 4, formula: '9d6', availableSlots: 1 },
  { level: 5, formula: '10d6', availableSlots: 0 },
];

describe('SpellDetailPopup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('renders spell name in heading', () => {
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('renders spell description', () => {
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      expect(screen.getByText('A bright flash of lightning blazes out.')).toBeInTheDocument();
    });

    it('renders spell meta info', () => {
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      const metaContainer = screen.getByText('3').closest('.spell-detail-meta');
      expect(metaContainer).toHaveTextContent('Level:');
      expect(metaContainer).toHaveTextContent('Casting Time:');
      expect(metaContainer).toHaveTextContent('1 action');
      expect(metaContainer).toHaveTextContent('Range:');
      expect(metaContainer).toHaveTextContent('150 feet');
      expect(metaContainer).toHaveTextContent('Duration:');
      expect(metaContainer).toHaveTextContent('Instantaneous');
    });

    it('renders "Cantrip" for cantrips', () => {
      const cantrip = { ...mockSpell, level: 0, name: 'Cantrip Test' };
      render(
        <SpellDetailPopup
          spell={cantrip}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={[]}
        />
      );
      expect(screen.getByText('Cantrip')).toBeInTheDocument();
    });

    it('shows slots remaining when not upcastable', () => {
      const spellWithoutUpcast = {
        ...mockSpell,
        level: 1,
        damage: {
          damage_at_slot_level: {
            '1': '1d6',
          },
          damage_at_character_level: {
            '10': '1d6',
          },
        },
      };
      render(
        <SpellDetailPopup
          spell={spellWithoutUpcast}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={[]}
        />
      );
      expect(screen.getByText(/Slots Remaining:/)).toBeInTheDocument();
    });

    it('hides slots remaining when upcast selector is shown', () => {
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      expect(screen.queryByText(/Slots Remaining:/)).not.toBeInTheDocument();
    });

    it('renders upcast selector when spell is upcastable with multiple levels', () => {
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      expect(screen.getByText('Cast at Level:')).toBeInTheDocument();
      expect(screen.getByText('Level 3')).toBeInTheDocument();
      expect(screen.getByText('Level 4')).toBeInTheDocument();
      expect(screen.getByText('Level 5')).toBeInTheDocument();
    });

    it('renders upcast formulas and slot counts', () => {
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      expect(screen.getByText('8d6')).toBeInTheDocument();
      expect(screen.getByText('9d6')).toBeInTheDocument();
      expect(screen.getByText('10d6')).toBeInTheDocument();
      expect(screen.getByText('2 slots')).toBeInTheDocument();
      expect(screen.getByText('1 slot')).toBeInTheDocument();
    });

    it('does not render upcast selector for cantrips', () => {
      const cantrip = { ...mockSpell, level: 0, name: 'Cantrip Test' };
      render(
        <SpellDetailPopup
          spell={cantrip}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={[]}
        />
      );
      expect(screen.queryByText('Cast at Level:')).not.toBeInTheDocument();
    });

    it('renders Cast Spell and Close buttons', () => {
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
    });

    it('renders free cast message when free cast is authorized', () => {
      const statsWithFreeCast = {
        ...mockPlayerStats,
        automation: {
          actions: [
            {
              type: 'free_spell',
              name: 'War God\'s Blessing',
              spell: 'Fireball',
            },
          ],
        },
      };
      vi.mocked(getRuntimeValue).mockImplementation((playerName, key) => {
        if (key === '_War_God_s_Blessing_freeCast') return ['Fireball'];
        return null;
      });
      const { container } = render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={statsWithFreeCast}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      const freeCastMsg = container.querySelector('.spell-detail-free-cast');
      expect(freeCastMsg).toBeInTheDocument();
      expect(freeCastMsg.textContent).toContain('Free Cast');
      expect(freeCastMsg.textContent).toContain('no spell slot consumed');
    });

    it('renders no slots message when can\'t cast', () => {
      const noSlotsStats = {
        ...mockPlayerStats,
        spellAbilities: {
          spell_slots_level_3: 0,
        },
      };
      const noSlotsSpell = {
        ...mockSpell,
        damage: {
          damage_at_slot_level: {
            '3': '8d6',
          },
          damage_at_character_level: {
            '10': '8d6',
          },
        },
      };
      const { container } = render(
        <SpellDetailPopup
          spell={noSlotsSpell}
          playerStats={noSlotsStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={[]}
        />
      );
      const noSlotsMsg = container.querySelector('.spell-detail-no-slots');
      expect(noSlotsMsg).toBeInTheDocument();
      expect(noSlotsMsg.textContent).toContain('No spell slots available');
    });
  });

  describe('Upcast selector', () => {
    it('selects first available level by default', () => {
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeChecked();
    });

    it('allows selecting a different upcast level', () => {
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeChecked();

      fireEvent.click(screen.getByText('Level 4'));
      expect(radios[1]).toBeChecked();
    });

    it('disables radio inputs with no available slots', () => {
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).not.toBeDisabled();
      expect(radios[1]).not.toBeDisabled();
      expect(radios[2]).toBeDisabled();
    });

    it('applies selected class when level is selected', () => {
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      const levelLabels = screen.getAllByRole('radio').map(radio => radio.closest('label'));
      expect(levelLabels[0]).toHaveClass('spell-detail-upcast-selected');
      expect(levelLabels[1]).not.toHaveClass('spell-detail-upcast-selected');
    });
  });

  describe('Cantrip behavior', () => {
    it('renders cantrip with no upcast selector', () => {
      const cantrip = {
        name: 'Fire Bolt',
        level: 0,
        description: 'A flash of fire.',
        casting_time: '1 action',
        range: '120 feet',
        duration: 'Instantaneous',
        damage: {
          damage_at_character_level: {
            '1': '1d10',
            '5': '2d10',
            '11': '3d10',
            '17': '4d10',
          },
        },
      };
      render(
        <SpellDetailPopup
          spell={cantrip}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={[]}
          playerLevel={5}
        />
      );
      expect(screen.getByText('Cantrip')).toBeInTheDocument();
      expect(screen.queryByText('Cast at Level:')).not.toBeInTheDocument();
    });

    it('shows cantrip as castable (cantrips bypass slot checks)', () => {
      const noSlotsStats = {
        ...mockPlayerStats,
        spellAbilities: {},
      };
      const cantrip = {
        name: 'Prestidigitation',
        level: 0,
        description: 'Minor trick.',
        casting_time: '1 action',
        range: '10 feet',
        duration: '1 hour',
      };
      render(
        <SpellDetailPopup
          spell={cantrip}
          playerStats={noSlotsStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={[]}
        />
      );
      const castButton = screen.getByRole('button', { name: /Cast Spell/ });
      expect(castButton).not.toBeDisabled();
    });
  });

  describe('Rage debuff', () => {
    it('cast button is enabled when not raging', () => {
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      const castButton = screen.getByRole('button', { name: /Cast Spell/ });
      expect(castButton).not.toBeDisabled();
    });
  });

  describe('Close button', () => {
    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={onClose}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /Close/ }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty description handling', () => {
    it('renders empty string when description is missing', () => {
      const noDescSpell = { ...mockSpell, description: undefined };
      render(
        <SpellDetailPopup
          spell={noDescSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('renders empty string when description is empty array', () => {
      const arrDescSpell = { ...mockSpell, description: [] };
      render(
        <SpellDetailPopup
          spell={arrDescSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('joins array descriptions', () => {
      const arrDescSpell = { ...mockSpell, description: ['Line one.', 'Line two.'] };
      render(
        <SpellDetailPopup
          spell={arrDescSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      expect(screen.getByText('Line one.Line two.')).toBeInTheDocument();
    });
  });

  describe('Missing meta fields', () => {
    it('shows em dash for missing casting_time', () => {
      const spell = { ...mockSpell, casting_time: undefined };
      render(
        <SpellDetailPopup
          spell={spell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('shows em dash for missing range', () => {
      const spell = { ...mockSpell, range: undefined };
      render(
        <SpellDetailPopup
          spell={spell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('shows em dash for missing duration', () => {
      const spell = { ...mockSpell, duration: undefined };
      render(
        <SpellDetailPopup
          spell={spell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={mockUpcastLevels}
        />
      );
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('Upcast levels edge cases', () => {
    it('shows only base level when only one upcast level available', () => {
      const singleLevel = [{ level: 3, formula: '8d6', availableSlots: 2 }];
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={singleLevel}
        />
      );
      expect(screen.queryByText('Cast at Level:')).not.toBeInTheDocument();
    });

    it('shows upcast selector when exactly 2 levels available', () => {
      const twoLevels = [
        { level: 3, formula: '8d6', availableSlots: 2 },
        { level: 4, formula: '9d6', availableSlots: 1 },
      ];
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={twoLevels}
        />
      );
      expect(screen.getByText('Cast at Level:')).toBeInTheDocument();
    });

    it('selects base level when no levels have available slots', () => {
      const noAvailableSlots = [
        { level: 3, formula: '8d6', availableSlots: 0 },
        { level: 4, formula: '9d6', availableSlots: 0 },
      ];
      render(
        <SpellDetailPopup
          spell={mockSpell}
          playerStats={mockPlayerStats}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
          upcastLevels={noAvailableSlots}
        />
      );
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeChecked();
    });
  });
});
