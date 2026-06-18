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

describe('BreathWeaponShapeModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Initial render / structure ──

    it('renders modal overlay', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders modal container', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('renders modal header', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(document.querySelector('.sp-header')).toBeInTheDocument();
    });

    it('renders modal body', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(document.querySelector('.sp-body')).toBeInTheDocument();
    });

    it('renders modal actions area', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders header with dragon icon and action name', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const icon = document.querySelector('.fa-solid.fa-dragon');
        expect(icon).toBeInTheDocument();
        expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
    });

    it('renders prompt to choose shape', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(screen.getByText('Choose the shape of your breath weapon:')).toBeInTheDocument();
    });

    it('renders cone option text', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(screen.getByText('15-foot Cone')).toBeInTheDocument();
    });

    it('renders line option text', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(screen.getByText('30-foot Line (5 feet wide)')).toBeInTheDocument();
    });

    it('renders cancel button', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders Choose Shape button disabled', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const buttons = document.querySelectorAll('button');
        const chooseBtn = Array.from(buttons).find(b => b.textContent.includes('Choose Shape'));
        expect(chooseBtn).toBeDisabled();
    });

    it('renders Choose Shape button with dragon icon', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const icon = document.querySelector('.sp-roll-btn .fa-solid.fa-dragon');
        expect(icon).toBeInTheDocument();
    });

    // ── Close behavior ──

    it('calls onClose when Cancel is clicked', () => {
        const onClose = vi.fn();
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={onClose} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay backdrop is clicked', () => {
        const onClose = vi.fn();
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={onClose} />);
        fireEvent.click(document.querySelector('.sp-overlay'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when modal content is clicked', () => {
        const onClose = vi.fn();
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={onClose} />);
        fireEvent.click(document.querySelector('.sp-modal'));
        expect(onClose).not.toHaveBeenCalled();
    });

    // ── Action name fallback ──

    it('shows default title when action.name is missing', () => {
        render(<BreathWeaponShapeModal action={{}} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
    });

    it('shows default title when action is null', () => {
        render(<BreathWeaponShapeModal action={null} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
    });

    it('shows default title when action is undefined', () => {
        render(<BreathWeaponShapeModal action={undefined} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
    });

    // ── Radio button existence ──

    it('renders two radio inputs', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const inputs = document.querySelectorAll('input[type="radio"]');
        expect(inputs).toHaveLength(2);
    });

    it('radio inputs have name breathWeaponShape', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const inputs = document.querySelectorAll('input[name="breathWeaponShape"]');
        expect(inputs).toHaveLength(2);
    });

    // ── Selection causes component to return null (current behavior) ──

    it('returns null after selecting cone radio', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        const coneInput = document.querySelector('input[type="radio"]');
        fireEvent.click(coneInput);
        expect(document.querySelector('.sp-overlay')).not.toBeInTheDocument();
    });

    it('returns null after selecting line radio', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        const inputs = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(inputs[1]);
        expect(document.querySelector('.sp-overlay')).not.toBeInTheDocument();
    });

    // ── Edge cases ──

    it('renders with dragon icon in header even without action name', () => {
        render(<BreathWeaponShapeModal action={null} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const icon = document.querySelector('.fa-solid.fa-dragon');
        expect(icon).toBeInTheDocument();
    });

    it('renders damage description text for cone', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const matches = screen.getAllByText(/15-foot cone/i);
        expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('renders damage description text for line', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const matches = screen.getAllByText(/30-foot line/i);
        expect(matches.length).toBeGreaterThanOrEqual(1);
    });
});
