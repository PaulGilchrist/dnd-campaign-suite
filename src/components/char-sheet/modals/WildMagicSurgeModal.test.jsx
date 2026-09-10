// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WildMagicSurgeModal from './WildMagicSurgeModal.jsx';
import * as handler from '../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js';

vi.mock('../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js', () => ({
    onSurgeSelected: vi.fn(async () => null),
    onTamedSurgeSelected: vi.fn(async () => null),
}));

const surgeTable = [
    { min: 1, max: 4, effect: 'Effect 1' },
    { min: 5, max: 8, effect: 'Effect 2' },
    { min: 9, max: 12, effect: 'Effect 3' },
    { min: 13, max: 16, effect: 'Effect 4' },
    { min: 17, max: 20, effect: 'Effect 5' },
    { min: 21, max: 24, effect: 'Effect 6' },
    { min: 25, max: 28, effect: 'Effect 7' },
    { min: 29, max: 32, effect: 'Effect 8' },
    { min: 33, max: 36, effect: 'Effect 9' },
    { min: 37, max: 40, effect: 'Effect 10' },
    { min: 41, max: 44, effect: 'Effect 11' },
    { min: 45, max: 48, effect: 'Effect 12' },
    { min: 49, max: 52, effect: 'Effect 13' },
    { min: 53, max: 56, effect: 'Effect 14' },
    { min: 57, max: 60, effect: 'Effect 15' },
    { min: 61, max: 64, effect: 'Effect 16' },
    { min: 65, max: 68, effect: 'Effect 17' },
    { min: 69, max: 72, effect: 'Effect 18' },
    { min: 73, max: 76, effect: 'Effect 19' },
    { min: 77, max: 80, effect: 'Effect 20' },
    { min: 81, max: 84, effect: 'Effect 21' },
    { min: 85, max: 88, effect: 'Effect 22' },
    { min: 89, max: 92, effect: 'Effect 23' },
    { min: 93, max: 96, effect: 'Effect 24' },
    { min: 97, max: 100, effect: 'Effect 25' },
];

const defaultProps = {
    featureName: 'Wild Magic Surge',
    surgeTable,
    campaignName: 'test-campaign',
    playerStats: { name: 'TestSorcerer' },
    mode: 'roll',
    onClose: vi.fn(),
    roll: 42,
};

