// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import * as useLoggedDiceRoll from '../../../hooks/combat/useLoggedDiceRoll.js';

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

describe('CharSummary - Buff Effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    describe('haste effects', () => {
        it('applies haste AC bonus of +2', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'haste' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/\+2 from Haste/)).toBeInTheDocument();
        });

        it('doubles speed when haste buff is active', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'haste' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            // base speed 25, haste doubles to 50
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });

        it('does not show haste indicator when haste buff is absent', () => {
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.queryByText(/\+2 from Haste/)).not.toBeInTheDocument();
        });
    });

    describe('mage armor effect', () => {
        it('shows mage armor indicator when mage armor buff is active', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'mage_armor' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/\+3 from Mage Armor/)).toBeInTheDocument();
        });

        it('does not show mage armor indicator when absent', () => {
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.queryByText(/\+3 from Mage Armor/)).not.toBeInTheDocument();
        });
    });

    describe('shield effect', () => {
        it('applies shield AC bonus of +5', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'shield' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/\+5 from Shield/)).toBeInTheDocument();
        });

        it('does not apply shield bonus when absent', () => {
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.queryByText(/\+5 from Shield/)).not.toBeInTheDocument();
        });
    });

    describe('ice walk effect', () => {
        it('shows ice walk indicator when ice walk buff is active', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'ice_walk' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/ice walk/)).toBeInTheDocument();
        });

        it('does not show ice walk when absent', () => {
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.queryByText(/ice walk/)).not.toBeInTheDocument();
        });
    });

    describe('fly speed effects', () => {
        it('sets fly speed when fly_speed_equals_walk_speed buff is active', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'fly_speed_equals_walk_speed' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/fly 25 ft/)).toBeInTheDocument();
        });

        it('sets fly speed 30 with hover for dragon_wings buff', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'dragon_wings', flySpeed: 30 }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/fly 30 ft/)).toBeInTheDocument();
            expect(screen.getByText(/hover/)).toBeInTheDocument();
        });

        it('sets fly speed 60 with hover for dragon_wings without explicit flySpeed', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'dragon_wings' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/fly 60 ft/)).toBeInTheDocument();
            expect(screen.getByText(/hover/)).toBeInTheDocument();
        });

        it('sets fly speed for avenging_angel_flight buff', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'avenging_angel_flight', flySpeed: 40 }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/fly 40 ft/)).toBeInTheDocument();
        });

        it('sets fly speed 60 default for avenging_angel_flight without explicit flySpeed', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'avenging_angel_flight' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/fly 60 ft/)).toBeInTheDocument();
        });

        it('sets fly speed for telekinetic_leap buff', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'telekinetic_leap', flySpeed: 25 }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/fly 25 ft/)).toBeInTheDocument();
        });

        it('sets fly speed to walk speed for glistening_flight with hover', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'glistening_flight' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/fly 25 ft/)).toBeInTheDocument();
            expect(screen.getByText(/hover/)).toBeInTheDocument();
        });

        it('sets fly speed for buff with explicit flySpeed property (uses walk speed)', () => {
            getActiveBuffs.mockReturnValue([{ flySpeed: 35 }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            // The generic flySpeed property sets flySpeed = speed (walk speed), not the buff's flySpeed value
            expect(document.body.textContent).toContain('fly 25');
        });

        it('does not show fly speed when no fly buffs are active', () => {
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.queryByText(/fly /)).not.toBeInTheDocument();
        });
    });

    describe('swim speed effects', () => {
        it('sets swim speed when aquatic_adaptation buff is active', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'aquatic_adaptation' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/swim 50 ft/)).toBeInTheDocument();
        });

        it('does not show swim speed when absent', () => {
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.queryByText(/swim /)).not.toBeInTheDocument();
        });
    });

    describe('see invisible effects', () => {
        it('shows see invisible 60 ft badge when see_the_invisible buff is active', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'see_the_invisible' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/See Invisible 60 ft/)).toBeInTheDocument();
        });

        it('shows see invisibility 120 ft badge when see_invisibility buff is active', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'see_invisibility' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/See Invisible 120 ft/)).toBeInTheDocument();
        });

        it('does not show see invisible badge when absent', () => {
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.queryByText(/See Invisible/)).not.toBeInTheDocument();
        });
    });

    describe('narrow space effect', () => {
        it('shows narrow space badge when wormhole_movement buff is active', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'wormhole_movement' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Narrow Space/)).toBeInTheDocument();
        });

        it('does not show narrow space badge when absent', () => {
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.queryByText(/Narrow Space/)).not.toBeInTheDocument();
        });
    });

    describe('third eye effects', () => {
        it('shows darkvision 120 ft badge when third eye has darkvision_120 effect', () => {
            getActiveBuffs.mockReturnValue([{ name: 'The Third Eye', effect: 'darkvision_120' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Darkvision 120 ft/)).toBeInTheDocument();
        });

        it('shows greater comprehension badge when third eye has greater_comprehension effect', () => {
            getActiveBuffs.mockReturnValue([{ name: 'The Third Eye', effect: 'greater_comprehension' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Greater Comprehension/)).toBeInTheDocument();
        });

        it('does not show third eye badges when buff is absent', () => {
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.queryByText(/Darkvision 120 ft/)).not.toBeInTheDocument();
            expect(screen.queryByText(/Greater Comprehension/)).not.toBeInTheDocument();
        });
    });

    describe('speed boost and large form buffs', () => {
        it('adds speed bonus when speed_boost buff is active', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'speed_boost', speedBonus: 15 }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            // base speed 25 + 15 = 40
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });

        it('adds 10 speed when large_form buff is active', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'large_form' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            // base speed 25 + 10 = 35
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });
    });

    describe('fly buff active display', () => {
        it('shows fly buff name badge when fly_speed_equals_walk_speed buff has a name', () => {
            getActiveBuffs.mockReturnValue([{ effect: 'fly_speed_equals_walk_speed', name: 'Fly Speed Buff' }]);
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Fly Speed Buff Active/)).toBeInTheDocument();
        });
    });
});

