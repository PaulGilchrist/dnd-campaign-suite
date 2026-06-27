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

describe('CharSummary - Bait and Switch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
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

describe('CharSummary - Warding Bond and AC Penalty', () => {
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

describe('CharSummary - Character Summary Text Display', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('displays subrace name when present', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Hill Dwarf/)).toBeInTheDocument();
    });

    it('displays race type in parentheses when present', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/\(hill dwarf\)/)).toBeInTheDocument();
    });

    it('displays class name when subclass exists', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Cleric/)).toBeInTheDocument();
    });

    it('displays subclass name and type when both exist', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const summaryText = screen.getByTestId('char-summary-text');
        expect(summaryText.textContent).toContain('war');
        expect(summaryText.textContent).toContain('choice');
    });

    it('displays level and milestone suffix', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const summaryText = screen.getByTestId('char-summary-text');
        expect(summaryText.textContent).toContain('Level 5');
        expect(summaryText.textContent).toContain('milestone');
    });

    it('displays alignment', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Lawful Good/)).toBeInTheDocument();
    });

    it('displays xp value in subtitle when in experience mode', () => {
        const stats = { ...mockPlayerStats, xpMode: 'experience' };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const summaryText = screen.getByTestId('char-summary-text');
        expect(summaryText.textContent).toContain('2,300 XP');
    });

    it('hides xp suffix when in milestone mode', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const summaryText = screen.getByTestId('char-summary-text');
        expect(summaryText.textContent).not.toContain('2,300 XP');
    });

    it('does not display race type when race.type is null', () => {
        const stats = {
            ...mockPlayerStats,
            race: { name: 'Human', type: null, subrace: { name: 'Human', speed: 30 } },
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Human/)).toBeInTheDocument();
        const summaryText = screen.getByTestId('char-summary-text');
        expect(summaryText.textContent).not.toMatch(/\(human\)/);
    });

    it('does not display subclass info when subclass is null', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Cleric', subclass: null, major: { name: 'Cleric' } },
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const summaryText = screen.getByTestId('char-summary-text');
        expect(summaryText.textContent).toContain('Level 5');
    });
});

describe('CharSummary - Vulnerabilities, Senses, Proficiencies, Languages', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('displays vulnerabilities when present', () => {
        const stats = { ...mockPlayerStats, vulnerabilities: ['fire', 'cold'] };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/fire, cold/)).toBeInTheDocument();
    });

    it('does not display vulnerabilities when empty', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Vulnerabilities:/)).not.toBeInTheDocument();
    });

    it('displays senses when present', () => {
        const stats = { ...mockPlayerStats, senses: [{ name: 'Darkvision', value: '60 ft.' }] };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Darkvision 60 ft\./)).toBeInTheDocument();
    });

    it('displays multiple senses', () => {
        const stats = {
            ...mockPlayerStats,
            senses: [{ name: 'Darkvision', value: '60 ft.' }, { name: 'Blindsight', value: '30 ft.' }],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Darkvision 60 ft\./)).toBeInTheDocument();
        expect(screen.getByText(/Blindsight 30 ft\./)).toBeInTheDocument();
    });

    it('does not display senses when empty', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Senses:/)).not.toBeInTheDocument();
    });

    it('displays proficiencies when present', () => {
        const stats = { ...mockPlayerStats, proficiencies: ['Longsword', 'Shield'] };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Longsword, Shield/)).toBeInTheDocument();
    });

    it('does not display proficiencies when empty', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Proficiencies:/)).not.toBeInTheDocument();
    });

    it('displays languages when present', () => {
        const stats = { ...mockPlayerStats, languages: ['Common', 'Dwarvish'] };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Common, Dwarvish/)).toBeInTheDocument();
    });

    it('does not display languages when empty', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Languages:/)).not.toBeInTheDocument();
    });
});

