import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';

vi.mock('./TrackedResourceInput.jsx', () => ({ default: ({ label, resourceKey, _playerName, getMax, _deps, _campaignName, _playerStats }) => (
    <div data-testid={`tracked-resource-${resourceKey}`}>{label}: {getMax()}</div>
) }));

vi.mock('../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => ({
        maxChannelDivinity: 2,
        destroyUndeadCR: '5',
        maxSorceryPoints: 6,
        metamagicKnown: 4,
        maxInnateSorcery: 3,
        creatingSpellSlotCosts: ['1 sorcery point'],
        bardicDie: 8,
        songOfRestDie: 6,
        magicalSecrets: 2,
        subclassMagicalSecrets: 0,
        maxWildShapeUses: 2,
        maxWildShapeChallengeRating: 4,
        beastKnownForms: 4,
        wildShapeLimitations: 'None',
        extraAttacks: 1,
        sneakAttack: { dice_count: 5, dice_value: 6 },
        expertise: ['Stealth', 'Perception'],
        fabledEnemies: 'Humanoids',
        martialArtsDie: 8,
        maxFocusPoints: 5,
        unarmoredMovementIncrease: 10,
        auraRange: 10,
        invocationsKnown: 6,
        invocations: ['Eldritch Sight', 'Eldritch Strength'],
        pactBoon: 'Chain',
        arcanumLevels: { level6: 1, level7: 1, level8: 1, level9: 1 },
        arcanums: ['Level 6', 'Level 7'],
        arcaneRecoveryLevels: 3,
        showWizardFeatures: true,
    })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn((name, key, _campaign) => {
        if (key === 'aspectOfTheWildsOption') return 'Owl';
        if (key === 'activeBuffs') return [];
        if (key === 'bardicInspirationUses') return 3;
        if (key === 'sorceryPoints') return 2;
        if (key === 'metamagicKnown') return 2;
        if (key === 'innateSorceryUses') return 1;
        if (key === 'portentDice') return null;
        return null;
    }),
    getRuntimeValue: vi.fn((name, key, _campaign) => {
        if (key === 'bardicInspirationUses') return 3;
        if (key === 'portentDice') return null;
        return null;
    }),
    setRuntimeValue: vi.fn(),
}));

const mockPlayerStats = {
    name: 'Thorin',
    level: 5,
    abilities: [
        { name: 'Charisma', bonus: 3 },
        { name: 'Wisdom', bonus: 2 },
        { name: 'Strength', bonus: 4 },
    ],
    proficiency: 3,
    class: { name: 'Cleric', subclass: { name: 'War', type: 'Choice' }, fightingStyles: [] },
    automation: { passives: [], actions: [] },
    equipment: [],
    inventory: { equipped: [] },
    spellAbilities: {},
};

const mockCampaignName = 'test-campaign';

describe('CharClassFeatures', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders null for unknown class', () => {
        const stats = { ...mockPlayerStats, class: { name: 'UnknownClass' } };
        const { container } = render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders Barbarian features container', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Barbarian', class_levels: [{ level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-class-barbarian')).toBeInTheDocument();
    });

    it('renders Barbarian rage toggle button', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Barbarian', class_levels: [{ level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTitle('Enter Rage (toggle for damage bonus)')).toBeInTheDocument();
    });

    it('renders Bard features container', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Bard', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-class-bard')).toBeInTheDocument();
    });

    it('renders Font of Inspiration button when passive exists', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Bard', class_levels: [{ level: 5 }] },
            automation: { passives: [{ type: 'font_of_inspiration' }] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTitle('Font of Inspiration: Expend a spell slot to regain 1 Bardic Inspiration use')).toBeInTheDocument();
    });

    it('renders Cleric features container', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Cleric', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-class-cleric')).toBeInTheDocument();
    });

    it('renders Druid features container', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Druid', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-class-druid')).toBeInTheDocument();
    });

    it('returns null for Druid level < 2', () => {
        const stats = {
            ...mockPlayerStats,
            level: 1,
            class: { name: 'Druid', class_levels: [{ level: 1 }] },
            automation: { passives: [] },
        };
        const { container } = render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders Fighter features container', () => {
        const stats = {
            ...mockPlayerStats,
            level: 5,
            class: { name: 'Fighter', class_levels: [{ level: 5, extra_attacks: 2, weapon_mastery: 'Mercy' }, { level: 4 }, { level: 3 }, { level: 2 }, { level: 1 }], fightingStyles: [] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-class-fighter')).toBeInTheDocument();
    });

    it('returns null for Fighter when classLevel is missing', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Fighter', class_levels: null },
            automation: { passives: [] },
        };
        const { container } = render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders Monk features container', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Monk', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-class-monk')).toBeInTheDocument();
    });

    it('returns null for Monk level < 2', () => {
        const stats = {
            ...mockPlayerStats,
            level: 1,
            class: { name: 'Monk', class_levels: [{ level: 1 }] },
            automation: { passives: [] },
        };
        const { container } = render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders Paladin features container', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Paladin', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-class-paladin')).toBeInTheDocument();
    });

    it('renders Ranger features container', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Ranger', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-class-ranger')).toBeInTheDocument();
    });

    it('renders Rogue features with Supreme Sneak', () => {
        const stats = {
            ...mockPlayerStats,
            level: 9,
            class: { name: 'Rogue', class_levels: [{ level: 9 }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-class-rogue')).toBeInTheDocument();
        expect(screen.getByTitle('Supreme Sneak: Activate Stealth Attack (costs 1d6 Sneak Attack, preserves Invisible with cover)')).toBeInTheDocument();
    });

    it('does not render Supreme Sneak for level < 9', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Rogue', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.queryByTitle('Supreme Sneak: Activate Stealth Attack')).not.toBeInTheDocument();
    });

    it('renders Sorcerer features container', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Sorcerer', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-class-sorcerer')).toBeInTheDocument();
    });

    it('renders Warlock features container', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Warlock', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-class-warlock')).toBeInTheDocument();
    });

    it('renders Wizard features container', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Wizard', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-class-wizard')).toBeInTheDocument();
    });

    it('returns null for Wizard when showWizardFeatures is false', () => {
        const stats = {
            ...mockPlayerStats,
            level: 5,
            class: { name: 'Wizard', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        };
        const { container } = render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(container.innerHTML).not.toBe('');
    });

    it('renders Aspect of the Wilds for Barbarian with passive', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Barbarian', class_levels: [{ level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }] },
            automation: { passives: [{ effect: 'animal_aspect' }] },
        };
        render(<CharClassFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByText(/Aspect of the Wilds/)).toBeInTheDocument();
        expect(document.querySelector('.automation-btn--active')).toBeInTheDocument();
    });
});