describe('WildMagicSurgeModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('default (roll) mode', () => {
        it('displays the rolled number and its matched effect', () => {
            render(<WildMagicSurgeModal {...defaultProps} />);
            expect(screen.getByTestId('wild-magic-surge-modal')).toBeInTheDocument();
            expect(screen.getByText('Effect 11')).toBeInTheDocument();
        });

        it('displays the feature name in the header', () => {
            render(<WildMagicSurgeModal {...defaultProps} featureName="Arcane Chaos" />);
            expect(screen.getByText('Arcane Chaos')).toBeInTheDocument();
        });

        it('calls onClose when Done is clicked', async () => {
            render(<WildMagicSurgeModal {...defaultProps} />);
            const doneBtn = screen.getByRole('button', { name: 'Done' });
            fireEvent.click(doneBtn);
            await waitFor(() => {
                expect(defaultProps.onClose).toHaveBeenCalled();
            });
        });

        it('persists the rolled surge via onSurgeSelected when Done is clicked (CLA-389)', async () => {
            handler.onSurgeSelected.mockResolvedValue({ type: 'popup', payload: {} });
            render(<WildMagicSurgeModal {...defaultProps} />);
            const doneBtn = screen.getByRole('button', { name: 'Done' });
            fireEvent.click(doneBtn);
            await waitFor(() => {
                expect(handler.onSurgeSelected).toHaveBeenCalledWith(
                    'Wild Magic Surge',
                    { name: 'TestSorcerer' },
                    'test-campaign',
                    42,
                    expect.objectContaining({ effect: 'Effect 11' })
                );
                expect(defaultProps.onClose).toHaveBeenCalled();
            });
        });

        it('closes without persisting when roll has no matching surge entry', async () => {
            render(<WildMagicSurgeModal {...defaultProps} roll={999} />);
            const doneBtn = screen.getByRole('button', { name: 'Done' });
            fireEvent.click(doneBtn);
            await waitFor(() => {
                expect(handler.onSurgeSelected).not.toHaveBeenCalled();
                expect(defaultProps.onClose).toHaveBeenCalled();
            });
        });

        it('shows no effect when roll is outside the table range', () => {
            render(<WildMagicSurgeModal {...defaultProps} roll={999} />);
            expect(screen.getByTestId('wild-magic-surge-modal')).toBeInTheDocument();
            expect(screen.queryByText(/Effect \d+/)).not.toBeInTheDocument();
        });
    });

    describe('controlledChaos mode', () => {
        const controlledProps = {
            ...defaultProps,
            mode: 'controlledChaos',
            roll1: 15,
            roll2: 87,
        };

        it('displays both roll numbers with matched effects and instruction text', () => {
            render(<WildMagicSurgeModal {...controlledProps} />);
            expect(screen.getByText(/Roll 1: 15/)).toBeInTheDocument();
            expect(screen.getByText(/Roll 2: 87/)).toBeInTheDocument();
            expect(screen.getByText('Effect 4')).toBeInTheDocument();
            expect(screen.getByText('Effect 22')).toBeInTheDocument();
            expect(screen.getByText('Controlled Chaos — Choose your roll:')).toBeInTheDocument();
        });

        it('disables Done button when no roll is selected', () => {
            render(<WildMagicSurgeModal {...controlledProps} />);
            const doneBtn = screen.getByRole('button', { name: 'Done' });
            expect(doneBtn).toBeDisabled();
        });

        it('enables Done button after a roll is selected', () => {
            render(<WildMagicSurgeModal {...controlledProps} />);
            const badges = document.querySelectorAll('.wms-roll-badge');
            fireEvent.click(badges[0]);
            const doneBtn = screen.getByRole('button', { name: 'Done' });
            expect(doneBtn).not.toBeDisabled();
        });

        it('calls onSurgeSelected and onClose when Done is clicked after selection', async () => {
            handler.onSurgeSelected.mockResolvedValue({ type: 'popup', payload: {} });
            render(<WildMagicSurgeModal {...controlledProps} />);
            const badges = document.querySelectorAll('.wms-roll-badge');
            fireEvent.click(badges[0]);
            const doneBtn = screen.getByRole('button', { name: 'Done' });
            fireEvent.click(doneBtn);
            await waitFor(() => {
                expect(handler.onSurgeSelected).toHaveBeenCalledWith(
                    'Wild Magic Surge',
                    { name: 'TestSorcerer' },
                    'test-campaign',
                    15,
                    expect.objectContaining({ effect: 'Effect 4' })
                );
                expect(defaultProps.onClose).toHaveBeenCalled();
            });
        });

        it('does not call onSurgeSelected when Done is clicked without selection', async () => {
            render(<WildMagicSurgeModal {...controlledProps} />);
            const doneBtn = screen.getByRole('button', { name: 'Done' });
            fireEvent.click(doneBtn);
            await waitFor(() => {
                expect(handler.onSurgeSelected).not.toHaveBeenCalled();
            });
        });
    });

    describe('tamedSurge mode', () => {
        const tamedProps = {
            ...defaultProps,
            mode: 'tamedSurge',
        };

        it('displays all entries except the last one with instruction text', () => {
            render(<WildMagicSurgeModal {...tamedProps} />);
            const entries = document.querySelectorAll('.wms-entry');
            expect(entries.length).toBe(24);
            expect(screen.getByText('Tamed Surge — Choose your effect:')).toBeInTheDocument();
            expect(screen.getByText('Choose one effect from the Wild Magic Surge table.')).toBeInTheDocument();
        });

        it('disables Confirm button when no surge is selected', () => {
            render(<WildMagicSurgeModal {...tamedProps} />);
            const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
            expect(confirmBtn).toBeDisabled();
        });

        it('calls onTamedSurgeSelected and onClose when Confirm is clicked after selection', async () => {
            handler.onTamedSurgeSelected.mockResolvedValue({ type: 'popup', payload: {} });
            render(<WildMagicSurgeModal {...tamedProps} />);
            const entries = document.querySelectorAll('.wms-entry');
            fireEvent.click(entries[0]);
            const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
            fireEvent.click(confirmBtn);
            await waitFor(() => {
                expect(handler.onTamedSurgeSelected).toHaveBeenCalledWith(
                    expect.objectContaining({ name: 'Wild Magic Surge' }),
                    { name: 'TestSorcerer' },
                    'test-campaign',
                    expect.objectContaining({ effect: 'Effect 1' })
                );
                expect(defaultProps.onClose).toHaveBeenCalled();
            });
        });

        it('calls onClose when Cancel is clicked', async () => {
            render(<WildMagicSurgeModal {...tamedProps} />);
            const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
            fireEvent.click(cancelBtn);
            await waitFor(() => {
                expect(defaultProps.onClose).toHaveBeenCalled();
            });
        });
    });
});
