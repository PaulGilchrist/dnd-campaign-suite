// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { DiceRollContext } from '../../../hooks/combat/DiceRollContext.js';
import { useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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
    passives: [],
    exhaustionLevel: 0,
};

const mockCampaignName = 'test-campaign';

// ---------------------------------------------------------------------------
// Buff effects: parameterized to cover all buff types in fewer tests
// ---------------------------------------------------------------------------
describe('CharSummary - Buff Effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        [{ effect: 'haste' }, /\+2 from Haste/],
        [{ effect: 'mage_armor' }, /\+3 from Mage Armor/],
        [{ effect: 'shield' }, /\+5 from Shield/],
        [{ effect: 'ice_walk' }, /ice walk/],
        [{ effect: 'see_the_invisible' }, /See Invisible 60 ft/],
        [{ effect: 'see_invisibility' }, /See Invisible 120 ft/],
        [{ effect: 'wormhole_movement' }, /Narrow Space/],
        [{ name: 'The Third Eye', effect: 'darkvision_120' }, /Darkvision 120 ft/],
        [{ name: 'The Third Eye', effect: 'greater_comprehension' }, /Greater Comprehension/],
    ])('shows indicator for %j buff effect', (buff, expectedText) => {
        getActiveBuffs.mockReturnValue([buff]);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it.each([
        [{ effect: 'fly_speed_equals_walk_speed' }, /fly 25 ft/],
        [{ effect: 'dragon_wings', flySpeed: 30 }, /fly 30 ft/],
        [{ effect: 'avenging_angel_flight', flySpeed: 40 }, /fly 40 ft/],
        [{ effect: 'telekinetic_leap', flySpeed: 25 }, /fly 25 ft/],
        [{ effect: 'glistening_flight' }, /fly 25 ft/],
    ])('sets fly speed when %j buff is active', (buff, expectedText) => {
        getActiveBuffs.mockReturnValue([buff]);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it('shows hover for dragon_wings and glistening_flight buffs', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'dragon_wings', flySpeed: 30 }]);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/hover/)).toBeInTheDocument();
    });

    it('sets swim speed when aquatic_adaptation buff is active', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'aquatic_adaptation' }]);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/swim 50 ft/)).toBeInTheDocument();
    });

    it('shows fly buff name badge when fly_speed_equals_walk_speed buff has a name', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'fly_speed_equals_walk_speed', name: 'Fly Speed Buff' }]);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Fly Speed Buff Active/)).toBeInTheDocument();
    });

    it.each([
        [{ effect: 'speed_boost', speedBonus: 15 }, /40 ft/],
        [{ effect: 'large_form' }, /35 ft/],
    ])('applies speed bonus for %j buff', (buff, expectedSpeed) => {
        getActiveBuffs.mockReturnValue([buff]);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const speedEl = screen.getByText(/Speed:/).nextElementSibling;
        expect(speedEl.textContent).toMatch(expectedSpeed);
    });
});