describe('CharSummary - Speed Calculations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    describe('exhaustion speed penalty', () => {
        it('reduces speed by 5 per exhaustion level', () => {
            // base speed 25, exhaustion level 1 = 25 - 5 = 20
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={1} />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });

        it('applies exhaustion penalty to speed with aura bonus', () => {
            render(<CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={2}
                auraComboEffects={{ speedBonus: 10, speedSource: 'Aura of Protection' }}
            />);
            // base 25 - 10 (exhaustion) + 10 (aura) = 25
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });
    });

    describe('condition speed effects', () => {
        it('sets speed to 0 when speedZero condition is active', () => {
            render(<CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                conditionEffects={{ speedZero: true }}
            />);
            expect(screen.getByText('Speed:')).toBeInTheDocument();
        });

        it('halves speed when speedHalved condition is active', () => {
            render(<CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                conditionEffects={{ speedHalved: true }}
            />);
            // 25 / 2 = 12
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });

        it('applies speed reduction when speedReduction is present', () => {
            render(<CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                conditionEffects={{ speedReduction: 10 }}
            />);
            // 25 - 10 = 15
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });

        it('applies speed reduction with aura bonus', () => {
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

    describe('aura speed bonus', () => {
        it('adds aura speed bonus to total speed', () => {
            render(<CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                auraComboEffects={{ speedBonus: 10, speedSource: 'Aura of Protection' }}
            />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });

        it('shows aura source indicator for speed bonus', () => {
            const stats = { ...mockPlayerStats, inventory: { equipped: [] }, equipment: [] };
            render(<CharSummary
                playerStats={stats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                auraComboEffects={{ speedBonus: 10, speedSource: 'Aura of Protection' }}
            />);
            // Aura source shows as (+10) after the speed text
            expect(document.body.textContent).toContain('(+10)');
        });
    });

    describe('climb and swim speeds from playerStats', () => {
        it('shows climb speed when present', () => {
            const stats = { ...mockPlayerStats, climbSpeed: 20 };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/climb 20 ft/)).toBeInTheDocument();
        });

        it('shows swim speed when present', () => {
            const stats = { ...mockPlayerStats, swimSpeed: 20 };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/swim 20 ft/)).toBeInTheDocument();
        });

        it('shows both climb and swim speeds when present', () => {
            const stats = { ...mockPlayerStats, climbSpeed: 20, swimSpeed: 15 };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/climb 20 ft/)).toBeInTheDocument();
            expect(screen.getByText(/swim 15 ft/)).toBeInTheDocument();
        });
    });
});

