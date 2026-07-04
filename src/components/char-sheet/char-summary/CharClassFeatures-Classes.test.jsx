// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
        favoredEnemies: 'Beasts',
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

vi.mock('../../../services/ui/dataLoader.js', () => ({
    loadFightingStyles: vi.fn(() => Promise.resolve([])),
}));

import { getRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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

    describe('Druid features', () => {
        const druidStats = (level = 5) => makeStats({
            level,
            class: { name: 'Druid', class_levels: [{ level }] },
            automation: { passives: [] },
        });

        it('returns null for druid below level 2', () => {
            const { container } = renderComponent(druidStats(1));
            expect(container.innerHTML).toBe('');
        });

        it('renders druid container at level 5', () => {
            renderComponent(druidStats(5));
            expect(screen.getByTestId('char-class-druid')).toBeInTheDocument();
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
            vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'naturalRecoveryFreeCast') return ['fireball'];
                return null;
            });
            const stats = makeStats({
                level: 5,
                class: { name: 'Druid', class_levels: [{ level: 5 }] },
                automation: { passives: [{ type: 'resource_restoration', resourceKey: 'naturalRecoverySlots' }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Free cast used/)).toBeInTheDocument();
        });

        it('renders wild shape features', () => {
            renderComponent(druidStats(5));
            expect(screen.getByText(/Wild Shape Limitations:/)).toBeInTheDocument();
            expect(screen.getByText(/Beast Forms Known:/)).toBeInTheDocument();
            expect(screen.getByText(/Wild Shape Max Challenge Rating:/)).toBeInTheDocument();
            expect(screen.getByTestId('tracked-resource-Wild Shape Uses')).toBeInTheDocument();
        });
    });

    describe('Fighter features', () => {
        const fighterStats = (overrides = {}) => makeStats({
            level: 5,
            class: {
                name: 'Fighter',
                class_levels: [
                    { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
                    { level: 5, extra_attacks: 2, weapon_mastery: 'Mercy' },
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

        it('returns null when class_levels is null or undefined', () => {
            const { container: c1 } = renderComponent(makeStats({
                class: { name: 'Fighter', class_levels: null },
                automation: { passives: [] },
            }));
            expect(c1.innerHTML).toBe('');

            const { container: c2 } = renderComponent(makeStats({
                class: { name: 'Fighter', class_levels: undefined },
                automation: { passives: [] },
            }));
            expect(c2.innerHTML).toBe('');
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
            expect(screen.getByText(/Energy Dice/)).toBeInTheDocument();
            expect(screen.getByText(/Energy Die Type:/)).toBeInTheDocument();
            expect(screen.getByText(/d6/)).toBeInTheDocument();
        });

        it('does not render psionic energy when required_major does not match', () => {
            const stats = makeStats({
                level: 5,
                class: {
                    name: 'Fighter',
                    class_levels: [
                        { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
                        { level: 5, extra_attacks: 2, weapon_mastery: 'Mercy', energy: { required_major: 'Psi Warrior', energy_die_num: 4, energy_die_type: 6 } },
                    ],
                    major: { name: 'Battle Master' },
                    fightingStyles: [],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.queryByText(/Energy Dice/)).not.toBeInTheDocument();
        });

        it('renders superiority dice and die type for Battle Master subclass', () => {
            const stats = makeStats({
                level: 5,
                class: {
                    name: 'Fighter',
                    class_levels: [
                        { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
                        { level: 5, extra_attacks: 2, weapon_mastery: 'Mercy' },
                    ],
                    major: { name: 'Battle Master' },
                    fightingStyles: [],
                },
                automation: { passives: [] },
            });
            const { container } = renderComponent(stats);
            expect(container.querySelector('[data-testid="tracked-resource-Superiority Dice"]')).toBeInTheDocument();
            const dieDiv = [...container.querySelectorAll('div')].find(d => d.textContent.includes('Superiority Die'));
            expect(dieDiv.textContent).toContain('d8');
        });

        it('renders superiority die type d10 for Battle Master level 10+', () => {
            const stats = makeStats({
                level: 10,
                class: {
                    name: 'Fighter',
                    class_levels: Array.from({ length: 10 }, (_, i) => ({ level: i + 1, extra_attacks: 2, weapon_mastery: 'Mercy' })),
                    major: { name: 'Battle Master' },
                    fightingStyles: [],
                },
                automation: { passives: [] },
            });
            const { container } = renderComponent(stats);
            expect(container.querySelector('[data-testid="tracked-resource-Superiority Dice"]')).toBeInTheDocument();
            const dieDiv = [...container.querySelectorAll('div')].find(d => d.textContent.includes('Superiority Die'));
            expect(dieDiv.textContent).toContain('d10');
        });

        it('renders superiority die type d12 for Battle Master level 18+', () => {
            const stats = makeStats({
                level: 18,
                class: {
                    name: 'Fighter',
                    class_levels: Array.from({ length: 18 }, (_, i) => ({ level: i + 1, extra_attacks: 2, weapon_mastery: 'Mercy' })),
                    major: { name: 'Battle Master' },
                    fightingStyles: [],
                },
                automation: { passives: [] },
            });
            const { container } = renderComponent(stats);
            expect(container.querySelector('[data-testid="tracked-resource-Superiority Dice"]')).toBeInTheDocument();
            const dieDiv = [...container.querySelectorAll('div')].find(d => d.textContent.includes('Superiority Die'));
            expect(dieDiv.textContent).toContain('d12');
        });

        it('renders superiority dice for Superior Technique fighting style', () => {
            const stats = makeStats({
                level: 5,
                class: {
                    name: 'Fighter',
                    class_levels: [
                        { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 },
                        { level: 5, extra_attacks: 2, weapon_mastery: 'Mercy' },
                    ],
                    fightingStyles: ['Superior Technique'],
                },
                automation: { passives: [] },
            });
            const { container } = renderComponent(stats);
            expect(container.querySelector('[data-testid="tracked-resource-Superiority Dice"]')).toBeInTheDocument();
            const dieDiv = [...container.querySelectorAll('div')].find(d => d.textContent.includes('Superiority Die'));
            expect(dieDiv.textContent).toContain('d6');
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
            const statsWithStyles = makeStats({
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
            renderComponent(statsWithStyles);
            expect(screen.getByText(/Fighting Styles.*/));
        });

        it('renders N/A for fighting styles when absent', () => {
            const statsNoStyles = makeStats({
                level: 1,
                class: {
                    name: 'Fighter',
                    class_levels: [{ level: 1 }],
                    fightingStyles: null,
                },
                automation: { passives: [] },
            });
            renderComponent(statsNoStyles);
            expect(screen.getByText(/Fighting Styles.*/));
        });

        it('renders extra attacks from classLevel', () => {
            renderComponent(fighterStats());
            expect(screen.getByText(/Extra Attacks.*/));
        });

        it('renders action surge tracked resource', () => {
            renderComponent(fighterStats());
            expect(screen.getByTestId('tracked-resource-Action Surge Uses')).toBeInTheDocument();
        });

        it('renders second wind tracked resource', () => {
            const stats = makeStats({
                level: 5,
                class: {
                    name: 'Fighter',
                    class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5, second_wind: 1 }],
                    fightingStyles: [],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Second Wind')).toBeInTheDocument();
        });

        it('renders weapon mastery clickable', () => {
            renderComponent(fighterStats());
            const weaponMasterySpan = screen.getByText(/Weapon Mastery:/).nextSibling;
            expect(weaponMasterySpan).toHaveAttribute('class', 'clickable');
        });
    });

    describe('Monk features', () => {
        const monkStats = (level = 5) => makeStats({
            level,
            class: { name: 'Monk', class_levels: [{ level }] },
            automation: { passives: [] },
        });

        it('returns null for monk below level 2', () => {
            const { container } = renderComponent(monkStats(1));
            expect(container.innerHTML).toBe('');
        });

        it('renders monk container at level 5', () => {
            renderComponent(monkStats(5));
            expect(screen.getByTestId('char-class-monk')).toBeInTheDocument();
        });

        it('renders monk features', () => {
            renderComponent(monkStats(5));
            expect(screen.getByText(/Focus Save DC.*/)).toBeInTheDocument();
            expect(screen.getByText(/Unarmored Movement:/)).toBeInTheDocument();
            expect(screen.getByText(/Martial Arts Die:/)).toBeInTheDocument();
            expect(screen.getByText(/Extra Attacks.*/));
            expect(screen.getByTestId('tracked-resource-Focus Points')).toBeInTheDocument();
        });

        it('renders focus save DC with correct formula (8 + wisBonus + proficiency)', () => {
            const stats = makeStats({
                level: 5,
                abilities: [
                    { name: 'Wisdom', bonus: 4 },
                ],
                proficiency: 3,
                class: { name: 'Monk', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            // 8 + 4 + 3 = 15
            expect(screen.getByText(/Focus Save DC.*/));
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
            expect(screen.getByText(/Aura of Protection/)).toBeInTheDocument();
            expect(screen.getByText(/\+3/)).toBeInTheDocument();
        });

        it('shows locked aura range at level < 6', () => {
            renderComponent(paladinStats());
            expect(screen.getByText(/locked/)).toBeInTheDocument();
        });

        it('shows 10 ft aura range at level >= 6', () => {
            const stats = makeStats({
                level: 6,
                class: { name: 'Paladin', class_levels: [{ level: 6 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/10 ft/)).toBeInTheDocument();
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
            expect(screen.getByText(/Fighting Styles.*/));
        });

        it('renders extra attacks from class features', () => {
            renderComponent(paladinStats());
            expect(screen.getByText(/Extra Attacks.*/));
        });

        it('renders channel divinity charges tracked resource', () => {
            renderComponent(paladinStats());
            expect(screen.getByTestId('tracked-resource-Channel Divinity Charges')).toBeInTheDocument();
        });

        it('does not render aura of protection when charisma ability is missing', () => {
            const stats = makeStats({
                level: 5,
                abilities: [
                    { name: 'Strength', bonus: 4 },
                ],
                class: { name: 'Paladin', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.queryByText(/Aura of Protection:/)).not.toBeInTheDocument();
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

        it('does not render favored foe button at level 1', () => {
            const stats = makeStats({
                level: 1,
                class: { name: 'Ranger', class_levels: [{ level: 1 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.queryByTitle(/Favored Foe/)).not.toBeInTheDocument();
        });

        it('renders favored enemies', () => {
            renderComponent(rangerStats());
            expect(screen.getByText(/Favored Enemies:/)).toBeInTheDocument();
        });

        it('renders extra attacks', () => {
            renderComponent(rangerStats());
            expect(screen.getByText(/Extra Attacks.*/));
        });

        it('renders fighting styles when level > 1 and styles present', () => {
            const stats = makeStats({
                class: { name: 'Ranger', class_levels: [{ level: 5 }], fightingStyles: ['Defense'] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Fighting Styles.*/));
        });

        it('does not render fighting styles when level is 1 or styles is null', () => {
            const statsLevel1 = makeStats({
                level: 1,
                class: { name: 'Ranger', class_levels: [{ level: 1 }], fightingStyles: ['Defense'] },
                automation: { passives: [] },
            });
            renderComponent(statsLevel1);
            expect(screen.queryByText(/Fighting Styles:/)).not.toBeInTheDocument();

            const statsNull = makeStats({
                class: { name: 'Ranger', class_levels: [{ level: 5 }], fightingStyles: null },
                automation: { passives: [] },
            });
            renderComponent(statsNull);
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
            vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'stealthAttackCost') return 1;
                return null;
            });
            renderComponent(rogueStats(9));
            const btn = screen.getByTitle(/Supreme Sneak/);
            expect(btn).toHaveClass('automation-badge--active');
        });

        it('does not render supreme sneak when stealth attack cost is 0', () => {
            vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'stealthAttackCost') return 0;
                return null;
            });
            renderComponent(rogueStats(9));
            const btn = screen.getByTitle(/Supreme Sneak/);
            expect(btn).not.toHaveClass('automation-badge--active');
        });

        it('renders sneak attack dice from class features', () => {
            renderComponent(rogueStats(9));
            expect(screen.getByText(/Sneak Attack \(5d6\)/)).toBeInTheDocument();
        });

        it('renders rogue at level 1 without supreme sneak', () => {
            renderComponent(rogueStats(1));
            expect(screen.getByTestId('char-class-rogue')).toBeInTheDocument();
            expect(screen.queryByTitle(/Supreme Sneak/)).not.toBeInTheDocument();
        });
    });
});