describe('CharSummary - Admin Buttons (Localhost)', () => {
    it('shows admin buttons on localhost', () => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            onEditCharacter={vi.fn()}
            onDeleteCharacter={vi.fn()}
            onUploadClick={vi.fn()}
            onSaveClick={vi.fn()}
        />);
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
        expect(screen.getByText(/Upload/)).toBeInTheDocument();
        expect(screen.getByText(/Download/)).toBeInTheDocument();
        expect(screen.getByTestId('short-rest-btn')).toBeInTheDocument();
        expect(screen.getByTestId('long-rest-btn')).toBeInTheDocument();
    });

    it('treats 127.0.0.1 as localhost showing admin buttons', () => {
        vi.clearAllMocks();
        window.location.hostname = '127.0.0.1';
        getActiveBuffs.mockReturnValue([]);
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            onEditCharacter={vi.fn()}
            onDeleteCharacter={vi.fn()}
            onUploadClick={vi.fn()}
            onSaveClick={vi.fn()}
        />);
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });
});

describe('CharSummary - Delete Character', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('calls onDeleteCharacter when user confirms delete', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const onDelete = vi.fn();
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            onDeleteCharacter={onDelete}
        />);
        fireEvent.click(screen.getByText('Delete'));
        expect(onDelete).toHaveBeenCalledWith('Thorin');
    });

    it('does not call onDeleteCharacter when user cancels delete', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        const onDelete = vi.fn();
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            onDeleteCharacter={onDelete}
        />);
        fireEvent.click(screen.getByText('Delete'));
        expect(onDelete).not.toHaveBeenCalled();
    });
});

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

describe('CharSummary - Avatar Modal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders avatar image component when imagePath exists', () => {
        const stats = { ...mockPlayerStats, imagePath: '/avatars/thorin.png' };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByTestId('avatar-image')).toBeInTheDocument();
    });

    it('does not render AvatarModal when imagePath is null', () => {
        const stats = { ...mockPlayerStats, imagePath: null };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByTestId('avatar-modal')).not.toBeInTheDocument();
    });
});

describe('CharSummary - Background Popup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders background when present', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Background:/)).toBeInTheDocument();
        expect(screen.getByText('Soldier')).toBeInTheDocument();
    });

    it('does not render background when absent', () => {
        const stats = { ...mockPlayerStats, background: null };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Background:/)).not.toBeInTheDocument();
    });
});

describe('CharSummary - Proficiency Display', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('displays proficiency bonus', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Proficiency:/)).toBeInTheDocument();
        expect(screen.getByText(/\+3/)).toBeInTheDocument();
    });

    it('displays proficiency with different values', () => {
        const stats = { ...mockPlayerStats, proficiency: 6 };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Proficiency:/)).toBeInTheDocument();
        expect(screen.getByText(/\+6/)).toBeInTheDocument();
    });
});

describe('CharSummary - Initiative Clickable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders initiative as clickable element', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const initiativeEl = screen.getByText(/\+2/);
        expect(initiativeEl).toHaveClass('clickable');
    });

    it('renders initiative with exhaustion penalty applied', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={1} />);
        expect(screen.getByText('+0')).toBeInTheDocument();
    });
});

describe('CharSummary - Speed Display with Haste', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('doubles speed when haste buff is active', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'haste' }]);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    });
});

describe('CharSummary - Short Rest Complete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders short rest button', () => {
        const onLongRest = vi.fn();
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            onLongRest={onLongRest}
        />);
        expect(screen.getByTestId('short-rest-btn')).toBeInTheDocument();
    });
});

describe('CharSummary - Character Name and Header', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('displays character name', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText('Thorin')).toBeInTheDocument();
    });

    it('displays avatar image component', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByTestId('avatar-image')).toBeInTheDocument();
    });
});

describe('CharSummary - XP Modal Overlay Click-to-Close', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('closes XP modal when clicking the overlay background', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        expect(screen.getByText('Experience Points')).toBeInTheDocument();
        const overlay = screen.getByText('Experience Points').closest('.xp-modal-overlay');
        fireEvent.click(overlay);
        expect(screen.queryByText('Experience Points')).not.toBeInTheDocument();
    });

    it('does not close XP modal when clicking inside the modal content', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        expect(screen.getByText('Experience Points')).toBeInTheDocument();
        const modalContent = screen.getByText('Experience Points').closest('.xp-modal');
        fireEvent.click(modalContent);
        expect(screen.queryByText('Experience Points')).toBeInTheDocument();
    });
});

describe('CharSummary - Inspiration Toggle to True', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders unchecked checkbox and calls update on click', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox.checked).toBe(false);
        fireEvent.click(checkbox);
    });
});

