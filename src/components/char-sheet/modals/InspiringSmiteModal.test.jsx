import { render, screen, fireEvent } from '@testing-library/react/pure';
import InspiringSmiteModal from './InspiringSmiteModal';

describe('InspiringSmiteModal', () => {
    const mockOnConfirm = vi.fn();
    const mockOnSkip = vi.fn();

    beforeEach(() => {
        mockOnConfirm.mockClear();
        mockOnSkip.mockClear();
    });
    const baseProps = {
        creatureTargets: [
            { name: 'Ally1', type: 'player' },
            { name: 'Ally2', type: 'player' },
            { name: 'Self', type: 'player' },
        ],
        tempHp: 18,
        roll: '2d8 + 5',
        onConfirm: mockOnConfirm,
        onSkip: mockOnSkip,
    };

    it('renders the modal title', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        expect(screen.getByText('Inspiring Smite')).toBeInTheDocument();
    });

    it('renders the roll note with total', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        expect(screen.getByText(/Rolled 2d8 \+ 5: 18 total temp HP/)).toBeInTheDocument();
    });

    it('renders all targets', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        expect(screen.getByText('Ally1')).toBeInTheDocument();
        expect(screen.getByText('Ally2')).toBeInTheDocument();
        expect(screen.getByText('Self')).toBeInTheDocument();
    });

    it('shows pool bar with total', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        expect(screen.getByText('Pool: 18 HP')).toBeInTheDocument();
        expect(screen.getByText('Allocated: 0 / 18')).toBeInTheDocument();
        expect(screen.getByText('Remaining: 18')).toBeInTheDocument();
    });

    it('renders confirm and skip buttons', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        expect(screen.getByRole('button', { name: /Inspire \(0\)/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });

    it('calls onSkip when skip button is clicked', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay is clicked', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        const overlay = document.querySelector('.inspiring-smite-overlay');
        fireEvent.click(overlay);
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onConfirm when no targets selected', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        const confirmBtn = screen.getByRole('button', { name: /Inspire \(0\)/ });
        expect(confirmBtn).toBeDisabled();
    });

    it('allows selecting targets with checkboxes', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        const checkbox = screen.getByLabelText('Ally1').closest('.inspiring-smite-target-header')?.querySelector('input')
            || screen.getAllByRole('checkbox')[0];
        fireEvent.click(checkbox);
        const confirmBtn = screen.getByRole('button', { name: /Inspire \(1\)/ });
        expect(confirmBtn).not.toBeDisabled();
    });

    it('shows allocation controls when target is selected', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        const checkbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(checkbox);
        expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('allows adjusting allocation with +/- buttons', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        const checkbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(checkbox);
        const input = screen.getByRole('spinbutton');
        fireEvent.change(input, { target: { value: '5' } });
        expect(input.value).toBe('5');
    });

    it('caps allocation at total pool', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        const checkbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(checkbox);
        const input = screen.getByRole('spinbutton');
        fireEvent.change(input, { target: { value: '999' } });
        expect(Number(input.value)).toBe(18);
    });

    it('calls onConfirm with distribution object when targets selected with allocations', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);
        const inputs = screen.getAllByRole('spinbutton');
        fireEvent.change(inputs[0], { target: { value: '10' } });
        fireEvent.change(inputs[1], { target: { value: '5' } });
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(2\)/ }));
        expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 10, Ally2: 5 });
    });

    it('does not call onConfirm when targets selected but all allocations are zero', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        const checkbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(checkbox);
        fireEvent.click(screen.getByRole('button', { name: /Inspire \(1\)/ }));
        expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('updates allocated/remaining display on allocation change', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        const checkbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(checkbox);
        const input = screen.getByRole('spinbutton');
        fireEvent.change(input, { target: { value: '7' } });
        expect(screen.getByText('Allocated: 7 / 18')).toBeInTheDocument();
        expect(screen.getByText('Remaining: 11')).toBeInTheDocument();
    });

    it('shows unallocated warning when some HP is left', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        const checkbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(checkbox);
        const input = screen.getByRole('spinbutton');
        fireEvent.change(input, { target: { value: '5' } });
        expect(screen.getByText(/13 HP unallocated/)).toBeInTheDocument();
    });

    it('hides unallocated message when no allocations', () => {
        render(<InspiringSmiteModal {...baseProps} />);
        expect(screen.queryByText(/HP unallocated/)).not.toBeInTheDocument();
    });

    it('renders with no targets', () => {
        render(<InspiringSmiteModal {...baseProps} creatureTargets={[]} />);
        expect(screen.getByText('No targets available.')).toBeInTheDocument();
    });
});