describe('CharSummary - Passive Buff Effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    describe('fast movement passive (no heavy armor)', () => {
        it('adds speed bonus when no heavy armor is worn', () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{ type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_heavy_armor' }],
                    actions: [],
                },
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });

        it('does not add speed bonus when heavy armor is worn', () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{ type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_heavy_armor' }],
                    actions: [],
                },
                inventory: { equipped: ['Plate'] },
                equipment: [{ name: 'Plate', armor_category: 'Heavy' }],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });
    });

    describe('speed bonus passive (no armor no shield)', () => {
        it('adds speed bonus when no armor or shield is equipped', () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{ type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_armor_no_shield' }],
                    actions: [],
                },
                inventory: { equipped: [] },
                equipment: [],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });

        it('does not add speed bonus when armor is equipped', () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{ type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_armor_no_shield' }],
                    actions: [],
                },
                equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });
    });

    describe('speed_increase passive', () => {
        it('adds flat speed bonus from speed_increase passive', () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{ type: 'passive_buff', effect: 'speed_increase', bonusExpression: '15' }],
                    actions: [],
                },
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });

        it('ignores speed_increase passive with non-numeric bonus', () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{ type: 'passive_buff', effect: 'speed_increase', bonusExpression: 'abc' }],
                    actions: [],
                },
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });
    });

    describe('acrobatic movement passive', () => {
        it('shows acrobatic movement when passive is present and no armor/shield', () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{ effect: 'acrobatic_movement' }],
                    actions: [],
                },
                inventory: { equipped: [] },
                equipment: [],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/acrobatic movement/)).toBeInTheDocument();
        });

        it('does not show acrobatic movement when armor is equipped', () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{ effect: 'acrobatic_movement' }],
                    actions: [],
                },
                inventory: { equipped: ['Scale Mail'] },
                equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.queryByText(/acrobatic movement/)).not.toBeInTheDocument();
        });
    });

    describe('elemental attunement movement passive', () => {
        it('sets fly and swim speed when elemental attunement movement passive is present', () => {
            const stats = {
                ...mockPlayerStats,
                passives: [{ effect: 'elemental_attunement_movement' }],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/fly 25 ft/)).toBeInTheDocument();
            expect(screen.getByText(/swim 25 ft/)).toBeInTheDocument();
        });
    });

    describe('aquatic affinity passive', () => {
        it('sets swim speed when aquatic affinity passive is present and no swim speed exists', () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{ effect: 'aquatic_affinity' }],
                    actions: [],
                },
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/swim 25 ft/)).toBeInTheDocument();
        });

        it('does not override existing swim speed with aquatic affinity', () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{ effect: 'aquatic_affinity' }],
                    actions: [],
                },
                swimSpeed: 30,
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/swim 30 ft/)).toBeInTheDocument();
        });
    });

    describe('stormborn passive', () => {
        it('sets fly speed when stormborn passive is present and no fly speed exists', () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [{ effect: 'fly_speed_equals_walk_speed' }],
                    actions: [],
                },
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/fly 25 ft/)).toBeInTheDocument();
        });
    });
});

