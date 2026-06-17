import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharSummary from './CharSummary.jsx';

vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/Popup.jsx', () => ({ default: ({ children, onClick }) => <div data-testid="popup" onClick={onClick}>{children}</div> }));
vi.mock('../../common/AvatarImage.jsx', () => ({ default: () => <div data-testid="avatar-image">Avatar</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: () => <div data-testid="short-rest-btn">Short Rest</div> }));
vi.mock('../ShortRestModal.jsx', () => ({ default: () => <div data-testid="short-rest-modal">Short Rest Modal</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
    default: vi.fn((key, name, init, _deps, _campaign) => ({ current: init(), update: vi.fn() })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    useRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
    showBackgroundPopup: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn(), rollInitiative: vi.fn() })),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
    sanitizeHtml: (html) => html,
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/rules/rulesFactory.js', () => ({
    getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

const mockPlayerStats = {
    name: 'Thorin',
    xp: 2300,
    xpMode: 'milestone',
    race: { name: 'Dwarf', type: 'Hill Dwarf', subrace: { name: 'Hill Dwarf', speed: 25 } },
    class: { name: 'Cleric', subclass: { name: 'War', type: 'Choice' }, major: { name: 'Cleric' } },
    level: 5,
    alignment: 'Lawful Good',
    proficiency: 3,
    initiative: 2,
    initiativeAdvantage: false,
    abilities: [{ name: 'Wisdom', bonus: 3 }, { name: 'Strength', bonus: 2 }],
    armorClass: 18,
    armorClassFormula: '16 + 2 (shield)',
    hitPoints: 45,
    inventory: { equipped: ['Scale Mail', 'Shield'] },
    equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }, { name: 'Shield', type: 'Shield' }],
    background: 'Soldier',
    immunities: [],
    resistances: [],
    vulnerabilities: [],
    senses: [],
    proficiencies: [],
    languages: [],
    automation: { passives: [], actions: [] },
};

const mockCampaignName = 'test-campaign';

describe('CharSummary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
    });

    it('renders character name and summary info', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
        expect(screen.getByText('Thorin')).toBeInTheDocument();
        expect(screen.getByTestId('char-summary-text')).toHaveTextContent('Hill Dwarf');
        expect(screen.getByTestId('char-summary-text')).toHaveTextContent('Level 5');
    });

    it('renders subclass info in summary', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
        expect(screen.getByTestId('char-summary-text')).toHaveTextContent('Cleric');
    });

    it('renders without subclass when not present', () => {
        const stats = { ...mockPlayerStats, class: { name: 'Fighter', major: { name: 'Fighter' } } };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByText('Thorin')).toBeInTheDocument();
    });

    it('renders XP modal when level suffix is clicked', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        expect(screen.getByText('Experience Points')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('+100 or -50')).toBeInTheDocument();
    });

    it('applies XP delta and saves when modal is submitted', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        const input = screen.getByPlaceholderText('+100 or -50');
        fireEvent.change(input, { target: { value: '500' } });
        const applyBtn = document.querySelector('.xp-modal-actions .char-btn');
        fireEvent.click(applyBtn);
        expect(input.value).toBe('500');
    });

    it('renders AC with haste bonus indicator', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
        expect(screen.getByText('Armor Class:')).toBeInTheDocument();
        expect(screen.getByText('18')).toBeInTheDocument();
    });

    it('renders speed with exhaustion penalty', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={1} />);
        expect(screen.getByText('Speed:')).toBeInTheDocument();
    });

    it('renders speed as 0 when speedZero condition is active', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            conditionEffects={{ speedZero: true }}
        />);
        expect(screen.getByText('Speed:')).toBeInTheDocument();
    });

    it('renders inspiration checkbox', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
    });

    it('renders background with clickable popup', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
        expect(screen.getByText('Soldier')).toBeInTheDocument();
    });

    it('renders resistances when present', () => {
        const stats = {
            ...mockPlayerStats,
            resistances: ['fire', 'cold'],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByText(/Resistances/)).toBeInTheDocument();
    });

    it('renders immunities when present', () => {
        const stats = {
            ...mockPlayerStats,
            immunities: ['poison'],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByText('poison')).toBeInTheDocument();
    });

    it('renders vulnerabilities when present', () => {
        const stats = {
            ...mockPlayerStats,
            vulnerabilities: ['psychic'],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByText('psychic')).toBeInTheDocument();
    });

    it('renders senses when present', () => {
        const stats = {
            ...mockPlayerStats,
            senses: [{ name: 'Darkvision', value: '60 ft.' }],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByText('Darkvision 60 ft.')).toBeInTheDocument();
    });

    it('renders proficiencies when present', () => {
        const stats = {
            ...mockPlayerStats,
            proficiencies: ['Light Armor', 'Shields'],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByText('Light Armor, Shields')).toBeInTheDocument();
    });

    it('renders languages when present', () => {
        const stats = {
            ...mockPlayerStats,
            languages: ['Common', 'Dwarvish'],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByText('Common, Dwarvish')).toBeInTheDocument();
    });

    it('renders ShortRestButton', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
        />);
        expect(screen.getByTestId('short-rest-btn')).toBeInTheDocument();
    });

    it('renders CharConditions component', () => {
        const chars = [{ name: 'Thorin', level: 5 }];
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            characters={chars}
            activeMapName="test-map"
        />);
        expect(screen.getByTestId('char-conditions')).toBeInTheDocument();
    });

    it('renders XP mode toggle in modal', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        expect(screen.getByText('Milestone Leveling')).toBeInTheDocument();
    });

    it('renders experience mode XP display', () => {
        const stats = { ...mockPlayerStats, xpMode: 'experience', xp: 2300 };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.getByText(/2,300 XP/)).toBeInTheDocument();
    });

    it('renders speed with aura speed bonus', () => {
        const stats = { ...mockPlayerStats };
        render(<CharSummary
            playerStats={stats}
            campaignName={mockCampaignName}
            auraComboEffects={{ speedBonus: 10, speedSource: 'Aura of Protection' }}
        />);
        expect(screen.getByText('Speed:')).toBeInTheDocument();
    });

    it('renders speed with aura resistance source', () => {
        const stats = { ...mockPlayerStats, resistances: ['radiant'] };
        render(<CharSummary
            playerStats={stats}
            campaignName={mockCampaignName}
            auraComboEffects={{ resistances: ['radiant'], resistanceSource: 'Aura of Protection' }}
        />);
        expect(screen.getByText('radiant')).toBeInTheDocument();
    });

    it('renders speed with aura immunity source', () => {
        const stats = { ...mockPlayerStats, immunities: ['poison'] };
        render(<CharSummary
            playerStats={stats}
            campaignName={mockCampaignName}
            auraComboEffects={{ immunities: ['poison'], immunitySources: { poison: 'Aura of Protection' } }}
        />);
        expect(screen.getByText('poison')).toBeInTheDocument();
    });
});