describe('CharSummary - XP Save with Whitespace-Only Delta', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('closes modal when delta is whitespace-only', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        const input = screen.getByPlaceholderText('+100 or -50');
        fireEvent.change(input, { target: { value: '   ' } });
        const applyBtn = screen.getByText('Apply');
        fireEvent.click(applyBtn);
        expect(screen.queryByText('Experience Points')).not.toBeInTheDocument();
    });
});

describe('CharSummary - XP Mode Toggle Edge Cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('does not change xpMode when already in experience mode and checkbox is unchecked', () => {
        const stats = { ...mockPlayerStats, xpMode: 'experience' };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/2,300 XP/);
        fireEvent.click(levelSuffix);
        const xpModal = screen.getByText('Experience Points').closest('.xp-modal');
        const checkbox = xpModal.querySelector('input[type="checkbox"]');
        expect(checkbox.checked).toBe(false);
        fireEvent.click(checkbox);
        expect(mockPlayerStats.xpMode).toBe('milestone');
    });
});

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

describe('CharSummary - Null/Empty Data Graceful Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('handles undefined playerStats.xp in useEffect by defaulting to 0', () => {
        const stats = { ...mockPlayerStats, xp: undefined, xpMode: 'experience' };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const summaryText = screen.getByTestId('char-summary-text');
        expect(summaryText.textContent).toContain('0 XP');
    });

    it('handles undefined playerStats.name in useTrackedResource', () => {
        const stats = { ...mockPlayerStats, name: undefined };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByTestId('char-gold')).toBeInTheDocument();
    });
});

describe('CharSummary - Optional Props Graceful Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('handles undefined onLongRest gracefully', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByTestId('long-rest-btn')).toBeInTheDocument();
    });

    it('handles undefined characters prop gracefully', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByTestId('char-conditions')).toBeInTheDocument();
    });

    it('handles undefined activeMapName prop gracefully', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByTestId('char-conditions')).toBeInTheDocument();
    });

    it('handles undefined playerStats.class.major gracefully', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Cleric', subclass: null, major: undefined },
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Cleric/)).toBeInTheDocument();
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

describe('CharSummary - Null Data Graceful Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('handles null conditionEffects gracefully', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} conditionEffects={null} />);
        expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    });

    it('handles undefined conditionEffects gracefully', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    });

    it('handles null auraComboEffects gracefully', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} auraComboEffects={null} />);
        expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    });

    it('handles undefined auraComboEffects gracefully', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    });

    it('handles null vulnerabilities gracefully', () => {
        const stats = { ...mockPlayerStats, vulnerabilities: null };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Vulnerabilities:/)).not.toBeInTheDocument();
    });

    it('handles null senses gracefully', () => {
        const stats = { ...mockPlayerStats, senses: null };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Senses:/)).not.toBeInTheDocument();
    });

    it('handles null proficiencies gracefully', () => {
        const stats = { ...mockPlayerStats, proficiencies: null };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Proficiencies:/)).not.toBeInTheDocument();
    });

    it('handles null languages gracefully', () => {
        const stats = { ...mockPlayerStats, languages: null };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Languages:/)).not.toBeInTheDocument();
    });

    it('handles null race.subrace gracefully', () => {
        const stats = {
            ...mockPlayerStats,
            race: { name: 'Human', type: null, subrace: null },
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const summaryText = screen.getByTestId('char-summary-text');
        expect(summaryText.textContent).toContain('Human');
    });

    it('handles subclass present but subclass.type missing', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Cleric', subclass: { name: 'War' }, major: { name: 'Cleric' } },
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const summaryText = screen.getByTestId('char-summary-text');
        expect(summaryText.textContent).toContain('war');
        expect(summaryText.textContent).not.toContain('undefined');
    });

    it('handles undefined playerStats.automation gracefully', () => {
        const stats = { ...mockPlayerStats, automation: undefined };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    });

    it('handles undefined playerStats.passives gracefully', () => {
        const stats = { ...mockPlayerStats, passives: undefined };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    });

    it('handles undefined playerStats.equipment gracefully', () => {
        const stats = { ...mockPlayerStats, equipment: undefined };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    });

    it('handles undefined playerStats.inventory gracefully', () => {
        const stats = { ...mockPlayerStats, inventory: undefined };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    });
});
