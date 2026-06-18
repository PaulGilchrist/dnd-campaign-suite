// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ShortRestModal from './ShortRestModal.jsx';

const getRuntimeValueMock = vi.fn(() => null);
const setRuntimeValueMock = vi.fn();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((...args) => getRuntimeValueMock(...args)),
    setRuntimeValue: vi.fn((...args) => setRuntimeValueMock(...args)),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollDice: vi.fn((count, _die) => ({ total: count * 4, rolls: Array(count).fill(4) })),
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
    getHitDieSize: vi.fn(() => 8),
    computeHitDieRecovery: vi.fn((roll, conBonus) => roll + conBonus),
    SHORT_REST_RESOURCES: ['spell_slots_level_1', 'spell_slots_level_2'],
    getShortRestResourceLabels: vi.fn(() => ['Spell Slots (1st+)', 'Hit Dice']),
}));

const clearAllExpirationEffectsMock = vi.fn();
vi.mock('../../services/rules/effects/expirations.js', () => ({
    clearAllExpirationEffects: vi.fn((...args) => clearAllExpirationEffectsMock(...args)),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => ({ songOfRestDie: 6 })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 2),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => null),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadSpellData: vi.fn(() => Promise.resolve([])),
}));

const mockCampaignName = 'test-campaign';

function createPlayerStats(overrides = {}) {
    return {
        name: 'Thorin',
        level: 5,
        hitPoints: 45,
        proficiency: 3,
        abilities: [
            { name: 'Constitution', bonus: 2 },
            { name: 'Charisma', bonus: 3 },
            { name: 'Wisdom', bonus: 2 },
        ],
        class: { name: 'Cleric', major: { name: 'Cleric' } },
        automation: { passives: [], actions: [] },
        spellAbilities: {
            spell_slots_level_1: 4,
            spell_slots_level_2: 3,
            spells: [{ name: 'Healing Word', prepared: 'Prepared' }],
        },
        inventory: { equipped: [] },
        ...overrides,
    };
}

function renderModal(overrides = {}) {
    const playerStats = createPlayerStats(overrides);
    const onClose = vi.fn();
    const onComplete = vi.fn();
    const rendered = render(
        <ShortRestModal
            playerStats={playerStats}
            campaignName={mockCampaignName}
            onClose={onClose}
            onComplete={onComplete}
        />
    );
    return { ...rendered, onClose, onComplete, playerStats };
}

function setupGetRuntimeValue(returns) {
    getRuntimeValueMock.mockImplementation((_name, key) => {
        if (key in returns) return returns[key];
        return null;
    });
}