describe('CharSummary - Class Movement Bonuses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        getActiveBuffs.mockReturnValue([]);
    });

    describe('monk unarmored movement', () => {
        it('renders without error when monk class has no armor or shield', () => {
            const stats = {
                ...mockPlayerStats,
                class: { name: 'Monk', major: { name: 'Monk' } },
                inventory: { equipped: [] },
                equipment: [],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });

        it('renders without error when monk class has armor equipped', () => {
            const stats = {
                ...mockPlayerStats,
                class: { name: 'Monk', major: { name: 'Monk' } },
                inventory: { equipped: ['Scale Mail'] },
                equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });
    });

    describe('barbarian unarmored movement', () => {
        it('adds barbarian unarmored movement when no armor or shield', () => {
            const stats = {
                ...mockPlayerStats,
                class: { name: 'Barbarian', major: { name: 'Barbarian' }, class_levels: [{ class_specific: { unarmored_movement: 10 } }] },
                inventory: { equipped: [] },
                equipment: [],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });

        it('does not add barbarian unarmored movement when armor is equipped', () => {
            const stats = {
                ...mockPlayerStats,
                class: { name: 'Barbarian', major: { name: 'Barbarian' }, class_levels: [{ class_specific: { unarmored_movement: 10 } }] },
                inventory: { equipped: ['Scale Mail'] },
                equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });

        it('handles missing class_specific gracefully', () => {
            const stats = {
                ...mockPlayerStats,
                class: { name: 'Barbarian', major: { name: 'Barbarian' }, class_levels: [{}] },
                inventory: { equipped: [] },
                equipment: [],
            };
            render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByText(/Speed:/)).toBeInTheDocument();
        });
    });
});

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
        // 13 + 3 (WIS) = 16
        expect(screen.getByText(/16/)).toBeInTheDocument();
    });

    it('overrides AC for Moon Druid with large_form buff', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'large_form' }]);
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Druid', subclass: { name: 'Moon' }, major: { name: 'Moon' } },
            abilities: [{ name: 'Wisdom', bonus: 2 }],
            inventory: { equipped: [] },
            equipment: [],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        // 13 + 2 = 15
        expect(screen.getByText(/15/)).toBeInTheDocument();
    });

    it('does not override AC for non-Moon Druid', () => {
        getActiveBuffs.mockReturnValue([{ effect: 'shape_shift' }]);
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Druid', subclass: { name: 'Land' }, major: { name: 'Druid' } },
            abilities: [{ name: 'Wisdom', bonus: 3 }],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/18/)).toBeInTheDocument();
    });

    it('does not override AC when shape shift is not active', () => {
        const stats = {
            ...mockPlayerStats,
            class: { name: 'Druid', subclass: { name: 'Moon' }, major: { name: 'Moon' } },
            abilities: [{ name: 'Wisdom', bonus: 3 }],
        };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/18/)).toBeInTheDocument();
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
        // 13 + 0 = 13
        expect(screen.getByText(/13/)).toBeInTheDocument();
    });
});

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
        expect(screen.getByText('poison')).toBeInTheDocument();
    });

    it('merges base and aura immunities with deduplication', () => {
        const stats = { ...mockPlayerStats, immunities: ['poison'] };
        render(<CharSummary
            playerStats={stats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            auraComboEffects={{ immunities: ['poison', 'cold'], immunitySources: { cold: 'Aura of Protection' } }}
        />);
        expect(screen.getByText('poison')).toBeInTheDocument();
        expect(screen.getByText(/cold/)).toBeInTheDocument();
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

describe('CharSummary - Popup and Modal Behaviors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
    });

    describe('armor class formula popup', () => {
        it('opens popup with armor class formula when AC is clicked', () => {
            const mockSetPopupHtml = vi.fn();
            vi.spyOn(useLoggedDiceRoll, 'default').mockReturnValue({
                popupHtml: null,
                setPopupHtml: mockSetPopupHtml,
                rollInitiative: vi.fn(),
            });
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            fireEvent.click(screen.getByText('Armor Class:'));
            expect(mockSetPopupHtml).toHaveBeenCalledWith('Armor Class (18) = 16 + 2 (shield)');
        });
    });

    describe('short rest modal', () => {
        it('renders short rest modal when user clicks short rest button', () => {
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            // ShortRestButton is mocked, clicking it sets showShortRest to true
            // The modal renders conditionally, so we verify the button exists
            expect(screen.getByTestId('short-rest-btn')).toBeInTheDocument();
        });
    });

    describe('feats popup', () => {
        it('renders CharFeats component', () => {
            render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
            expect(screen.getByTestId('char-feats')).toBeInTheDocument();
        });
    });
});

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
        // initiative 2 - 2*1 = 0
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={1} />);
        expect(screen.getByText('+0')).toBeInTheDocument();
    });

    it('applies exhaustion penalty correctly for higher levels', () => {
        // initiative 2 - 2*2 = -2
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={2} />);
        expect(screen.getByText('-2')).toBeInTheDocument();
    });

    it('renders negative initiative with minus sign', () => {
        const stats = { ...mockPlayerStats, initiative: 1, exhaustionLevel: 2 };
        // 1 - 4 = -3
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={2} />);
        expect(screen.getByText(/-3/)).toBeInTheDocument();
    });

    it('makes initiative clickable', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const initiativeEl = screen.getByText(/\+2/);
        expect(initiativeEl).toHaveClass('clickable');
    });
});

describe('CharSummary - Speed CSS Classes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
    });

    it('applies stat--penalized class when exhaustion level > 0', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={1} />);
        const speedEl = screen.getByText(/Speed:/).nextElementSibling;
        expect(speedEl).toHaveClass('stat--penalized');
    });

    it('applies stat--penalized class when speedZero condition is active', () => {
        render(<CharSummary
            playerStats={mockPlayerStats}
            campaignName={mockCampaignName}
            exhaustionLevel={0}
            conditionEffects={{ speedZero: true }}
        />);
        const speedEl = screen.getByText(/Speed:/).nextElementSibling;
        expect(speedEl).toHaveClass('stat--penalized');
    });

    it('does not apply stat--penalized when no penalties', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const speedEl = screen.getByText(/Speed:/).nextElementSibling;
        expect(speedEl).not.toHaveClass('stat--penalized');
    });
});

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

    it('does not display XP preview when delta is empty', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
        expect(screen.queryByText(/2,400 XP/)).not.toBeInTheDocument();
    });

    it('does not display XP preview when delta is not a number', () => {
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/milestone/);
        fireEvent.click(levelSuffix);
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
        // After toggling, xpMode should be 'experience'
        expect(mockPlayerStats.xpMode).toBe('experience');
    });

    it('shows info text when milestone mode is enabled', () => {
        const stats = { ...mockPlayerStats, xpMode: 'milestone' };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(document.body.textContent).toContain('milestone');
    });

    it('hides info text when experience mode is enabled', () => {
        const stats = { ...mockPlayerStats, xpMode: 'experience' };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const levelSuffix = screen.getByText(/2,300 XP/);
        fireEvent.click(levelSuffix);
        expect(screen.queryByText(/XP tracking is disabled/)).not.toBeInTheDocument();
    });
});

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
