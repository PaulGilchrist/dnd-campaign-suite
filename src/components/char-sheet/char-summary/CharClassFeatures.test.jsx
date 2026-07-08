// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import { isUnbreakableMajestyActive, getUnbreakableMajestySaveDc } from '../../../services/combat/auras/unbreakableMajesty.js';

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
    getStore: vi.fn(() => new Map()),
    listeners: new Map(),
    useSyncedState: vi.fn(() => [{}, vi.fn()]),
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

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 15),
    clearUnbreakableMajesty: vi.fn(),
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
    describe('null/unknown class handling', () => {
        it('returns null for unknown class name', () => {
            const { container } = renderComponent(makeStats({ class: { name: 'UnknownClass' } }));
            expect(container.innerHTML).toBe('');
        });
    });

    describe('Barbarian features', () => {
        const barbarianStats = (overrides = {}) => makeStats({
            level: 5,
            class: {
                name: 'Barbarian',
                class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
            },
            automation: { passives: [] },
            ...overrides,
        });

        it('renders rage toggle button with correct title when not raging', () => {
            renderComponent(barbarianStats());
            expect(screen.getByTitle('Enter Rage (toggle for damage bonus)')).toBeInTheDocument();
        });

        it('renders barbarian with Aspect of the Wilds passive', () => {
            const stats = makeStats({
                level: 5,
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
                },
                automation: { passives: [{ effect: 'animal_aspect' }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Aspect of the Wilds/)).toBeInTheDocument();
            expect(document.querySelector('.automation-btn--active')).toBeInTheDocument();
        });

        it('renders 2024 ruleset barbarian with class_level-based rage values', () => {
            const stats = makeStats({
                rules: '2024',
                level: 5,
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5, rages: 3, rage_damage: 4, weapon_mastery: 'Piercing', extra_attacks: 1 }],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
            expect(screen.getByText('Piercing')).toBeInTheDocument();
        });

        it('renders weapon mastery clickable for 2024 barbarian', () => {
            const stats = makeStats({
                rules: '2024',
                level: 5,
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5, rages: 3, rage_damage: 4, weapon_mastery: 'Slashing' }],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            const weaponMasteryLabel = screen.getByText(/Weapon Mastery:/);
            expect(weaponMasteryLabel.nextElementSibling).toHaveClass('clickable');
        });
    });

    describe('Bard features', () => {
        const bardStats = (overrides = {}) => makeStats({
            level: 5,
            class: { name: 'Bard', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
            ...overrides,
        });

        it('renders magical secrets tracked resource when bardFeatures.magicalSecrets is not null', () => {
            const stats = bardStats({
                class: { ...basePlayerStats.class, name: 'Bard', expertise: ['Perception'] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Magical Secrets')).toBeInTheDocument();
        });

        it('renders expertise when playerStats.expertise exists and level > 2', () => {
            const stats = bardStats({
                class: { ...basePlayerStats.class, name: 'Bard' },
                expertise: ['Stealth', 'Athletics'],
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
            expect(screen.getByText(/Extra Attacks.*/)).toBeInTheDocument();
        });

        it('renders bardic inspiration die display', () => {
            const stats = bardStats();
            renderComponent(stats);
            expect(screen.getByText(/Bardic Inspiration Die:/)).toBeInTheDocument();
            expect(screen.getByText(/d8/)).toBeInTheDocument();
        });

        it('renders song of rest die when available', () => {
            const stats = bardStats();
            renderComponent(stats);
            expect(screen.getByText(/Song of Rest Die:/)).toBeInTheDocument();
            expect(screen.getByText(/d6/)).toBeInTheDocument();
        });

        it('renders beguiling magic tracked resource when passive_rule with riderSave exists', () => {
            const stats = bardStats({
                automation: { passives: [{ type: 'passive_rule', riderSave: true }] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Beguiling Magic')).toBeInTheDocument();
        });

        it('renders unbreakable majesty button when active', () => {
            vi.mocked(getUnbreakableMajestySaveDc).mockReturnValue(17);
            vi.mocked(isUnbreakableMajestyActive).mockReturnValue(true);
            const stats = bardStats();
            renderComponent(stats);
            expect(screen.getByText(/Unbreakable Majesty DC 17/)).toBeInTheDocument();
        });
    });

    describe('Cleric features', () => {
        const clericStats = () => makeStats({
            class: { name: 'Cleric', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        });

        it('renders channel divinity charges tracked resource', () => {
            renderComponent(clericStats());
            expect(screen.getByTestId('tracked-resource-Channel Divinity Charges')).toBeInTheDocument();
        });

        it('renders destroy undead CR when available', () => {
            renderComponent(clericStats());
            expect(screen.getByText(/Destroy Undead Challenge Rating:/)).toBeInTheDocument();
        });

        it('renders Preserve Life Pool for Life Domain', () => {
            const stats = makeStats({
                class: { name: 'Cleric', subclass: { name: 'Life Domain' }, class_levels: [{ level: 5 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Preserve Life Pool')).toBeInTheDocument();
        });

        it('does not render Preserve Life Pool for non-Life Domain', () => {
            const stats = makeStats({
                class: { name: 'Cleric', subclass: { name: 'War Domain' }, class_levels: [{ level: 5 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.queryByTestId('tracked-resource-Preserve Life Pool')).not.toBeInTheDocument();
        });

        it('renders warding flare uses with wisdom-based max', () => {
            renderComponent(clericStats());
            expect(screen.getByTestId('tracked-resource-Warding Flare Uses')).toBeInTheDocument();
        });

    });
});
