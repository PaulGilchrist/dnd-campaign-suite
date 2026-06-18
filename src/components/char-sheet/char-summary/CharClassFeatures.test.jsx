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
            default: return null;
        }
    }),
    getRuntimeValue: vi.fn((_name, key) => {
        switch (key) {
            case 'bardicInspirationUses': return 3;
            case 'portentDice': return null;
            default: return null;
        }
    }),
    setRuntimeValue: vi.fn(),
}));

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
        const barbarianStats = () => makeStats({
            class: {
                name: 'Barbarian',
                class_levels: [{ level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
            },
            automation: { passives: [] },
        });

        it('renders barbarian container', () => {
            renderComponent(barbarianStats());
            expect(screen.getByTestId('char-class-barbarian')).toBeInTheDocument();
        });

        it('renders rage toggle button with correct title', () => {
            renderComponent(barbarianStats());
            expect(screen.getByTitle('Enter Rage (toggle for damage bonus)')).toBeInTheDocument();
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

        it('renders Supreme Sneak button at level 9 or above', () => {
            renderComponent(rogueStats(9));
            expect(screen.getByTitle(/Supreme Sneak/)).toBeInTheDocument();
        });

        it('does not render Supreme Sneak below level 9', () => {
            renderComponent(rogueStats(5));
            expect(screen.queryByTitle(/Supreme Sneak/)).not.toBeInTheDocument();
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

        it('returns null when showWizardFeatures is false', async () => {
            await vi.resetModules();
            const classFeaturesModule = await import('../../../services/character/classFeatures.js');
            classFeaturesModule.getClassFeatures = vi.fn(() => ({ showWizardFeatures: false }));
            const { container } = renderComponent(wizardStats());
            expect(container.innerHTML).toBe('');
        });
    });

    describe('automation button states', () => {
        it('renders Aspect of the Wilds buttons as active when option is set', () => {
            const stats = makeStats({
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
                },
                automation: { passives: [{ effect: 'animal_aspect' }] },
            });
            renderComponent(stats);
            const activeBtn = document.querySelector('.automation-btn--active');
            expect(activeBtn).toBeInTheDocument();
            expect(activeBtn).toHaveTextContent('Owl');
        });
    });
});
