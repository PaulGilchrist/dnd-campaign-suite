// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WildMagicSurgeModal from './WildMagicSurgeModal.jsx';
import * as handler from '../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js';

// Handler return values are ignored by the modal (it always closes after the
// await), so mocks resolve to null — a shape the real handlers really return.
vi.mock('../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js', () => ({
    onSurgeSelected: vi.fn(async () => null),
    onTamedSurgeSelected: vi.fn(async () => null),
}));

// Synthetic 25-row d100 table (4-wide buckets), mirroring the real
// surge-table entry shape { min, max, effect } used by the modal.
const surgeTable = Array.from({ length: 25 }, (_, i) => ({
    min: i * 4 + 1,
    max: i * 4 + 4,
    effect: `Effect ${i + 1}`,
}));

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

    describe('roll mode', () => {
        it('renders header, the rolled number, and its matched table effect', () => {
            render(<WildMagicSurgeModal {...defaultProps} />);
            const modal = screen.getByTestId('wild-magic-surge-modal');
            expect(screen.getByText('Wild Magic Surge')).toBeInTheDocument();
            expect(screen.getByText('Wild Magic Surge — Rolled: 42')).toBeInTheDocument();
            expect(screen.getByText('Rolled: 42')).toBeInTheDocument();
            expect(screen.getByText('Effect 11')).toBeInTheDocument();
            expect(modal).toBeInTheDocument();
        });

        it('Done persists the exact matched surge entry then closes (CLA-389)', async () => {
            render(<WildMagicSurgeModal {...defaultProps} />);
            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            await waitFor(() => {
                expect(handler.onSurgeSelected).toHaveBeenCalledTimes(1);
                expect(handler.onSurgeSelected).toHaveBeenCalledWith(
                    'Wild Magic Surge',
                    { name: 'TestSorcerer' },
                    'test-campaign',
                    42,
                    { min: 41, max: 44, effect: 'Effect 11' }
                );
                expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            });
        });

        it('a roll outside the table shows no effect and Done closes without persisting', async () => {
            render(<WildMagicSurgeModal {...defaultProps} roll={999} />);
            expect(screen.getByText('Rolled: 999')).toBeInTheDocument();
            expect(screen.queryByText(/Effect \d+/)).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            await waitFor(() => {
                expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            });
            expect(handler.onSurgeSelected).not.toHaveBeenCalled();
        });

        it('clicking blank modal background dismisses without persisting', () => {
            render(<WildMagicSurgeModal {...defaultProps} />);
            fireEvent.click(screen.getByText('Wild Magic Surge — Rolled: 42'));
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            expect(handler.onSurgeSelected).not.toHaveBeenCalled();
        });
    });

    describe('controlledChaos mode', () => {
        const controlledProps = {
            ...defaultProps,
            mode: 'controlledChaos',
            roll1: 15,
            roll2: 87,
        };

        it('shows both rolls with their effects and keeps Done disabled until a roll is chosen', () => {
            render(<WildMagicSurgeModal {...controlledProps} />);
            expect(screen.getByText('Controlled Chaos — Choose your roll:')).toBeInTheDocument();
            expect(screen.getByText('Roll 1: 15')).toBeInTheDocument();
            expect(screen.getByText('Effect 4')).toBeInTheDocument();
            expect(screen.getByText('Roll 2: 87')).toBeInTheDocument();
            expect(screen.getByText('Effect 22')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
        });

        it('choosing the second roll enables Done and persists only that roll', async () => {
            render(<WildMagicSurgeModal {...controlledProps} />);
            const doneBtn = screen.getByRole('button', { name: 'Done' });
            expect(doneBtn).toBeDisabled();

            fireEvent.click(screen.getByText('Roll 2: 87'));
            expect(doneBtn).not.toBeDisabled();

            fireEvent.click(doneBtn);
            await waitFor(() => {
                expect(handler.onSurgeSelected).toHaveBeenCalledTimes(1);
                expect(handler.onSurgeSelected).toHaveBeenCalledWith(
                    'Wild Magic Surge',
                    { name: 'TestSorcerer' },
                    'test-campaign',
                    87,
                    { min: 85, max: 88, effect: 'Effect 22' }
                );
                expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('tamedSurge mode', () => {
        const tamedProps = {
            ...defaultProps,
            mode: 'tamedSurge',
        };

        it('lists every row except the last as selectable entries with instruction copy', () => {
            render(<WildMagicSurgeModal {...tamedProps} />);
            expect(screen.getByText('Tamed Surge — Choose your effect:')).toBeInTheDocument();
            expect(screen.getByText('Choose one effect from the Wild Magic Surge table.')).toBeInTheDocument();
            // 24 entry buttons + Confirm + Cancel
            expect(screen.getAllByRole('button')).toHaveLength(26);
            expect(screen.getByText('1-4')).toBeInTheDocument();
            expect(screen.getByText('93-96')).toBeInTheDocument();
            expect(screen.queryByText('Effect 25')).not.toBeInTheDocument();
            expect(screen.queryByText('97-100')).not.toBeInTheDocument();
        });

        it('Confirm is disabled until a row is chosen, then persists that exact row and closes', async () => {
            render(<WildMagicSurgeModal {...tamedProps} />);
            const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
            expect(confirmBtn).toBeDisabled();

            fireEvent.click(screen.getByTitle('Effect 1'));
            expect(confirmBtn).not.toBeDisabled();

            fireEvent.click(confirmBtn);
            await waitFor(() => {
                expect(handler.onTamedSurgeSelected).toHaveBeenCalledTimes(1);
                expect(handler.onTamedSurgeSelected).toHaveBeenCalledWith(
                    { name: 'Wild Magic Surge', automation: { type: 'wild_magic_tamed' } },
                    { name: 'TestSorcerer' },
                    'test-campaign',
                    { min: 1, max: 4, effect: 'Effect 1' }
                );
                expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            });
        });

        it('Cancel closes without persisting', () => {
            render(<WildMagicSurgeModal {...tamedProps} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
            expect(handler.onTamedSurgeSelected).not.toHaveBeenCalled();
        });
    });
});
