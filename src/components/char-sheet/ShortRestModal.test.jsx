import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ShortRestModal from './ShortRestModal.jsx';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, key, _campaign) => {
        if (key === 'shortRestHitDice') return 8;
        if (key === 'currentHitPoints') return 20;
        if (key === 'sorceryPoints') return 2;
        if (key === 'sorcerousRestorationUses') return 1;
        if (key === 'bardicInspirationUses') return 2;
        if (key === 'arcaneRecoveryLevels') return 2;
        return null;
    }),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollDice: vi.fn((count, _die) => ({ total: count * 4, rolls: Array(count).fill(4) })),
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
    getHitDieSize: vi.fn(() => 8),
    computeHitDieRecovery: vi.fn((roll, conBonus) => roll + conBonus),
    SHORT_REST_RESOURCES: ['spell_slots_level_1', 'spell_slots_level_2'],
    getShortRestResourceLabels: vi.fn(() => ['Spell Slots (1st+)', 'Hit Dice']),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => ({ songOfRestDie: 6 })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 2),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => null),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadSpellData: vi.fn(() => Promise.resolve([])),
}));

const mockPlayerStats = {
    name: 'Thorin',
    level: 5,
    hitPoints: 45,
    proficiency: 3,
    abilities: [
        { name: 'Constitution', bonus: 2 },
        { name: 'Charisma', bonus: 3 },
        { name: 'Wisdom', bonus: 2 },
    ],
    class: { name: 'Cleric', major: { name: 'Cleric' } },
    automation: { passives: [], actions: [] },
    spellAbilities: {
        spell_slots_level_1: 4,
        spell_slots_level_2: 3,
        spells: [{ name: 'Healing Word', prepared: 'Prepared' }],
    },
    inventory: { equipped: [] },
};

const mockCampaignName = 'test-campaign';

describe('ShortRestModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders the modal with title', () => {
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Short Rest')).toBeInTheDocument();
    });

    it('displays hit dice info', () => {
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText(/of 5 remaining/)).toBeInTheDocument();
    });

    it('renders Roll One button', () => {
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Roll One')).toBeInTheDocument();
    });

    it('renders Roll All button', () => {
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText(/Roll All/)).toBeInTheDocument();
    });

    it('rolls hit dice and shows result when Roll One is clicked', () => {
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        fireEvent.click(screen.getByText('Roll One'));
        expect(screen.getByText('Total HP Recovered:')).toBeInTheDocument();
    });

    it('rolls all hit dice when Roll All is clicked', () => {
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        fireEvent.click(screen.getByText(/Roll All/));
        expect(screen.getByText('Total HP Recovered:')).toBeInTheDocument();
    });

    it('disables dice buttons when no hit dice remaining', () => {
        const stats = { ...mockPlayerStats };
        render(<ShortRestModal playerStats={stats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Roll One')).not.toBeDisabled();
    });

    it('renders Song of Rest button when available', () => {
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Song of Rest')).toBeInTheDocument();
    });

    it('renders Sorcerous Restoration for Sorcerer class', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
            automation: { passives: [{ type: 'resource_restoration' }] },
        };
        render(<ShortRestModal playerStats={stats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Sorcerous Restoration')).toBeInTheDocument();
    });

    it('renders Font of Inspiration for Bard with passive', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Bard', major: { name: 'Bard' } },
            automation: { passives: [{ type: 'font_of_inspiration' }] },
        };
        render(<ShortRestModal playerStats={stats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Font of Inspiration')).toBeInTheDocument();
    });

    it('renders Arcane Recovery for Wizard with passive', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Wizard', major: { name: 'Wizard' } },
            automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
        };
        render(<ShortRestModal playerStats={stats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Arcane Recovery')).toBeInTheDocument();
    });

    it('renders Memorize Spell for Wizard with passive', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Wizard', major: { name: 'Wizard' } },
            automation: { passives: [{ type: 'memorize_spell' }] },
        };
        render(<ShortRestModal playerStats={stats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Memorize Spell')).toBeInTheDocument();
    });

    it('renders Resources Restored section', () => {
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Resources Restored')).toBeInTheDocument();
    });

    it('renders Complete Short Rest button', () => {
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Complete Short Rest')).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', () => {
        const onClose = vi.fn();
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={onClose} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onComplete when Complete Short Rest is clicked', () => {
        const onComplete = vi.fn();
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} onComplete={onComplete} />);
        fireEvent.click(screen.getByText('Complete Short Rest'));
        expect(onComplete).toHaveBeenCalled();
    });

    it('handles Escape key to close', () => {
        const onClose = vi.fn();
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('renders Bolstering Treats when passive exists', () => {
        const stats = {
            ...mockPlayerStats,
            automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
        };
        render(<ShortRestModal playerStats={stats} campaignName={mockCampaignName} onClose={() => {}} />);
        expect(screen.getByText('Bolstering Treats')).toBeInTheDocument();
    });

    it('renders roll log entries in table format', () => {
        render(<ShortRestModal playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={() => {}} />);
        fireEvent.click(screen.getByText('Roll One'));
        expect(screen.getByText('Roll')).toBeInTheDocument();
        expect(screen.getByText('HP Recovered')).toBeInTheDocument();
    });
});
