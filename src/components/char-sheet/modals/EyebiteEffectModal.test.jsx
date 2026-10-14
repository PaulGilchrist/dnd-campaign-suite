import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EyebiteEffectModal from './EyebiteEffectModal.jsx';

vi.mock('./shared/SecondaryTargetModal.jsx', () => {
    return {
        default: vi.fn(({ title, targets, onTargetSelected, onSkip, description, confirmLabel, confirmIcon }) => {
            const firstTargetName = targets.length > 0 ? (targets[0].name || targets[0].value) : null;
            return (
                <div data-testid="secondary-target-modal">
                    <span data-testid="stm-title">{title}</span>
                    <span data-testid="stm-icon">{confirmIcon}</span>
                    <span data-testid="stm-description">{description}</span>
                    <span data-testid="stm-confirmLabel">{confirmLabel}</span>
                    <span data-testid="stm-targetCount">{targets.length}</span>
                    <button
                        onClick={() => onTargetSelected(firstTargetName)}
                        data-testid="stm-confirm"
                        type="button"
                    >
                        {confirmLabel}
                    </button>
                    <button onClick={onSkip} data-testid="stm-skip" type="button">
                        Skip
                    </button>
                    {targets.map((t, i) => (
                        <span key={i} data-testid={`stm-target-${i}`}>{t.name || t.value}</span>
                    ))}
                </div>
            );
        }),
    };
});

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: (name) => name,
        guid: vi.fn(() => 'test-guid-123'),
    },
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
    sendSaveResult: vi.fn(),
}));

vi.mock('../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

import utils from '../../../services/ui/utils.js';

const baseProps = {
    combatSummary: {
        creatures: [
            { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 2, dex: 0 } },
            { name: 'Orc Warrior', type: 'npc', saveBonuses: { wis: 4, dex: 2 } },
            { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1, dex: 3 } },
        ],
    },
    attackerName: 'Witch1',
    saveDc: 13,
    campaignName: 'test-campaign',
    onClose: vi.fn(),
    characters: [],
    featureName: 'Eyebite',
    rangeFeet: 60,
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

describe('EyebiteEffectModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        utils.guid.mockReturnValue('test-guid-123');
    });

    describe('initial render', () => {
        it('renders 3 effect options: Asleep, Panicked, Sickened', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: /Asleep/ })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Panicked/ })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Sickened/ })).toBeInTheDocument();
        });

        it('renders effect descriptions using 2024 rules text', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            expect(screen.getByText(/The target has the Unconscious condition/)).toBeInTheDocument();
            expect(screen.getByText(/The target has the Frightened condition/)).toBeInTheDocument();
            expect(screen.getByText(/The target has the Poisoned condition/)).toBeInTheDocument();
        });

        it('navigates to target selection after picking an effect', async () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await waitFor(() => {
                expect(screen.getByTestId('secondary-target-modal')).toBeInTheDocument();
            });
        });

        it('calls onClose when Cancel is clicked', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(baseProps.onClose).toHaveBeenCalled();
        });
    });

    describe('secondary target modal content', () => {
        it('excludes caster from targets', () => {
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Witch1', type: 'player', saveBonuses: { wis: 5 } },
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 2 } },
                    ],
                },
                attackerName: 'Witch1',
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByTestId('stm-targetCount')).toHaveTextContent('1');
        });

        it('passes correct description with range and DC', () => {
            render(<EyebiteEffectModal {...makeProps({ rangeFeet: 30 })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            const desc = screen.getByTestId('stm-description');
            expect(desc.textContent).toContain('30 feet');
            expect(desc.textContent).toContain('DC 13');
            expect(desc.textContent).toContain('WIS');
        });

        it('calls onSkip when Skip is clicked', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            fireEvent.click(screen.getByTestId('stm-skip'));
            expect(baseProps.onClose).toHaveBeenCalled();
        });
    });

    describe('custom props', () => {
        it('uses custom featureName in header and modal title', () => {
            render(<EyebiteEffectModal {...makeProps({ featureName: 'Witch Eyebite' })} />);
            expect(screen.getByText('Witch Eyebite')).toBeInTheDocument();
        });
    });

    describe('edge cases', () => {
        it('renders empty target list when no creatures exist', () => {
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: { creatures: [] },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByTestId('stm-targetCount')).toHaveTextContent('0');
        });

        it('renders all non-attacker creatures as targets', () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            expect(screen.getByTestId('stm-target-0')).toHaveTextContent('Goblin1');
            expect(screen.getByTestId('stm-target-1')).toHaveTextContent('Orc Warrior');
            expect(screen.getByTestId('stm-target-2')).toHaveTextContent('Elf Mage');
        });
    });
});
