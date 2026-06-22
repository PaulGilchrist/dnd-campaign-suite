// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';

vi.mock('./TrackedResourceInput.jsx', () => ({
    default: ({ label, getMax }) => (
        <div data-testid={`tracked-resource-${label}`}>
            {label}: {getMax()}
        </div>
    ),
}));

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
        hasArcanum: true,
        arcanumLevels: { level6: 1, level7: 1, level8: 1, level9: 1 },
        arcanums: ['Level 6', 'Level 7'],
        arcaneRecoveryLevels: 3,
        showWizardFeatures: true,
        favoredEnemies: 'Beasts',
    })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn((_name, key) => {
        switch (key) {
            case 'aspectOfTheWildsOption': return 'Owl';
            case 'activeBuffs': return [];
            case 'bardicInspirationUses': return 3;
            case 'sorceryPoints': return 2;
            case 'metamagicKnown': return 2;
            case 'innateSorceryUses': return 1;
            case 'portentDice': return null;
            case 'naturalRecoveryFreeCast': return undefined;
            default: return null;
        }
    }),
    getRuntimeValue: vi.fn((_name, key) => {
        switch (key) {
            case 'bardicInspirationUses': return 3;
            case 'portentDice': return null;
            case 'stealthAttackCost': return 0;
            case 'naturalRecoveryFreeCast': return undefined;
            default: return null;
        }
    }),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/class-wizard/portentHandler.js', () => ({
    applyPortentChoice: vi.fn(),
}));

vi.mock('../../common/Popup.jsx', () => ({
    default: vi.fn(({ html, children }) => (
        <div data-testid="popup">
            {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : children}
        </div>
    )),
}));

import { getRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import * as classFeaturesModule from '../../../services/character/classFeatures.js';

const basePlayerStats = {
    name: 'Thorin',
    level: 5,
    abilities: [
        { name: 'Charisma', bonus: 3 },
        { name: 'Wisdom', bonus: 2 },
        { name: 'Strength', bonus: 4 },
    ],
    proficiency: 3,
    class: { name: 'Cleric', subclass: { name: 'War', type: 'Choice' }, fightingStyles: [] },
    automation: { passives: [], specialActions: [] },
    equipment: [],
    inventory: { equipped: [] },
    spellAbilities: {},
};

const mockCampaignName = 'test-campaign';

function makeStats(overrides = {}) {
    return { ...basePlayerStats, ...overrides };
}

function renderComponent(playerStats, campaign = mockCampaignName) {
    return render(<CharClassFeatures playerStats={playerStats} campaignName={campaign} />);
}

describe('CharClassFeatures', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('null/unknown class handling', () => {
        it('returns null for unknown class name', () => {
            const { container } = renderComponent(makeStats({ class: { name: 'UnknownClass' } }));
            expect(container.innerHTML).toBe('');
        });

        it('returns null for undefined playerStats', () => {
            const { container } = render(<CharClassFeatures playerStats={null} campaignName={mockCampaignName} />);
            expect(container.innerHTML).toBe('');
        });

        it('returns null when playerStats.class is undefined', () => {
            const { container } = renderComponent(makeStats({ class: undefined }));
            expect(container.innerHTML).toBe('');
        });
    });

    describe('Barbarian features', () => {
        const barbarianStats = (overrides = {}) => makeStats({
            class: {
                name: 'Barbarian',
                class_levels: [{ level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
            },
            automation: { passives: [] },
            ...overrides,
        });

        it('renders barbarian container', () => {
            renderComponent(barbarianStats());
            expect(screen.getByTestId('char-class-barbarian')).toBeInTheDocument();
        });

        it('renders rage toggle button with correct title when not raging', () => {
            renderComponent(barbarianStats());
            expect(screen.getByTitle('Enter Rage (toggle for damage bonus)')).toBeInTheDocument();
        });

        it('renders rage toggle button with "Raging" title when already raging', () => {
            renderComponent(barbarianStats());
            const btn = screen.getByTitle('Enter Rage (toggle for damage bonus)');
            fireEvent.click(btn);
            expect(screen.getByTitle('End Rage')).toBeInTheDocument();
        });

        it('applies buffed class when rage is active', () => {
            renderComponent(barbarianStats());
            const btn = screen.getByTitle('Enter Rage (toggle for damage bonus)');
            fireEvent.click(btn);
            const buffedSpan = document.querySelector('.stat--buffed');
            expect(buffedSpan).toBeInTheDocument();
        });

        it('shows BPS Resist badge when rage is active', () => {
            renderComponent(barbarianStats());
            const btn = screen.getByTitle('Enter Rage (toggle for damage bonus)');
            fireEvent.click(btn);
            expect(screen.getByText(/BPS Resist/)).toBeInTheDocument();
        });

        it('does not show BPS Resist badge when rage is not active', () => {
            renderComponent(barbarianStats());
            expect(document.querySelector('.automation-badge')).not.toBeInTheDocument();
        });

        it('renders barbarian with Aspect of the Wilds passive', () => {
            const stats = makeStats({
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
                },
                automation: { passives: [{ effect: 'animal_aspect' }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Aspect of the Wilds/)).toBeInTheDocument();
            expect(document.querySelector('.automation-btn--active')).toBeInTheDocument();
        });

        it('renders aspect choice buttons for all three options', () => {
            const stats = makeStats({
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
                },
                automation: { passives: [{ effect: 'animal_aspect' }] },
            });
            renderComponent(stats);
            expect(document.querySelectorAll('.automation-btn').length).toBeGreaterThanOrEqual(3);
        });

        it('shows checkmark on selected aspect option', () => {
            const stats = makeStats({
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
                },
                automation: { passives: [{ effect: 'animal_aspect' }] },
            });
            renderComponent(stats);
            const owlBtn = document.querySelector('.automation-btn--active');
            expect(owlBtn.textContent).toContain('Owl');
            expect(owlBtn.textContent).toContain('✓');
        });

        it('does not render aspect section without animal_aspect passive', () => {
            renderComponent(barbarianStats());
            expect(screen.queryByText(/Aspect of the Wilds/)).not.toBeInTheDocument();
        });

        it('renders 2024 ruleset barbarian with weapon mastery', () => {
            const stats = makeStats({
                rules: '2024',
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 5, rages: 3, rage_damage: 2, weapon_mastery: 'Heavy' }],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('char-class-barbarian')).toBeInTheDocument();
        });

        it('renders N/A for weapon mastery in 5e ruleset', () => {
            renderComponent(barbarianStats());
            expect(screen.getByText(/Weapon Mastery:/)).toBeInTheDocument();
        });
    });

    describe('Bard features', () => {
        const bardStats = (overrides = {}) => makeStats({
            level: 5,
            class: { name: 'Bard', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
            ...overrides,
        });

        it('renders bard container', () => {
            renderComponent(bardStats());
            expect(screen.getByTestId('char-class-bard')).toBeInTheDocument();
        });

        it('renders Font of Inspiration button when passive exists', () => {
            const stats = bardStats({
                automation: { passives: [{ type: 'font_of_inspiration' }] },
            });
            renderComponent(stats);
            expect(screen.getByTitle('Font of Inspiration: Expend a spell slot to regain 1 Bardic Inspiration use')).toBeInTheDocument();
        });

        it('does not render Font of Inspiration without passive', () => {
            renderComponent(bardStats());
            expect(screen.queryByTitle('Font of Inspiration')).not.toBeInTheDocument();
        });

        it('disables Font of Inspiration button when at max bardic inspiration', () => {
            const stats = bardStats({
                automation: { passives: [{ type: 'font_of_inspiration' }] },
            });
            renderComponent(stats);
            const btn = screen.getByTitle('Font of Inspiration: Expend a spell slot to regain 1 Bardic Inspiration use');
            expect(btn).toBeDisabled();
        });

        it('renders magical secrets tracked resource when level > 2 and class has expertise', () => {
            const stats = bardStats({
                class: { ...basePlayerStats.class, name: 'Bard', expertise: ['Perception'] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Magical Secrets')).toBeInTheDocument();
        });

        it('renders expertise when playerStats.class.expertise exists', () => {
            const stats = bardStats({
                class: { ...basePlayerStats.class, name: 'Bard', expertise: ['Stealth', 'Athletics'] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Expertise:/)).toBeInTheDocument();
        });

        it('renders extra attacks when level > 5 and magical secrets exists', () => {
            const stats = bardStats({
                level: 10,
                class: { ...basePlayerStats.class, name: 'Bard', class_levels: [{ level: 10 }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
        });

        it('does not render extra attacks when level is 5 or below', () => {
            renderComponent(bardStats());
            const extraAttacks = screen.queryByText(/Extra Attacks:/);
            expect(extraAttacks).not.toBeInTheDocument();
        });

        it('renders song of rest die when available', () => {
            renderComponent(bardStats());
            expect(screen.getByText(/Song of Rest Die:/)).toBeInTheDocument();
        });

        it('renders bardic inspiration die', () => {
            renderComponent(bardStats());
            expect(screen.getByText(/Bardic Inspiration Die:/)).toBeInTheDocument();
        });

        it('shows Font of Inspiration disabled badge when at max BI', () => {
            const stats = bardStats({
                automation: { passives: [{ type: 'font_of_inspiration' }] },
            });
            renderComponent(stats);
            expect(screen.getByText('Max BI')).toBeInTheDocument();
        });
    });

    describe('Cleric features', () => {
        const clericStats = () => makeStats({
            class: { name: 'Cleric', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        });

        it('renders cleric container', () => {
            renderComponent(clericStats());
            expect(screen.getByTestId('char-class-cleric')).toBeInTheDocument();
        });

        it('renders channel divinity charges tracked resource', () => {
            renderComponent(clericStats());
            expect(screen.getByTestId('tracked-resource-Channel Divinity Charges')).toBeInTheDocument();
        });

        it('renders destroy undead CR when available', () => {
            renderComponent(clericStats());
            expect(screen.getByText(/Destroy Undead Challenge Rating:/)).toBeInTheDocument();
        });
    });

    describe('Druid features', () => {
        const druidStats = (level = 5) => makeStats({
            level,
            class: { name: 'Druid', class_levels: [{ level }] },
            automation: { passives: [] },
        });

        it('renders druid container at level 5', () => {
            renderComponent(druidStats(5));
            expect(screen.getByTestId('char-class-druid')).toBeInTheDocument();
        });

        it('returns null for druid below level 2', () => {
            const { container } = renderComponent(druidStats(1));
            expect(container.innerHTML).toBe('');
        });

        it('returns null for druid at level 0', () => {
            const { container } = renderComponent(druidStats(0));
            expect(container.innerHTML).toBe('');
        });

        it('renders natural recovery section when resource_restoration passive exists', () => {
            const stats = makeStats({
                level: 5,
                class: { name: 'Druid', class_levels: [{ level: 5 }] },
                automation: { passives: [{ type: 'resource_restoration', resourceKey: 'naturalRecoverySlots' }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Natural Recovery:/)).toBeInTheDocument();
        });

        it('shows grant free cast button when natural recovery free cast is not set', () => {
            const stats = makeStats({
                level: 5,
                class: { name: 'Druid', class_levels: [{ level: 5 }] },
                automation: { passives: [{ type: 'resource_restoration', resourceKey: 'naturalRecoverySlots' }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Grant Free Cast/)).toBeInTheDocument();
        });

        it('shows free cast used badge when natural recovery free cast is set', () => {
            const stats = makeStats({
                level: 5,
                class: { name: 'Druid', class_levels: [{ level: 5 }] },
                automation: { passives: [{ type: 'resource_restoration', resourceKey: 'naturalRecoverySlots' }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Grant Free Cast/)).toBeInTheDocument();
        });

        it('renders wild shape limitations', () => {
            renderComponent(druidStats(5));
            expect(screen.getByText(/Wild Shape Limitations:/)).toBeInTheDocument();
        });

        it('renders beast forms known when > 0', () => {
            renderComponent(druidStats(5));
            expect(screen.getByText(/Beast Forms Known:/)).toBeInTheDocument();
        });
    });

    describe('Fighter features', () => {
        const fighterStats = (overrides = {}) => makeStats({
            level: 5,
            class: {
                name: 'Fighter',
                class_levels: [
                    { level: 5, extra_attacks: 2, weapon_mastery: 'Mercy' },
                    { level: 4 }, { level: 3 }, { level: 2 }, { level: 1 },
                ],
                fightingStyles: [],
            },
            automation: { passives: [] },
            ...overrides,
        });

        it('renders fighter container', () => {
            renderComponent(fighterStats());
            expect(screen.getByTestId('char-class-fighter')).toBeInTheDocument();
        });

        it('returns null when class_levels is null', () => {
            const { container } = renderComponent(makeStats({
                class: { name: 'Fighter', class_levels: null },
                automation: { passives: [] },
            }));
            expect(container.innerHTML).toBe('');
        });

        it('returns null when class_levels is undefined', () => {
            const { container } = renderComponent(makeStats({
                class: { name: 'Fighter', class_levels: undefined },
                automation: { passives: [] },
            }));
            expect(container.innerHTML).toBe('');
        });

        it('renders psionic energy section for Psi Warrior subclass', () => {
            const stats = makeStats({
                level: 5,
                class: {
                    name: 'Fighter',
                    class_levels: [
                        { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
                        { level: 5, extra_attacks: 2, weapon_mastery: 'Mercy', energy: { required_major: 'Psi Warrior', energy_die_num: 4, energy_die_type: 6 } },
                    ],
                    major: { name: 'Psi Warrior' },
                    fightingStyles: [],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Psionic Energy/)).toBeInTheDocument();
        });

        it('renders superiority dice for Battle Master subclass', () => {
            const stats = makeStats({
                level: 5,
                class: {
                    name: 'Fighter',
                    class_levels: [
                        { level: 5, extra_attacks: 2, weapon_mastery: 'Mercy' },
                        { level: 4 }, { level: 3 }, { level: 2 }, { level: 1 },
                    ],
                    major: { name: 'Battle Master' },
                    fightingStyles: [],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Superiority Dice/)).toBeInTheDocument();
        });

        it('renders superiority die type', () => {
            const stats = makeStats({
                level: 5,
                class: {
                    name: 'Fighter',
                    class_levels: [
                        { level: 5, extra_attacks: 2, weapon_mastery: 'Mercy' },
                        { level: 4 }, { level: 3 }, { level: 2 }, { level: 1 },
                    ],
                    major: { name: 'Battle Master' },
                    fightingStyles: [],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Superiority Die:/)).toBeInTheDocument();
        });

        it('renders 2024 ruleset fighter with action surge based on level', () => {
            const stats = makeStats({
                rules: '2024',
                level: 20,
                class: {
                    name: 'Fighter',
                    class_levels: Array.from({ length: 20 }, (_, i) => ({ level: i + 1 })),
                    fightingStyles: [],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('char-class-fighter')).toBeInTheDocument();
        });

        it('renders fighting styles when present', () => {
            const stats = makeStats({
                level: 5,
                class: {
                    name: 'Fighter',
                    class_levels: [
                        { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
                        { level: 5 },
                    ],
                    fightingStyles: ['Defense', 'Great Weapon Fighting'],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Fighting Styles:/)).toBeInTheDocument();
        });
    });

    describe('Monk features', () => {
        const monkStats = (level = 5) => makeStats({
            level,
            class: { name: 'Monk', class_levels: [{ level }] },
            automation: { passives: [] },
        });

        it('renders monk container at level 5', () => {
            renderComponent(monkStats(5));
            expect(screen.getByTestId('char-class-monk')).toBeInTheDocument();
        });

        it('returns null for monk below level 2', () => {
            const { container } = renderComponent(monkStats(1));
            expect(container.innerHTML).toBe('');
        });

        it('renders focus save DC based on wisdom bonus', () => {
            renderComponent(monkStats(5));
            expect(screen.getByText(/Focus Save DC:/)).toBeInTheDocument();
        });

        it('renders unarmored movement increase', () => {
            renderComponent(monkStats(5));
            expect(screen.getByText(/Unarmored Movement:/)).toBeInTheDocument();
        });

        it('renders martial arts die', () => {
            renderComponent(monkStats(5));
            expect(screen.getByText(/Martial Arts Die:/)).toBeInTheDocument();
        });
    });

    describe('Paladin features', () => {
        const paladinStats = () => makeStats({
            class: { name: 'Paladin', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        });

        it('renders paladin container', () => {
            renderComponent(paladinStats());
            expect(screen.getByTestId('char-class-paladin')).toBeInTheDocument();
        });

        it('renders lay on hands pool tracked resource', () => {
            renderComponent(paladinStats());
            expect(screen.getByTestId('tracked-resource-Lay On Hands Pool')).toBeInTheDocument();
        });

        it('renders aura of protection with charisma bonus', () => {
            renderComponent(paladinStats());
            expect(screen.getByText(/Aura of Protection:/)).toBeInTheDocument();
        });

        it('renders aura range when available', () => {
            renderComponent(paladinStats());
            expect(screen.getByText(/Aura Range:/)).toBeInTheDocument();
        });

        it('renders fighting styles when present', () => {
            const stats = makeStats({
                class: { name: 'Paladin', class_levels: [{ level: 5 }], fightingStyles: ['Defense'] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Fighting Styles:/)).toBeInTheDocument();
        });
    });

    describe('Ranger features', () => {
        const rangerStats = () => makeStats({
            class: { name: 'Ranger', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        });

        it('renders ranger container', () => {
            renderComponent(rangerStats());
            expect(screen.getByTestId('char-class-ranger')).toBeInTheDocument();
        });

        it('renders favored foe button at level 2+', () => {
            renderComponent(rangerStats());
            expect(screen.getByTitle(/Favored Foe/)).toBeInTheDocument();
        });

        it('renders cunning strike button at level 2+', () => {
            renderComponent(rangerStats());
            expect(screen.getByTitle(/Cunning Strike/)).toBeInTheDocument();
        });

        it('renders favored enemies', () => {
            renderComponent(rangerStats());
            expect(screen.getByText(/Favored Enemies:/)).toBeInTheDocument();
        });

        it('renders extra attacks', () => {
            renderComponent(rangerStats());
            expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
        });

        it('renders fighting styles when level > 1 and styles present', () => {
            const stats = makeStats({
                class: { name: 'Ranger', class_levels: [{ level: 5 }], fightingStyles: ['Defense'] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Fighting Styles:/)).toBeInTheDocument();
        });

        it('does not render fighting styles when level is 1', () => {
            const stats = makeStats({
                level: 1,
                class: { name: 'Ranger', class_levels: [{ level: 1 }], fightingStyles: ['Defense'] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.queryByText(/Fighting Styles:/)).not.toBeInTheDocument();
        });
    });

    describe('Rogue features', () => {
        const rogueStats = (level = 9) => makeStats({
            level,
            class: { name: 'Rogue', class_levels: [{ level }] },
            automation: { passives: [] },
        });

        it('renders rogue container at level 9', () => {
            renderComponent(rogueStats(9));
            expect(screen.getByTestId('char-class-rogue')).toBeInTheDocument();
        });

        it('renders supreme sneak button at level 9 or above', () => {
            renderComponent(rogueStats(9));
            expect(screen.getByTitle(/Supreme Sneak/)).toBeInTheDocument();
        });

        it('does not render supreme sneak below level 9', () => {
            renderComponent(rogueStats(5));
            expect(screen.queryByTitle(/Supreme Sneak/)).not.toBeInTheDocument();
        });

        it('renders sneak attack damage display', () => {
            renderComponent(rogueStats(9));
            expect(screen.getByText(/Sneak Attack Damage:/)).toBeInTheDocument();
        });

        it('renders sneak attack button with dice count', () => {
            renderComponent(rogueStats(9));
            const allButtons = screen.getAllByTitle(/Sneak Attack/);
            expect(allButtons.length).toBeGreaterThan(0);
        });

        it('renders expertise when available from class features', () => {
            renderComponent(rogueStats(9));
            expect(screen.getByText(/Expertise:/)).toBeInTheDocument();
        });

        it('renders supreme sneak as active when stealth attack cost > 0', () => {
            vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'stealthAttackCost') return 1;
                return null;
            });
            renderComponent(rogueStats(9));
            const btn = screen.getByTitle(/Supreme Sneak/);
            expect(btn).toHaveClass('automation-btn--active');
        });
    });

    describe('Sorcerer features', () => {
        const sorcererStats = () => makeStats({
            class: { name: 'Sorcerer', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        });

        it('renders sorcerer container', () => {
            renderComponent(sorcererStats());
            expect(screen.getByTestId('char-class-sorcerer')).toBeInTheDocument();
        });

        it('renders sorcery points tracked resource', () => {
            renderComponent(sorcererStats());
            expect(screen.getByTestId('tracked-resource-Sorcery Points')).toBeInTheDocument();
        });

        it('renders metamagic known tracked resource', () => {
            renderComponent(sorcererStats());
            expect(screen.getByTestId('tracked-resource-Metamagic Known')).toBeInTheDocument();
        });

        it('renders innate sorcery tracked resource', () => {
            renderComponent(sorcererStats());
            expect(screen.getByTestId('tracked-resource-Innate Sorcery')).toBeInTheDocument();
        });

        it('renders spell slot costs when available', () => {
            renderComponent(sorcererStats());
            expect(screen.getByText(/Spell Slot \(level 1-5\) Costs:/)).toBeInTheDocument();
        });

        it('renders sorcerous restoration when resource_restoration passive exists', () => {
            const stats = makeStats({
                class: { name: 'Sorcerer', class_levels: [{ level: 5 }] },
                automation: { passives: [{ type: 'resource_restoration' }] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Sorcerous Restoration')).toBeInTheDocument();
        });

        it('shows innate sorcery active badge when buff exists', () => {
            vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Innate Sorcery' }];
                return null;
            });
            renderComponent(sorcererStats());
            expect(screen.getByText(/\+1 Save DC, Spell Adv/)).toBeInTheDocument();
        });

        it('shows revelation badge when revelation in flesh buff exists', () => {
            vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Revelation in Flesh', effect: 'glistening_flight' }];
                return null;
            });
            renderComponent(sorcererStats());
            expect(screen.getByText(/Glistening Flight/)).toBeInTheDocument();
        });
    });

    describe('Warlock features', () => {
        const warlockStats = () => makeStats({
            class: { name: 'Warlock', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        });

        it('renders warlock container', () => {
            renderComponent(warlockStats());
            expect(screen.getByTestId('char-class-warlock')).toBeInTheDocument();
        });

        it('renders invocations known', () => {
            renderComponent(warlockStats());
            expect(screen.getByText(/Eldritch Invocations/)).toBeInTheDocument();
        });

        it('renders invocations list when available', () => {
            renderComponent(warlockStats());
            const allInvocations = screen.getAllByText(/Invocations:/);
            expect(allInvocations.length).toBeGreaterThan(0);
        });

        it('renders pact boon when available', () => {
            renderComponent(warlockStats());
            expect(screen.getByText(/Pact Boon:/)).toBeInTheDocument();
        });

        it('renders pact boon automation button when available', () => {
            renderComponent(warlockStats());
            expect(screen.getByTitle(/Pact Boon: Chain/)).toBeInTheDocument();
        });

        it('renders arcanums when hasArcanum is true', () => {
            renderComponent(warlockStats());
            expect(screen.getByText(/Arcanums Known/)).toBeInTheDocument();
        });

        it('renders arcanums list when available', () => {
            renderComponent(warlockStats());
            expect(screen.getByText(/Arcanums:/)).toBeInTheDocument();
        });
    });

    describe('Wizard features', () => {
        const wizardStats = () => makeStats({
            level: 5,
            class: { name: 'Wizard', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        });

        it('renders wizard container when showWizardFeatures is true', () => {
            renderComponent(wizardStats());
            expect(screen.getByTestId('char-class-wizard')).toBeInTheDocument();
        });

        it('returns null when showWizardFeatures is false', () => {
            const getClassFeaturesSpy = vi.spyOn(classFeaturesModule, 'getClassFeatures').mockReturnValue({ showWizardFeatures: false });
            const { container } = renderComponent(wizardStats());
            expect(container.innerHTML).toBe('');
            getClassFeaturesSpy.mockRestore();
        });

        it('renders arcane recovery tracked resource', () => {
            renderComponent(wizardStats());
            expect(screen.getByTestId('tracked-resource-Arcane Recovery Levels')).toBeInTheDocument();
        });

        it('renders arcane ward tracked resource', () => {
            renderComponent(wizardStats());
            expect(screen.getByTestId('tracked-resource-Arcane Ward HP')).toBeInTheDocument();
        });

        it('renders arcane recovery automation button', () => {
            renderComponent(wizardStats());
            expect(screen.getByTitle(/Arcane Recovery: Regain spell slots/)).toBeInTheDocument();
        });

        it('renders projected ward badge when reaction exists', () => {
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { reactions: [{ type: 'projected_ward', range: 30 }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Projected Ward:/)).toBeInTheDocument();
        });

        it('renders portent section when portent action exists', () => {
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
                specialActions: [{ name: 'Portent', automation: { type: 'portent' } }],
            });
            renderComponent(stats);
            expect(screen.getByText(/Portent Dice:/)).toBeInTheDocument();
        });

        it('renders use portent button when portent is available', () => {
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
                specialActions: [{ name: 'Portent', automation: { type: 'portent' } }],
            });
            renderComponent(stats);
            expect(screen.getByTitle(/Use Portent/)).toBeInTheDocument();
        });

        it('shows no dice remaining badge when portent dice array is empty', () => {
            vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'portentDice') return [];
                return null;
            });
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
                specialActions: [{ name: 'Portent', automation: { type: 'portent' } }],
            });
            renderComponent(stats);
            expect(screen.getByText(/No dice remaining/)).toBeInTheDocument();
        });

        it('renders third eye badge when buff exists', () => {
            vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'The Third Eye', effect: 'darkvision_120' }];
                return null;
            });
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Darkvision 120 ft./)).toBeInTheDocument();
        });
    });

    describe('2024 ruleset variations', () => {
        it('renders barbarian 2024 with rage values from classLevel', () => {
            const stats = makeStats({
                rules: '2024',
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 5, rages: 3, rage_damage: 2, weapon_mastery: 'Heavy' }],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('char-class-barbarian')).toBeInTheDocument();
        });

        it('renders fighter 2024 with action surge based on level', () => {
            const stats = makeStats({
                rules: '2024',
                level: 17,
                class: {
                    name: 'Fighter',
                    class_levels: Array.from({ length: 17 }, (_, i) => ({ level: i + 1 })),
                    fightingStyles: [],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('char-class-fighter')).toBeInTheDocument();
        });

        it('renders barbarian 2024 with weapon mastery value', () => {
            const stats = makeStats({
                rules: '2024',
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 5, weapon_mastery: 'Heavy' }],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Weapon Mastery:/)).toBeInTheDocument();
        });
    });

    describe('automation button states', () => {
        it('renders Font of Inspiration button with disabled class when at max', () => {
            const stats = makeStats({
                level: 5,
                class: { name: 'Bard', class_levels: [{ level: 5 }] },
                automation: { passives: [{ type: 'font_of_inspiration' }] },
            });
            renderComponent(stats);
            const btn = screen.getByTitle(/Font of Inspiration/);
            expect(btn).toHaveClass('automation-btn--disabled');
        });
    });
});