// ---------------------------------------------------------------------------
// Speed calculations
// ---------------------------------------------------------------------------
describe('CharSummary - Speed Calculations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        [1, '20 ft', 'exhaustion level 1'],
        [2, '15 ft', 'exhaustion level 2'],
    ])('reduces speed by 5 per exhaustion level (%s)', (level, expectedSpeed, _desc) => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={level} />);
        const speedEl = screen.getByText(/Speed:/).nextElementSibling;
        expect(speedEl.textContent).toContain(expectedSpeed);
    });

    it.each([
        [{ speedHalved: true }, '12 ft'],
        [{ speedReduction: 10 }, '15 ft'],
    ])('applies condition speed effect %j', (effects, expectedSpeed) => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={effects}
        />);
        const speedEl = screen.getByText(/Speed:/).nextElementSibling;
        expect(speedEl.textContent).toContain(expectedSpeed);
    });

    it.each([
        [{ climbSpeed: 20 }, /climb 20 ft/],
        [{ swimSpeed: 20 }, /swim 20 ft/],
    ])('shows movement speed from playerStats when %j is present', (extra, expectedText) => {
        const stats = { ...mockPlayerStats, ...extra };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it('shows both climb and swim speeds when present', () => {
        const stats = { ...mockPlayerStats, climbSpeed: 20, swimSpeed: 15 };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/climb 20 ft/)).toBeInTheDocument();
        expect(screen.getByText(/swim 15 ft/)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Passive movement effects
// ---------------------------------------------------------------------------
describe('CharSummary - Passive Buff Effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        [
            { passives: [{ type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_heavy_armor' }] },
            { equipped: [], equipment: [] },
            '35 ft',
            'no heavy armor',
        ],
        [
            { passives: [{ type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_heavy_armor' }] },
            { equipped: ['Plate'], equipment: [{ name: 'Plate', armor_category: 'Heavy' }] },
            '25 ft',
            'heavy armor worn',
        ],
    ])('applies speed_bonus no_heavy_armor condition: %s', (_passives, equipment, expectedSpeed, _desc) => {
        const stats = {
            ...mockPlayerStats,
            automation: { ...mockPlayerStats.automation, passives: _passives.passives },
            inventory: { equipped: equipment.equipped },
            equipment: equipment.equipment,
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const speedEl = screen.getByText(/Speed:/).nextElementSibling;
        expect(speedEl.textContent).toContain(expectedSpeed);
    });

    it.each([
        [
            { passives: [{ type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_armor_no_shield' }] },
            { equipped: [], equipment: [] },
            '35 ft',
        ],
        [
            { passives: [{ type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_armor_no_shield' }] },
            { equipped: ['Scale Mail'], equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }] },
            '25 ft',
        ],
    ])('applies speed_bonus no_armor_no_shield condition', (_passives, equipment, expectedSpeed) => {
        const stats = {
            ...mockPlayerStats,
            automation: { ...mockPlayerStats.automation, passives: _passives.passives },
            inventory: { equipped: equipment.equipped },
            equipment: equipment.equipment,
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const speedEl = screen.getByText(/Speed:/).nextElementSibling;
        expect(speedEl.textContent).toContain(expectedSpeed);
    });

    it('adds flat speed bonus from speed_increase passive', () => {
        const stats = {
            ...mockPlayerStats,
            automation: {
                ...mockPlayerStats.automation,
                passives: [{ type: 'passive_buff', effect: 'speed_increase', bonusExpression: '15' }],
            },
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const speedEl = screen.getByText(/Speed:/).nextElementSibling;
        expect(speedEl.textContent).toContain('40 ft');
    });

    it.each([
        [false, /acrobatic movement/],
        [true, null],
    ])('shows acrobatic movement badge when %s and no armor/shield', (hasArmorOrShield, expectedText) => {
        const stats = {
            ...mockPlayerStats,
            automation: {
                ...mockPlayerStats.automation,
                passives: [{ effect: 'acrobatic_movement' }],
            },
            inventory: { equipped: hasArmorOrShield ? ['Scale Mail'] : [] },
            equipment: hasArmorOrShield ? [{ name: 'Scale Mail', equipment_category: 'Armor' }] : [],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        if (expectedText) {
            expect(screen.getByText(expectedText)).toBeInTheDocument();
        } else {
            expect(screen.queryByText(/acrobatic movement/)).not.toBeInTheDocument();
        }
    });

    it('sets fly and swim speed when elemental attunement movement passive is present', () => {
        const stats = {
            ...mockPlayerStats,
            passives: [{ effect: 'elemental_attunement_movement' }],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/fly 25 ft/)).toBeInTheDocument();
        expect(screen.getByText(/swim 25 ft/)).toBeInTheDocument();
    });

    it('applies aquatic_affinity when swimSpeed is not set', () => {
        const stats = {
            ...mockPlayerStats,
            automation: {
                ...mockPlayerStats.automation,
                passives: [{ effect: 'aquatic_affinity' }],
            },
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/swim 25 ft/)).toBeInTheDocument();
    });

    it('does not override existing swim speed with aquatic_affinity', () => {
        const stats = {
            ...mockPlayerStats,
            automation: {
                ...mockPlayerStats.automation,
                passives: [{ effect: 'aquatic_affinity' }],
            },
            swimSpeed: 30,
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/swim 30 ft/)).toBeInTheDocument();
    });

    it('sets fly speed when stormborn passive is present and no fly speed exists', () => {
        const stats = {
            ...mockPlayerStats,
            automation: {
                ...mockPlayerStats.automation,
                passives: [{ effect: 'fly_speed_equals_walk_speed' }],
            },
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/fly 25 ft/)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Class movement bonuses
// ---------------------------------------------------------------------------
describe('CharSummary - Class Movement Bonuses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        [
            { equipped: [], equipment: [] },
            '35 ft',
            'no armor or shield',
        ],
        [
            { equipped: ['Scale Mail'], equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }] },
            '25 ft',
            'armor equipped',
        ],
    ])('adds barbarian unarmored movement when %s', (_equipment, expectedSpeed, _desc) => {
        const stats = {
            ...mockPlayerStats,
            level: 1,
            class: { name: 'Barbarian', major: { name: 'Barbarian' }, class_levels: [{ class_specific: { unarmored_movement: 10 } }] },
            inventory: { equipped: _equipment.equipped },
            equipment: _equipment.equipment,
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const speedEl = screen.getByText(/Speed:/).nextElementSibling;
        expect(speedEl.textContent).toContain(expectedSpeed);
    });

    it('handles missing class_specific gracefully', () => {
        const stats = {
            ...mockPlayerStats,
            level: 1,
            class: { name: 'Barbarian', major: { name: 'Barbarian' }, class_levels: [{}] },
            inventory: { equipped: [] },
            equipment: [],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const speedEl = screen.getByText(/Speed:/).nextElementSibling;
        expect(speedEl.textContent).toContain('25 ft');
    });
});

// ---------------------------------------------------------------------------
// Circle Forms AC override
// ---------------------------------------------------------------------------
describe('CharSummary - Circle Forms AC Override', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it('overrides AC for Moon Druid with shape shift buff', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'shape_shift' }]);
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Druid', subclass: { name: 'Moon' }, major: { name: 'Moon' } },
            abilities: [{ name: 'Wisdom', bonus: 3 }],
            inventory: { equipped: [] },
            equipment: [],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText((content, element) => element?.tagName === 'DIV' && element.className?.includes('clickable') && content.includes('16'))).toBeInTheDocument();
    });

    it('does not override AC for non-Moon Druid or when shape shift is inactive', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'shape_shift' }]);
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Druid', subclass: { name: 'Land' }, major: { name: 'Druid' } },
            abilities: [{ name: 'Wisdom', bonus: 3 }],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText((content, element) => element?.tagName === 'DIV' && element.className?.includes('clickable') && content.includes('18'))).toBeInTheDocument();
    });

    it('handles missing wisdom ability gracefully', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'shape_shift' }]);
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Druid', subclass: { name: 'Moon' }, major: { name: 'Moon' } },
            abilities: [],
            inventory: { equipped: [] },
            equipment: [],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText((content, element) => element?.tagName === 'DIV' && element.className?.includes('clickable') && content.includes('13'))).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Aura sources
