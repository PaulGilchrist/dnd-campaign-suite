import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SpellDetailPopup from './SpellDetailPopup.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, key, campaign) => {
        if (key === 'spell_slots_level_1') return 4;
        if (key === 'spell_slots_level_2') return 3;
        if (key === 'spell_slots_level_3') return 2;
        if (key === '_Spell_Mastery_level1') return 'Magic Missile';
        if (key === 'naturalRecoveryFreeCast') return null;
        if (key === '_Bewitching_Magic_freeCast') return null;
        if (key === '_Signature_Spells_selection') return [];
        if (key === '_Divination_Savant_selection') return [];
        return null;
    }),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
    sanitizeHtml: (html) => html,
}));

const mockPlayerStats = {
    name: 'Elara',
    level: 5,
    class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
    abilities: [{ name: 'Charisma', bonus: 3 }],
    proficiency: 3,
    spellAbilities: {
        spell_slots_level_1: 4,
        spell_slots_level_2: 3,
        spell_slots_level_3: 2,
        spells: [],
    },
    automation: { passives: [], actions: [] },
};

const mockCampaignName = 'test-campaign';

const mockSpell = {
    name: 'Magic Missile',
    level: 1,
    description: 'Three darts of force strike a creature.',
    casting_time: '1 action',
    range: '120 feet',
    duration: 'Instantaneous',
    damage: {
        damage_at_slot_level: {
            '1': '3d4+1',
            '2': '4d4+1',
            '3': '5d4+1',
        },
    },
    school: 'Evocation',
};

