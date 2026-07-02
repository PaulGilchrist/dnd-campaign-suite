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
            level: 5,
            class: {
                name: 'Barbarian',
                class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
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

        it('renders rage toggle button with "End Rage" title when already raging', () => {
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

        it('renders aspect choice buttons for all three options', () => {
            const stats = makeStats({
                level: 5,
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
                },
                automation: { passives: [{ effect: 'animal_aspect' }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Extra Attacks.*/));
        });

        it('shows checkmark on selected aspect option', () => {
            const stats = makeStats({
                level: 5,
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
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

        it('renders barbarian extra_attacks 0 at level 4 (5e ruleset)', () => {
            const stats = makeStats({
                level: 4,
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Extra Attacks.*/));
        });

        it('renders barbarian extra_attacks 1 at level 5 (5e ruleset)', () => {
            const stats = makeStats({
                level: 5,
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5, class_specific: { rage_count: 2, rage_damage_bonus: 2 } }],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Extra Attacks.*/));
        });

        it('renders 2024 ruleset barbarian with rage values from classLevel', () => {
            const stats = makeStats({
                rules: '2024',
                level: 5,
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5, rages: 3, rage_damage: 2, weapon_mastery: 'Heavy', extra_attacks: 2 }],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('char-class-barbarian')).toBeInTheDocument();
            expect(screen.getByText(/Extra Attacks.*/));
        });

        it('renders 2024 ruleset barbarian with weapon mastery value', () => {
            const stats = makeStats({
                rules: '2024',
                level: 5,
                class: {
                    name: 'Barbarian',
                    class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5, weapon_mastery: 'Heavy' }],
                },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Weapon Mastery:/)).toBeInTheDocument();
        });

        it('renders N/A for weapon mastery in 5e ruleset', () => {
            const { container } = renderComponent(barbarianStats());
            expect(container.querySelector('div').textContent).toContain('Weapon Mastery');
            expect(container.querySelector('div').textContent).toContain('N/A');
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

        it('renders magical secrets tracked resource when bardFeatures.magicalSecrets is not null', () => {
            const stats = bardStats({
                class: { ...basePlayerStats.class, name: 'Bard', expertise: ['Perception'] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Magical Secrets')).toBeInTheDocument();
        });

        it('does not render magical secrets tracked resource when bardFeatures.magicalSecrets is null', () => {
            const spy = vi.spyOn(classFeaturesModule, 'getClassFeatures').mockReturnValue({
                ...classFeaturesModule.getClassFeatures(),
                magicalSecrets: null,
            });
            renderComponent(bardStats());
            expect(screen.queryByTestId('tracked-resource-Magical Secrets')).not.toBeInTheDocument();
            spy.mockRestore();
        });

        it('renders expertise when playerStats.expertise exists and level > 2', () => {
            const stats = bardStats({
                class: { ...basePlayerStats.class, name: 'Bard' },
                expertise: ['Stealth', 'Athletics'],
            });
            renderComponent(stats);
            expect(screen.getByText(/Expertise:/)).toBeInTheDocument();
        });

        it('does not render expertise when level is 2 or below', () => {
            const stats = bardStats({
                level: 2,
                class: { ...basePlayerStats.class, name: 'Bard' },
                expertise: ['Stealth', 'Athletics'],
            });
            renderComponent(stats);
            expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();
        });

        it('renders extra attacks when level > 5 and magical secrets exists', () => {
            const stats = bardStats({
                level: 10,
                class: { ...basePlayerStats.class, name: 'Bard', class_levels: [{ level: 10 }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Extra Attacks.*/));
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

        it('renders bardic inspiration uses with charisma-based max', () => {
            renderComponent(bardStats());
            expect(screen.getByTestId('tracked-resource-Bardic Inspiration Uses')).toBeInTheDocument();
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

        it('renders major name Life Domain check', () => {
            const stats = makeStats({
                class: { name: 'Cleric', major: { name: 'Life Domain' }, class_levels: [{ level: 5 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Preserve Life Pool')).toBeInTheDocument();
        });
    });
});