// ---------------------------------------------------------------------------
describe('CharSummary - Aura Sources', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
    });

    it('shows aura resistance source marker', () => {
        const stats = { ...mockPlayerStats, resistances: ['radiant'] };
        render(<CharSummary
            playerStats={stats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            auraComboEffects={{ resistances: ['radiant'], resistanceSource: 'Aura of Protection' }}
        />);
        expect(screen.getByText('radiant')).toBeInTheDocument();
    });

    it('shows aura immunity source marker', () => {
        const stats = { ...mockPlayerStats, immunities: ['poison'] };
        render(<CharSummary
            playerStats={stats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            auraComboEffects={{ immunities: ['poison'], immunitySources: { poison: 'Aura of Protection' } }}
        />);
        expect(screen.getByText('Poison')).toBeInTheDocument();
    });

    it('merges base and aura immunities with deduplication', () => {
        const stats = { ...mockPlayerStats, immunities: ['poison'] };
        render(<CharSummary
            playerStats={stats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            auraComboEffects={{ immunities: ['poison', 'cold'], immunitySources: { cold: 'Aura of Protection' } }}
        />);
        expect(screen.getByText('Poison')).toBeInTheDocument();
        expect(screen.getByText(/Cold/)).toBeInTheDocument();
    });

    it('merges base and aura resistances with deduplication', () => {
        const stats = { ...mockPlayerStats, resistances: ['fire'] };
        render(<CharSummary
            playerStats={stats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            auraComboEffects={{ resistances: ['fire', 'cold'], resistanceSource: 'Aura of Protection' }}
        />);
        expect(screen.getByText('fire')).toBeInTheDocument();
        expect(screen.getByText(/cold/)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Popup and modal behaviors
// ---------------------------------------------------------------------------
describe('CharSummary - Popup and Modal Behaviors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
    });

    describe('armor class formula popup', () => {
        it('opens popup with armor class formula when AC is clicked', () => {
            const mockSetPopupHtml = vi.fn();
            const wrapper = ({ children }) => (
                <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
                    {children}
                </DiceRollContext.Provider>
            );
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />, { wrapper });
            fireEvent.click(screen.getByText('Armor Class:'));
            expect(mockSetPopupHtml).toHaveBeenCalledWith('Armor Class (18) = 16 + 2 (shield)');
        });
    });
});

// ---------------------------------------------------------------------------
// Initiative
// ---------------------------------------------------------------------------
describe('CharSummary - Initiative', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
    });

    it('renders initiative with sign formatter', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/\+2/)).toBeInTheDocument();
    });

    it('applies exhaustion penalty to initiative', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={1} />);
        expect(screen.getByText('+0')).toBeInTheDocument();
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={2} />);
        expect(screen.getByText('-2')).toBeInTheDocument();
        const stats = { ...mockPlayerStats, initiative: 1 };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={2} />);
        expect(screen.getByText(/-3/)).toBeInTheDocument();
    });

    it('makes initiative clickable', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const initiativeEl = screen.getByText(/\+2/);
        expect(initiativeEl).toHaveClass('clickable');
    });
});

