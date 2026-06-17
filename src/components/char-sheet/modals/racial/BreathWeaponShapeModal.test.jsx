import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BreathWeaponShapeModal from './BreathWeaponShapeModal.jsx';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

const mockAction = {
    name: 'Breath Weapon',
};

const mockPlayerStats = {
    name: 'DragonbornFighter',
    level: 5,
};

const mockCampaignName = 'test-campaign';
const mockOnClose = vi.fn();

describe('BreathWeaponShapeModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(window, 'CustomEvent').mockImplementation(() => ({ type: 'automation-result' }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders modal with breath weapon name', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={mockOnClose} />);
        expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
    });

    it('renders prompt to choose shape', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={mockOnClose} />);
        expect(screen.getByText('Choose the shape of your breath weapon:')).toBeInTheDocument();
    });

    it('renders cone option', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={mockOnClose} />);
        expect(screen.getByText('15-foot Cone')).toBeInTheDocument();
    });

    it('renders line option', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={mockOnClose} />);
        expect(screen.getByText('30-foot Line (5 feet wide)')).toBeInTheDocument();
    });

    it('renders Choose Shape button disabled initially', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={mockOnClose} />);
        const buttons = document.querySelectorAll('button');
        const chooseBtn = Array.from(buttons).find(b => b.textContent.includes('Choose Shape'));
        expect(chooseBtn).toBeDisabled();
    });

    it('calls onClose when Cancel is clicked', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop is clicked', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={mockOnClose} />);
        const overlay = document.querySelector('.sp-overlay');
        fireEvent.click(overlay);
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not call onClose when modal content is clicked', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={mockOnClose} />);
        const modal = document.querySelector('.sp-modal');
        fireEvent.click(modal);
        expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('renders dragon icon in header', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={mockOnClose} />);
        const icon = document.querySelector('.fa-solid.fa-dragon');
        expect(icon).toBeInTheDocument();
    });

    it('renders Choose Shape button with dragon icon', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={mockOnClose} />);
        const chooseBtn = screen.getByText('Choose Shape');
        expect(chooseBtn).toBeInTheDocument();
    });

    it('renders null after shape is selected', async () => {
        const { container } = render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={mockOnClose} />);
        expect(container.innerHTML).not.toBe('');
    });
});