describe('ShortRestModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValueMock.mockImplementation(() => null);
    });

    describe('rendering', () => {
        it('renders the modal title', () => {
            renderModal();
            expect(screen.getByText('Short Rest')).toBeInTheDocument();
        });

        it('displays hit dice information with correct die size and count', () => {
            renderModal();
            expect(screen.getByText(/of 5 remaining/)).toBeInTheDocument();
        });

        it('renders dice roll buttons', () => {
            renderModal();
            expect(screen.getByText('Roll One')).toBeInTheDocument();
            expect(screen.getByText(/Roll All/)).toBeInTheDocument();
        });

        it('renders Song of Rest section when class feature is available', () => {
            renderModal();
            expect(screen.getByText('Song of Rest')).toBeInTheDocument();
        });

        it('renders Resources Restored section with labels', () => {
            renderModal();
            expect(screen.getByText('Resources Restored')).toBeInTheDocument();
        });

        it('renders action buttons', () => {
            renderModal();
            expect(screen.getByText('Complete Short Rest')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
        });

        it('does not render class features the character does not have', () => {
            renderModal();
            expect(screen.queryByText('Sorcerous Restoration')).not.toBeInTheDocument();
            expect(screen.queryByText('Font of Inspiration')).not.toBeInTheDocument();
            expect(screen.queryByText('Arcane Recovery')).not.toBeInTheDocument();
            expect(screen.queryByText('Memorize Spell')).not.toBeInTheDocument();
            expect(screen.queryByText('Bolstering Treats')).not.toBeInTheDocument();
        });
    });

    describe('hit dice rolling', () => {
        it('shows roll log and recovered HP after rolling one die', () => {
            renderModal();
            fireEvent.click(screen.getByText('Roll One'));
            expect(screen.getByText('Roll')).toBeInTheDocument();
            expect(screen.getByText('HP Recovered')).toBeInTheDocument();
            expect(screen.getByText('Total HP Recovered:')).toBeInTheDocument();
        });

        it('rolls all remaining hit dice when Roll All is clicked', () => {
            renderModal();
            fireEvent.click(screen.getByText(/Roll All/));
            expect(screen.getByText('Total HP Recovered:')).toBeInTheDocument();
        });

        it('disables dice buttons when no hit dice remain', () => {
            setupGetRuntimeValue({ shortRestHitDice: 0 });
            renderModal();
            expect(screen.getByText('Roll One')).toBeDisabled();
            expect(screen.getByText(/Roll All/)).toBeDisabled();
        });

        it('decrements remaining hit dice count after rolling one', () => {
            renderModal();
            fireEvent.click(screen.getByText('Roll One'));
            const hitDiceText = screen.getByText(/d8 —/);
            expect(hitDiceText.textContent).toContain('4');
        });

        it('accumulates recovered HP from roll log entries', () => {
            renderModal();
            fireEvent.click(screen.getByText('Roll One'));
            const container = screen.getByText(/Total HP Recovered:/).parentElement;
            expect(container.textContent).toContain('6');
        });
    });

    describe('Song of Rest', () => {
        it('applies Song of Rest and hides the button', async () => {
            renderModal();
            await act(async () => {
                fireEvent.click(screen.getByText(/Apply Song of Rest/));
                await Promise.resolve();
            });
            expect(screen.queryByText(/Apply Song of Rest/)).not.toBeInTheDocument();
        });

        it('adds Song of Rest entry to roll log', async () => {
            renderModal();
            await act(async () => {
                fireEvent.click(screen.getByText(/Apply Song of Rest/));
                await Promise.resolve();
            });
            const songRows = screen.queryAllByText(/Song of Rest/);
            expect(songRows.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('class-specific features', () => {
        describe('Sorcerous Restoration', () => {
            it('renders for Sorcerer with resource_restoration passive', () => {
                renderModal({
                    class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
                    automation: { passives: [{ type: 'resource_restoration' }] },
                });
                expect(screen.getByText('Sorcerous Restoration')).toBeInTheDocument();
            });

            it('shows applied state after requesting restoration when uses are available', () => {
                setupGetRuntimeValue({ sorcerousRestorationUses: 1 });
                renderModal({
                    class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
                    automation: { passives: [{ type: 'resource_restoration' }] },
                });
                fireEvent.click(screen.getByText(/Regain.*Sorcery Points/));
                expect(screen.getByText('Restoration requested')).toBeInTheDocument();
            });

            it('does not show button when restoration uses are exhausted', () => {
                setupGetRuntimeValue({ sorcerousRestorationUses: 0 });
                renderModal({
                    class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
                    automation: { passives: [{ type: 'resource_restoration' }] },
                });
                expect(screen.queryByText(/Regain.*Sorcery Points/)).not.toBeInTheDocument();
            });
        });

        describe('Font of Inspiration', () => {
            it('renders for Bard with font_of_inspiration passive', () => {
                renderModal({
                    class: { name: 'Bard', major: { name: 'Bard' } },
                    automation: { passives: [{ type: 'font_of_inspiration' }] },
                });
                expect(screen.getByText('Font of Inspiration')).toBeInTheDocument();
            });

            it('shows applied state after using Font of Inspiration when uses are below max', () => {
                setupGetRuntimeValue({ bardicInspirationUses: 0 });
                renderModal({
                    class: { name: 'Bard', major: { name: 'Bard' } },
                    automation: { passives: [{ type: 'font_of_inspiration' }] },
                });
                const button = screen.getByRole('button', { name: /Regain.*Bardic Inspiration Uses/ });
                fireEvent.click(button);
                expect(screen.getByText('Font of Inspiration applied')).toBeInTheDocument();
            });
        });

        describe('Arcane Recovery', () => {
            it('renders for Wizard with arcane recovery passive when available', () => {
                setupGetRuntimeValue({ arcaneRecoveryLevels: 2 });
                renderModal({
                    class: { name: 'Wizard', major: { name: 'Wizard' } },
                    automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
                });
                expect(screen.getByText('Arcane Recovery')).toBeInTheDocument();
            });

            it('does not render when arcane recovery is at zero', () => {
                setupGetRuntimeValue({ arcaneRecoveryLevels: 0 });
                renderModal({
                    class: { name: 'Wizard', major: { name: 'Wizard' } },
                    automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
                });
                expect(screen.queryByText('Arcane Recovery')).not.toBeInTheDocument();
            });
        });

        describe('Memorize Spell', () => {
            it('renders for Wizard with memorize_spell passive', () => {
                renderModal({
                    class: { name: 'Wizard', major: { name: 'Wizard' } },
                    automation: { passives: [{ type: 'memorize_spell' }] },
                });
                expect(screen.getByText('Memorize Spell')).toBeInTheDocument();
            });
        });

        describe('Bolstering Treats', () => {
            it('renders when temp_hp_buff passive with correct name exists', () => {
                renderModal({
                    automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
                });
                expect(screen.getByText('Bolstering Treats')).toBeInTheDocument();
            });

            it('shows applied state after crafting treats', () => {
                renderModal({
                    automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
                });
                fireEvent.click(screen.getByText(/Craft Bolstering Treats/));
                expect(screen.getByText('Treats crafted')).toBeInTheDocument();
            });
        });
    });

    describe('completion', () => {
        it('calls onComplete when Complete Short Rest is clicked', () => {
            const { onComplete } = renderModal();
            fireEvent.click(screen.getByText('Complete Short Rest'));
            expect(onComplete).toHaveBeenCalledTimes(1);
        });

        it('persists remaining hit dice via setRuntimeValue on completion', () => {
            const { onComplete } = renderModal();
            fireEvent.click(screen.getByText('Complete Short Rest'));
            expect(setRuntimeValueMock).toHaveBeenCalledWith(
                'Thorin',
                'shortRestHitDice',
                5,
                mockCampaignName
            );
            expect(onComplete).toHaveBeenCalledTimes(1);
        });

        it('clears expiration effects on completion', () => {
            const { onComplete } = renderModal();
            fireEvent.click(screen.getByText('Complete Short Rest'));
            expect(clearAllExpirationEffectsMock).toHaveBeenCalledWith('Thorin', mockCampaignName);
            expect(onComplete).toHaveBeenCalledTimes(1);
        });

        it('resets spell slot resources to null on completion', () => {
            renderModal();
            fireEvent.click(screen.getByText('Complete Short Rest'));
            const spellSlotCalls = setRuntimeValueMock.mock.calls.filter(
                (call) => call[1] === 'spell_slots_level_1'
            );
            expect(spellSlotCalls.length).toBeGreaterThan(0);
            expect(spellSlotCalls[0][2]).toBeNull();
        });

        it('updates current hit points with recovered HP on completion', () => {
            renderModal();
            fireEvent.click(screen.getByText('Roll One'));
            fireEvent.click(screen.getByText('Complete Short Rest'));
            const hpCalls = setRuntimeValueMock.mock.calls.filter(
                (call) => call[1] === 'currentHitPoints'
            );
            expect(hpCalls.length).toBeGreaterThan(0);
        });
    });

    describe('closing', () => {
        it('calls onClose when Cancel is clicked', () => {
            const { onClose } = renderModal();
            fireEvent.click(screen.getByText('Cancel'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('calls onClose when Escape key is pressed', () => {
            const { onClose } = renderModal();
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('calls onClose when clicking the overlay outside the modal', () => {
            const { onClose } = renderModal();
            const overlay = document.querySelector('.short-rest-overlay');
            fireEvent.click(overlay);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not close when clicking inside the modal', () => {
            const { onClose } = renderModal();
            fireEvent.click(screen.getByText('Short Rest'));
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('renders without onComplete callback without throwing', () => {
            const onClose = vi.fn();
            render(
                <ShortRestModal
                    playerStats={createPlayerStats()}
                    campaignName={mockCampaignName}
                    onClose={onClose}
                />
            );
            expect(screen.getByText('Short Rest')).toBeInTheDocument();
            fireEvent.click(screen.getByText('Complete Short Rest'));
            expect(onClose).not.toHaveBeenCalled();
        });

        it('handles playerStats with no abilities gracefully', () => {
            renderModal({ abilities: [] });
            expect(screen.getByText('Short Rest')).toBeInTheDocument();
        });

        it('handles playerStats with no class gracefully', () => {
            renderModal({ class: null });
            expect(screen.getByText('Short Rest')).toBeInTheDocument();
        });

        it('handles playerStats with no automation passives gracefully', () => {
            renderModal({ automation: null });
            expect(screen.getByText('Short Rest')).toBeInTheDocument();
        });
    });
});