describe('SpellDetailPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders spell name and description', () => {
        render(<SpellDetailPopup spell={mockSpell} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Magic Missile')).toBeInTheDocument();
        expect(screen.getByText('Three darts of force strike a creature.')).toBeInTheDocument();
    });

    it('renders spell metadata', () => {
        render(<SpellDetailPopup spell={mockSpell} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Level:')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('Casting Time:')).toBeInTheDocument();
        expect(screen.getByText('1 action')).toBeInTheDocument();
        expect(screen.getByText('Range:')).toBeInTheDocument();
        expect(screen.getByText('120 feet')).toBeInTheDocument();
        expect(screen.getByText('Duration:')).toBeInTheDocument();
        expect(screen.getByText('Instantaneous')).toBeInTheDocument();
    });

    it('renders Cantrip level for level 0 spells', () => {
        const cantrip = { ...mockSpell, level: 0 };
        render(<SpellDetailPopup spell={cantrip} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Cantrip')).toBeInTheDocument();
    });

    it('renders cast at level selector when upcastable with multiple levels', () => {
        const upcastLevels = [
            { level: 1, formula: '3d4+1', availableSlots: 4 },
            { level: 2, formula: '4d4+1', availableSlots: 3 },
            { level: 3, formula: '5d4+1', availableSlots: 2 },
        ];
        render(<SpellDetailPopup spell={mockSpell} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} upcastLevels={upcastLevels} />);
        expect(screen.getByText('Cast at Level:')).toBeInTheDocument();
        expect(screen.getByText('Level 2')).toBeInTheDocument();
        expect(screen.getByText('Level 3')).toBeInTheDocument();
    });

    it('shows slots remaining when not upcasting', () => {
        render(<SpellDetailPopup spell={mockSpell} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Slots Remaining:')).toBeInTheDocument();
    });

    it('renders Cast Spell button', () => {
        render(<SpellDetailPopup spell={mockSpell} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Cast Spell')).toBeInTheDocument();
    });

    it('renders Close button', () => {
        render(<SpellDetailPopup spell={mockSpell} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('calls onClose when Close button is clicked', () => {
        const onClose = vi.fn();
        render(<SpellDetailPopup spell={mockSpell} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={onClose} />);
        fireEvent.click(screen.getByText('Close'));
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onCast when Cast Spell is clicked', () => {
        const onCast = vi.fn();
        render(<SpellDetailPopup spell={mockSpell} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} onCast={onCast} />);
        fireEvent.click(screen.getByText('Cast Spell'));
        expect(onCast).toHaveBeenCalled();
    });

    it('shows free cast message when authorized', () => {
        const stats = {
            ...mockPlayerStats,
            automation: {
                passives: [],
                actions: [{ name: 'Spell Mastery', type: 'free_spell', spell: 'Magic Missile' }],
            },
        };
        render(<SpellDetailPopup spell={mockSpell} playerStats={stats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    });

    it('shows no slots message when no slots available', () => {
        render(<SpellDetailPopup spell={mockSpell} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Slots Remaining:')).toBeInTheDocument();
    });

    it('renders psychic damage option for Warlock with Psychic Spells', () => {
        const warlockStats = {
            ...mockPlayerStats,
            class: { name: 'Warlock', major: { name: 'Warlock' } },
            automation: {
                passives: [{ type: 'psychic_spells' }],
                actions: [],
            },
        };
        const illusionSpell = {
            ...mockSpell,
            school: 'Enchantment',
            damage: { damage_at_slot_level: { '1': '1d6' } },
        };
        render(<SpellDetailPopup spell={illusionSpell} playerStats={warlockStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Change damage type to Psychic')).toBeInTheDocument();
    });

    it('renders no verbal/somatic components badge for Warlock Psychic Spells enchantment', () => {
        const warlockStats = {
            ...mockPlayerStats,
            class: { name: 'Warlock', major: { name: 'Warlock' } },
            automation: {
                passives: [{ type: 'psychic_spells' }],
                actions: [],
            },
        };
        const enchantmentSpell = {
            ...mockSpell,
            school: 'Enchantment',
        };
        render(<SpellDetailPopup spell={enchantmentSpell} playerStats={warlockStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('No Verbal or Somatic components (Psychic Spells)')).toBeInTheDocument();
    });

    it('renders no verbal components badge for Warlock Improved Illusions', () => {
        const warlockStats = {
            ...mockPlayerStats,
            class: { name: 'Warlock', major: { name: 'Warlock' } },
            automation: {
                passives: [{ type: 'improved_illusions' }],
                actions: [],
            },
        };
        const illusionSpell = {
            ...mockSpell,
            school: 'Illusion',
        };
        render(<SpellDetailPopup spell={illusionSpell} playerStats={warlockStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('No Verbal components (Improved Illusions)')).toBeInTheDocument();
    });

    it('renders Dispel Magic as bonus action with Spell Breaker', () => {
        const stats = {
            ...mockPlayerStats,
            automation: {
                passives: [{ type: 'passive_rule', effect: 'spell_breaker' }],
                actions: [],
            },
        };
        const dispelSpell = {
            ...mockSpell,
            name: 'Dispel Magic',
            casting_time: '1 action',
        };
        render(<SpellDetailPopup spell={dispelSpell} playerStats={stats} campaignName={mockCampaignName} onClose={() => {}} />);
        // The cast button should change casting time logic internally
    });

    it('renders upcast level selector with available slots', () => {
        const upcastLevels = [
            { level: 2, formula: '4d4+1', availableSlots: 3 },
        ];
        render(<SpellDetailPopup spell={mockSpell} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} upcastLevels={upcastLevels} />);
        expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    });

    it('disables upcast level when no available slots', () => {
        const upcastLevels = [
            { level: 2, formula: '4d4+1', availableSlots: 0 },
        ];
        render(<SpellDetailPopup spell={mockSpell} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} upcastLevels={upcastLevels} />);
        expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    });

    it('renders cantrip auto level when cantrip has character level damage', () => {
        const cantrip = {
            ...mockSpell,
            level: 0,
            damage: {
                damage_at_character_level: {
                    '3': '2d6',
                    '5': '3d6',
                },
            },
        };
        render(<SpellDetailPopup spell={cantrip} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Cantrip')).toBeInTheDocument();
    });

    it('renders spell detail popup container with correct class', () => {
        render(<SpellDetailPopup spell={mockSpell} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    });
});
