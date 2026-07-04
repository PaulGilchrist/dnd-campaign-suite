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

        it('renders spell slot costs when creatingSpellSlotCosts is populated', () => {
            renderComponent(sorcererStats());
            expect(screen.getByText(/Spell Slot \(level 1-5\) Costs:/)).toBeInTheDocument();
        });

        it('does not render spell slot costs when creatingSpellSlotCosts is empty', () => {
            const spy = vi.spyOn(classFeaturesModule, 'getClassFeatures').mockReturnValue({
                ...classFeaturesModule.getClassFeatures(),
                creatingSpellSlotCosts: [],
            });
            renderComponent(sorcererStats());
            expect(screen.queryByText(/Spell Slot \(level 1-5\) Costs:/)).not.toBeInTheDocument();
            spy.mockRestore();
        });

        it('renders sorcerous restoration when resource_restoration passive exists', () => {
            const stats = makeStats({
                class: { name: 'Sorcerer', class_levels: [{ level: 5 }] },
                automation: { passives: [{ type: 'resource_restoration' }] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Sorcerous Restoration')).toBeInTheDocument();
        });

        it('does not render sorcerous restoration when resource_restoration passive is absent', () => {
            renderComponent(sorcererStats());
            expect(screen.queryByTestId('tracked-resource-Sorcerous Restoration')).not.toBeInTheDocument();
        });

        it('shows innate sorcery active badge when buff exists', () => {
            const restore = vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Innate Sorcery' }];
                return null;
            });
            renderComponent(sorcererStats());
            expect(screen.getByText(/\+1 Save DC, Spell Adv/)).toBeInTheDocument();
            restore();
        });

        it('does not show innate sorcery badge when buff is absent', () => {
            const restore = vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });
            renderComponent(sorcererStats());
            expect(screen.queryByText(/\+1 Save DC, Spell Adv/)).not.toBeInTheDocument();
            restore();
        });

        it('shows revelation badge with mapped effect text', () => {
            const restore = vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Revelation in Flesh', effect: 'glistening_flight' }];
                return null;
            });
            renderComponent(sorcererStats());
            expect(screen.getByText(/Glistening Flight/)).toBeInTheDocument();
            restore();
        });

        it('shows generic revelation badge for unknown effect', () => {
            const restore = vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Revelation in Flesh', effect: 'unknown_effect' }];
                return null;
            });
            renderComponent(sorcererStats());
            expect(screen.getByText(/Revelation in Flesh/)).toBeInTheDocument();
            restore();
        });

        it('does not show revelation badge when buff is absent', () => {
            const restore = vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });
            renderComponent(sorcererStats());
            expect(screen.queryByText(/Glistening Flight/)).not.toBeInTheDocument();
            expect(screen.queryByText(/Revelation in Flesh/)).not.toBeInTheDocument();
            restore();
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

        it('renders pact boon automation button', () => {
            renderComponent(warlockStats());
            expect(screen.getByTitle(/Pact Boon: Chain/)).toBeInTheDocument();
        });

        it('renders arcanums when hasArcanum is true', () => {
            renderComponent(warlockStats());
            expect(screen.getByText(/Arcanums Known/)).toBeInTheDocument();
            expect(screen.getByText(/Arcanums:/)).toBeInTheDocument();
        });

        it('does not render arcanums when hasArcanum is false', () => {
            const spy = vi.spyOn(classFeaturesModule, 'getClassFeatures').mockReturnValue({
                ...classFeaturesModule.getClassFeatures(),
                hasArcanum: false,
            });
            renderComponent(warlockStats());
            expect(screen.queryByText(/Arcanums:/)).not.toBeInTheDocument();
            expect(screen.queryByText(/Arcanums Known/)).not.toBeInTheDocument();
            spy.mockRestore();
        });

        it('does not render pact boon when pactBoon is null', () => {
            const spy = vi.spyOn(classFeaturesModule, 'getClassFeatures').mockReturnValue({
                ...classFeaturesModule.getClassFeatures(),
                pactBoon: null,
            });
            renderComponent(warlockStats());
            expect(screen.queryByText(/Pact Boon:/)).not.toBeInTheDocument();
            expect(screen.queryByTitle(/Pact Boon/)).not.toBeInTheDocument();
            spy.mockRestore();
        });

        it('renders invocations sorted alphabetically', () => {
            const spy = vi.spyOn(classFeaturesModule, 'getClassFeatures').mockReturnValue({
                ...classFeaturesModule.getClassFeatures(),
                invocations: ['Z', 'A', 'M'],
            });
            renderComponent(warlockStats());
            const invocationsDiv = document.querySelector('[data-testid="char-class-warlock"] div:nth-child(4)');
            expect(invocationsDiv.textContent).toContain('A, M, Z');
            spy.mockRestore();
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

        it('returns null when showWizardFeatures is false', () => {
            const spy = vi.spyOn(classFeaturesModule, 'getClassFeatures').mockReturnValue({ showWizardFeatures: false });
            const { container } = renderComponent(wizardStats());
            expect(container.innerHTML).toBe('');
            spy.mockRestore();
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

        it('renders projected ward with default range 30 when range property missing', () => {
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { reactions: [{ type: 'projected_ward' }] },
            });
            renderComponent(stats);
            expect(screen.getByText(/within 30 ft\./)).toBeInTheDocument();
        });

        it('does not render projected ward when reaction is absent', () => {
            renderComponent(wizardStats());
            expect(screen.queryByText(/Projected Ward:/)).not.toBeInTheDocument();
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

        it('does not render portent section when portent action is absent', () => {
            renderComponent(wizardStats());
            expect(screen.queryByText(/Portent Dice:/)).not.toBeInTheDocument();
            expect(screen.queryByTitle(/Use Portent/)).not.toBeInTheDocument();
        });

        it('shows no dice remaining badge when portent dice array is empty', () => {
            const restore = vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
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
            restore();
        });

        it('shows dice count badge when portent dice exist', () => {
            const restore = vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
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
            expect(screen.getByText(/2 remaining/)).toBeInTheDocument();
            restore();
        });

        it('renders portent dice display values when stored', () => {
            const restore = vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'portentDice') return [15, 18];
                return null;
            });
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
                specialActions: [{ name: 'Portent', automation: { type: 'portent' } }],
            });
            renderComponent(stats);
            expect(screen.getByText(/15/)).toBeInTheDocument();
            expect(screen.getByText(/18/)).toBeInTheDocument();
            restore();
        });

        it('renders third eye badge for known effects', () => {
            const restore = vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'The Third Eye', effect: 'darkvision_120' }];
                return null;
            });
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Darkvision 120 ft\./)).toBeInTheDocument();
            restore();
        });

        it('renders third eye generic Active badge for unknown effect', () => {
            const restore = vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [{ name: 'The Third Eye', effect: 'unknown_effect' }];
                return null;
            });
            const stats = makeStats({
                level: 5,
                class: { name: 'Wizard', class_levels: [{ level: 5 }] },
                automation: { passives: [] },
            });
            renderComponent(stats);
            expect(screen.getByText(/Active/)).toBeInTheDocument();
            restore();
        });

        it('does not render third eye badge when buff is absent', () => {
            const restore = vi.mocked(useRuntimeValue).mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });
            renderComponent(wizardStats());
            expect(screen.queryByText(/Darkvision 120 ft\./)).not.toBeInTheDocument();
            expect(screen.queryByText(/The Third Eye:/)).not.toBeInTheDocument();
            restore();
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

    describe('main CharClassFeatures entry point', () => {
        it('renders Adrenaline Rush tracked resource when bonus_action_dash special action exists', () => {
            const stats = makeStats({
                class: { name: 'UnknownClass' },
                automation: { specialActions: [{ effect: 'bonus_action_dash' }] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Adrenaline Rush')).toBeInTheDocument();
        });

        it('does not render Adrenaline Rush when no bonus_action_dash special action', () => {
            const stats = makeStats({
                class: { name: 'UnknownClass' },
                automation: { specialActions: [] },
            });
            renderComponent(stats);
            expect(screen.queryByTestId('tracked-resource-Adrenaline Rush')).not.toBeInTheDocument();
        });

        it('renders Adrenaline Rush with proficiency as max when bonus_action_dash exists', () => {
            const stats = makeStats({
                class: { name: 'UnknownClass' },
                automation: { specialActions: [{ effect: 'bonus_action_dash' }] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('tracked-resource-Adrenaline Rush')).toHaveTextContent('3');
        });

        it('renders class component and Adrenaline Rush when both exist', () => {
            const stats = makeStats({
                class: { name: 'Cleric', class_levels: [{ level: 5 }] },
                automation: { passives: [], specialActions: [{ effect: 'bonus_action_dash' }] },
            });
            renderComponent(stats);
            expect(screen.getByTestId('char-class-cleric')).toBeInTheDocument();
            expect(screen.getByTestId('tracked-resource-Adrenaline Rush')).toBeInTheDocument();
        });

        it('returns null when no class component and no adrenaline rush', () => {
            const stats = makeStats({
                class: { name: 'UnknownClass' },
                automation: { specialActions: [] },
            });
            const { container } = renderComponent(stats);
            expect(container.innerHTML).toBe('');
        });
    });
});
