// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import { getRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getClassFeatures } from '../../../services/character/classFeatures.js';

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
            case 'naturalRecoveryFreeCastUsed': return undefined;
            default: return null;
        }
    }),
    getRuntimeValue: vi.fn((_name, key) => {
        switch (key) {
            case 'bardicInspirationUses': return 3;
            case 'portentDice': return null;
            case 'stealthAttackCost': return 0;
            case 'naturalRecoveryFreeCast': return undefined;
            case 'naturalRecoveryFreeCastUsed': return undefined;
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

const mockCampaignName = 'test-campaign';

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

    describe('Sorcerer features', () => {
        const sorcererStats = () => makeStats({
            class: { name: 'Sorcerer', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        });

        it('renders sorcerer tracked resources', () => {
            renderComponent(sorcererStats());
            expect(screen.getByTestId('tracked-resource-Sorcery Points')).toBeInTheDocument();
            expect(screen.getByTestId('tracked-resource-Metamagic Known')).toBeInTheDocument();
            expect(screen.getByTestId('tracked-resource-Innate Sorcery')).toBeInTheDocument();
        });

        it('renders sorcerous restoration when resource_restoration passive exists', () => {
            const stats = makeStats({
                class: { name: 'Sorcerer', class_levels: [{ level: 5 }] },
                automation: { passives: [{ type: 'resource_restoration' }] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Sorcerous Restoration')).toBeInTheDocument();
        });

        it('renders innate sorcery active badge when activeBuffs contains Innate Sorcery', () => {
            vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Innate Sorcery' }];
                return null;
            });
            const stats = makeStats({
                class: { name: 'Sorcerer', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/\+1 Save DC, Spell Adv/)).toBeInTheDocument();
        });

        it('renders revelation in flesh badge with effect name', () => {
            vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Revelation in Flesh', effect: 'glistening_flight' }];
                return null;
            });
            const stats = makeStats({
                class: { name: 'Sorcerer', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Glistening Flight/)).toBeInTheDocument();
        });

        it('renders spell slot costs when creatingSpellSlotCosts has entries', () => {
            vi.mocked(getClassFeatures).mockReturnValue({
                creatingSpellSlotCosts: ['1 sorcery point', '1 HP'],
                maxSorceryPoints: 6,
                metamagicKnown: 4,
                maxInnateSorcery: 3,
            });
            const stats = makeStats({
                class: { name: 'Sorcerer', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Spell Slot \(level 1-5\) Costs:/)).toBeInTheDocument();
            vi.mocked(getClassFeatures).mockRestore();
        });
    });

    describe('Warlock features', () => {
        const warlockStats = () => makeStats({
            class: { name: 'Warlock', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        });

        it('renders warlock invocations and pact boon', () => {
            renderComponent(warlockStats());
            expect(screen.getByText(/Eldritch Invocations/)).toBeInTheDocument();
            expect(screen.getByText(/Pact Boon:/)).toBeInTheDocument();
        });
    });

    describe('Wizard features', () => {
        const wizardStats = () => makeStats({
            level: 5,
            class: { name: 'Wizard', class_levels: [{ level: 5 }] },
            automation: { passives: [] },
        });

        it('renders wizard tracked resources and automation button', () => {
            renderComponent(wizardStats());
            expect(screen.getByTestId('tracked-resource-Arcane Recovery Levels')).toBeInTheDocument();
            expect(screen.getByTestId('tracked-resource-Arcane Ward HP')).toBeInTheDocument();
            expect(screen.getByTitle(/Arcane Recovery: Regain spell slots/)).toBeInTheDocument();
        });

        it('renders projected ward with custom range', () => {
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { reactions: [{ type: 'projected_ward', range: 60 }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/within 60 ft\./)).toBeInTheDocument();
        });

        it('renders projected ward with default range when not specified', () => {
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { reactions: [{ type: 'projected_ward', name: 'Projected Ward' }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/within 30 ft\./)).toBeInTheDocument();
        });

        it('renders portent section and button when portent action exists', () => {
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
                specialActions: [{ name: 'Portent', automation: { type: 'portent' } }],
            });
            renderComponent(stats);
            expect(screen.getByText(/Portent Dice:/)).toBeInTheDocument();
            expect(screen.getByTitle(/Use Portent/)).toBeInTheDocument();
        });

        it('renders portent dice display when dice are stored', () => {
            vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
                if (key === 'portentDice') return [1, 20];
                return null;
            });
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
                specialActions: [{ name: 'Portent', automation: { type: 'portent' } }],
            });
            renderComponent(stats);
            expect(screen.getByText(/Portent Dice:/)).toBeInTheDocument();
            expect(screen.getByText(/2 remaining \(refreshes on Long Rest\)/)).toBeInTheDocument();
        });

        it('shows no dice remaining badge when portent dice array is empty', () => {
            vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
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

        it('returns null when showWizardFeatures is false', () => {
            vi.mocked(getClassFeatures).mockReturnValue({ showWizardFeatures: false });
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
            });
            const { container } = renderComponent(stats);
            expect(container.innerHTML).toBe('');
            vi.mocked(getClassFeatures).mockRestore();
        });

        it('renders third eye buff when active', () => {
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
            expect(screen.getByText(/The Third Eye:/)).toBeInTheDocument();
            expect(screen.getByText(/Darkvision 120 ft/)).toBeInTheDocument();
        });
    });

    describe('main CharClassFeatures entry point', () => {
        it('renders Adrenaline Rush tracked resource when bonus_action_dash special action exists', () => {
            const stats = makeStats({
                class: { name: 'UnknownClass' },
                automation: { specialActions: [{ effect: 'bonus_action_dash' }] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Adrenaline Rush')).toBeInTheDocument();
        });

        it('renders both adrenaline rush and class features when both exist', () => {
            const stats = makeStats({
                level: 5,
                class: { name: 'Fighter', class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5 }], fightingStyles: [] },
                automation: { specialActions: [{ effect: 'bonus_action_dash' }], passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Adrenaline Rush')).toBeInTheDocument();
            expect(screen.getByTestId('char-class-fighter')).toBeInTheDocument();
        });

        it('renders nothing when no class match and no adrenaline rush', () => {
            const stats = makeStats({
                class: { name: 'UnknownClass' },
                automation: { specialActions: [] },
            });
            const { container } = renderComponent(stats);
            expect(container.innerHTML).toBe('');
        });
    });
});