// ---------------------------------------------------------------------------
// Speed CSS classes
// ---------------------------------------------------------------------------
describe('CharSummary - Speed CSS Classes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
    });

    it.each([
        [{ exhaustionLevel: 1 }, true, 'exhaustion level > 0'],
        [{ exhaustionLevel: 0, conditionEffects: { speedZero: true } }, true, 'speedZero condition'],
        [{ exhaustionLevel: 0, conditionEffects: {} }, false, 'no penalties'],
    ])('applies stat--penalized class when %s', (_props, expectedClass, _desc) => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            {..._props}
        />);
        const speedEl = screen.getByText(/Speed:/).nextElementSibling;
        if (expectedClass) {
            expect(speedEl).toHaveClass('stat--penalized');
        } else {
            expect(speedEl).not.toHaveClass('stat--penalized');
        }
    });
});

// ---------------------------------------------------------------------------
// XP modal display
// ---------------------------------------------------------------------------
describe('CharSummary - XP Modal Display', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
    });

    it('displays XP preview when delta is entered', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        const input = screen.getByPlaceholderText('+100 or -50');
        fireEvent.change(input, { target: { value: '100' } });
        expect(screen.getByText(/2,400 XP/)).toBeInTheDocument();
    });

    it('does not display XP preview when delta is empty or non-numeric', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        expect(screen.queryByText(/2,400 XP/)).not.toBeInTheDocument();
        const input = screen.getByPlaceholderText('+100 or -50');
        fireEvent.change(input, { target: { value: 'abc' } });
        expect(screen.queryByText(/2,400 XP/)).not.toBeInTheDocument();
    });

    it('toggles milestone checkbox when unchecked switches to experience mode', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        const xpModal = screen.getByText('Experience Points').closest('.xp-modal');
        const checkbox = xpModal.querySelector('input[type="checkbox"]');
        fireEvent.click(checkbox);
        expect(mockPlayerStats.xpMode).toBe('experience');
    });

    it('hides info text when experience mode is enabled', () => {
        const stats = { ...mockPlayerStats, xpMode: 'experience' };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/2,300 XP/);
        fireEvent.click(levelSuffix);
        expect(screen.queryByText(/XP tracking is disabled/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Bait and Switch AC Bonus
// ---------------------------------------------------------------------------
describe('CharSummary - Bait and Switch AC Bonus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
        vi.mocked(useRuntimeValue).mockReturnValue(null);
    });

    it.each([
        [3, 'Bait and Switch', /\+3 from Bait and Switch/],
        [5, 'Trickster', /\+5 from Trickster/],
    ])('shows bait and switch AC bonus with value %i from %s', (bonus, source, expectedText) => {
        vi.mocked(useRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === 'baitAndSwitchActive') return true;
            if (key === 'baitAndSwitchBonus') return bonus;
            if (key === 'baitAndSwitchSource') return source;
            return null;
        });
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(new RegExp(expectedText))).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Warding Bond and Slow spell AC modifiers
// ---------------------------------------------------------------------------
describe('CharSummary - Warding Bond and Slow Spell AC Modifiers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        [{ wardingBondAcBonus: 2 }, /\+2 from Warding Bond/],
        [{ acPenalty: 2 }, /\(−2 from Slow\)/],
    ])('shows AC modifier when conditionEffects %j is present', (effects, expectedRegex) => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={effects}
        />);
        expect(screen.getByText(expectedRegex)).toBeInTheDocument();
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
// useEffect behaviors
// ---------------------------------------------------------------------------
describe('CharSummary - useEffect behaviors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
    });

    it('updates displayXp when playerStats.xp changes', () => {
        const { rerender } = render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const newStats = { ...mockPlayerStats, xp: 5000 };
        rerender(<CharSummary playerStats={newStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/5,000 XP/)).toBeInTheDocument();
    });
});
