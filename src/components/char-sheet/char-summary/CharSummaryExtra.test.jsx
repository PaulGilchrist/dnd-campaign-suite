// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import useLoggedDiceRoll from '../../../hooks/combat/useLoggedDiceRoll.js';
import * as useActionPopup from '../../../hooks/combat/useActionPopup.js';

vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
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
    default: {
        getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
    },
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
    inventory: { equipped: ['Scale Mail', 'Shield'], gold: 100 },
    equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }, { name: 'Shield', type: 'Shield' }],
    background: 'Soldier',
    immunities: [],
    resistances: [],
    vulnerabilities: [],
    senses: [],
    proficiencies: [],
    languages: [],
    automation: { passives: [], actions: [] },
    passives: [],
};

const mockCampaignName = 'test-campaign';

// ---------------------------------------------------------------------------
// Bait and Switch AC bonus — unique to this file (not in CharSummary.test.jsx)
// ---------------------------------------------------------------------------
describe('CharSummary - Bait and Switch AC Bonus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
        vi.mocked(useRuntimeValue).mockReturnValue(null);
    });

    it('shows bait and switch AC bonus when active with bonus value', () => {
        vi.mocked(useRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === 'baitAndSwitchActive') return true;
            if (key === 'baitAndSwitchBonus') return 3;
            if (key === 'baitAndSwitchSource') return 'Bait and Switch';
            return null;
        });
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/\+3 from Bait and Switch/)).toBeInTheDocument();
    });

    it('shows bait and switch AC bonus with custom source name', () => {
        vi.mocked(useRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === 'baitAndSwitchActive') return true;
            if (key === 'baitAndSwitchBonus') return 5;
            if (key === 'baitAndSwitchSource') return 'Trickster';
            return null;
        });
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/\+5 from Trickster/)).toBeInTheDocument();
    });

    it('does not show bait and switch AC bonus when not active', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/from Bait and Switch/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Warding Bond and Slow spell AC modifiers — unique to this file
// ---------------------------------------------------------------------------
describe('CharSummary - Warding Bond and Slow Spell AC Modifiers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('shows warding bond AC bonus when present in conditionEffects', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={{ wardingBondAcBonus: 2 }}
        />);
        expect(screen.getByText(/\+2 from Warding Bond/)).toBeInTheDocument();
    });

    it('shows slow spell AC penalty when present in conditionEffects', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={{ acPenalty: 2 }}
        />);
        expect(screen.getByText(/\(−2 from Slow\)/)).toBeInTheDocument();
    });

    it('shows both warding bond bonus and slow penalty combined', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={{ wardingBondAcBonus: 2, acPenalty: 2 }}
        />);
        expect(screen.getByText(/\+2 from Warding Bond/)).toBeInTheDocument();
        expect(screen.getByText(/\(−2 from Slow\)/)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Inspiration toggle — unique to this file
// ---------------------------------------------------------------------------
describe('CharSummary - Inspiration Toggle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders checkbox as unchecked when inspiration is false', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox.checked).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// XP save behavior — unique to this file (CharSummary.test.jsx only covers display)
// ---------------------------------------------------------------------------
describe('CharSummary - XP Save Behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('saves XP delta when user enters positive value and applies', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        const input = screen.getByPlaceholderText('+100 or -50');
        fireEvent.change(input, { target: { value: '500' } });
        const applyBtn = screen.getByText('Apply');
        fireEvent.click(applyBtn);
        expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'xp', 2800, 'test-campaign');
    });

    it('saves XP delta when user enters negative value', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        const input = screen.getByPlaceholderText('+100 or -50');
        fireEvent.change(input, { target: { value: '-300' } });
        const applyBtn = screen.getByText('Apply');
        fireEvent.click(applyBtn);
        expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'xp', 2000, 'test-campaign');
    });

    it('clamps XP to minimum of 0', () => {
        const stats = { ...mockPlayerStats, xp: 100 };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/\(milestone\)/);
        fireEvent.click(levelSuffix);
        const input = screen.getByPlaceholderText('+100 or -50');
        fireEvent.change(input, { target: { value: '-500' } });
        const applyBtn = screen.getByText('Apply');
        fireEvent.click(applyBtn);
        expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'xp', 0, 'test-campaign');
    });

    it('closes modal when delta is empty string', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        const cancelBtn = screen.getByText('Cancel');
        fireEvent.click(cancelBtn);
        expect(screen.queryByText('Experience Points')).not.toBeInTheDocument();
    });

    it('closes modal when delta is non-numeric', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        const input = screen.getByPlaceholderText('+100 or -50');
        fireEvent.change(input, { target: { value: 'abc' } });
        const applyBtn = screen.getByText('Apply');
        fireEvent.click(applyBtn);
        expect(screen.queryByText('Experience Points')).not.toBeInTheDocument();
    });

    it('updates displayXp when playerStats.xp changes via useEffect', async () => {
        const stats = { ...mockPlayerStats, xpMode: 'experience' };
        const { rerender } = render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const newStats = { ...stats, xp: 9999 };
        rerender(<CharSummary playerStats={newStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const summaryText = screen.getByTestId('char-summary-text');
        expect(summaryText.textContent).toContain('9,999');
    });
});

// ---------------------------------------------------------------------------
// Initiative roll with advantage — unique to this file
// ---------------------------------------------------------------------------
describe('CharSummary - Initiative Roll with Advantage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('calls rollInitiative with forcedMode advantage when initiativeAdvantage is true', () => {
        const mockRollInitiative = vi.fn();
        vi.mocked(useLoggedDiceRoll).mockReturnValue({ rollInitiative: mockRollInitiative });
        const stats = { ...mockPlayerStats, initiativeAdvantage: true };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const initiativeEl = screen.getByText(/\+2/);
        fireEvent.click(initiativeEl);
        expect(mockRollInitiative).toHaveBeenCalledWith(2, { forcedMode: 'advantage' });
    });

    it('calls rollInitiative without forcedMode when initiativeAdvantage is false', () => {
        const mockRollInitiative = vi.fn();
        vi.mocked(useLoggedDiceRoll).mockReturnValue({ rollInitiative: mockRollInitiative });
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const initiativeEl = screen.getByText(/\+2/);
        fireEvent.click(initiativeEl);
        expect(mockRollInitiative).toHaveBeenCalledWith(2, undefined);
    });
});

// ---------------------------------------------------------------------------
// Background popup call — unique to this file
// ---------------------------------------------------------------------------
describe('CharSummary - Background Popup Call', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('calls showBackgroundPopup with correct params when background is clicked', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const backgroundEl = screen.getByText('Soldier');
        fireEvent.click(backgroundEl);
        expect(useActionPopup.showBackgroundPopup).toHaveBeenCalledWith('Soldier', expect.any(Function), '5e');
    });
});

// ---------------------------------------------------------------------------
// Speed aura combo edge cases — unique to this file (not in CharSummary.test.jsx)
// ---------------------------------------------------------------------------
describe('CharSummary - Speed Aura Combo Edge Cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('handles speed halved with aura bonus', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={{ speedHalved: true }}
            auraComboEffects={{ speedBonus: 10, speedSource: 'Aura of Protection' }}
        />);
        expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    });

    it('handles speed zero with aura bonus', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={{ speedZero: true }}
            auraComboEffects={{ speedBonus: 10, speedSource: 'Aura of Protection' }}
        />);
        expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    });

    it('handles speed reduction with aura bonus', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={{ speedReduction: 10 }}
            auraComboEffects={{ speedBonus: 5, speedSource: 'Aura of Protection' }}
        />);
        expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    });
});
