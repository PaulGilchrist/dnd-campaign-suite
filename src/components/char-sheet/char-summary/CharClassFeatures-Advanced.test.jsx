// @cleaned-by-ai
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
    });
});
