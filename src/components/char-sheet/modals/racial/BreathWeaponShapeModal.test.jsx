import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BreathWeaponShapeModal from './BreathWeaponShapeModal.jsx';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/automation/index.js', () => ({
    executeHandler: vi.fn(() => Promise.resolve(null)),
}));

import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../../../services/automation/index.js';

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

    it('renders Choose Shape button disabled when nothing selected', () => {
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

    // ── Selection behavior ──

    it('enables Choose Shape button after selecting cone radio', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        const chooseBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Choose Shape'));
        expect(chooseBtn).toBeEnabled();
    });

    it('enables Choose Shape button after selecting line radio', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[1]);
        const chooseBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Choose Shape'));
        expect(chooseBtn).toBeEnabled();
    });

    it('modal stays visible after selecting cone radio', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('modal stays visible after selecting line radio', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[1]);
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('checks cone radio on click', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        expect(radios[0]).toBeChecked();
    });

    it('checks line radio on click', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[1]);
        expect(radios[1]).toBeChecked();
    });

    it('switches selection when different radio is clicked', () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        expect(radios[0]).toBeChecked();
        fireEvent.click(radios[1]);
        expect(radios[0]).not.toBeChecked();
        expect(radios[1]).toBeChecked();
    });

    // ── Handle choose flow ──

    it('calls setRuntimeValue with correct args when cone selected', async () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        await act(async () => {
            fireEvent.click(Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Choose Shape')));
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('DragonbornFighter', '_Breath_Weapon_option', 'cone', 'test-campaign');
    });

    it('calls setRuntimeValue with correct args when line selected', async () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[1]);
        await act(async () => {
            fireEvent.click(Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Choose Shape')));
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('DragonbornFighter', '_Breath_Weapon_option', 'line', 'test-campaign');
    });

    it('calls onClose after choosing', async () => {
        const onClose = vi.fn();
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={onClose} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        await act(async () => {
            fireEvent.click(Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Choose Shape')));
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls executeHandler after choosing', async () => {
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        await act(async () => {
            fireEvent.click(Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Choose Shape')));
        });
        expect(executeHandler).toHaveBeenCalledWith(mockAction, mockPlayerStats, mockCampaignName, null);
    });

    it('dispatches automation-result event when executeHandler returns a result', async () => {
        executeHandler.mockResolvedValue({ type: 'popup', payload: { message: 'done' } });
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        await act(async () => {
            fireEvent.click(Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Choose Shape')));
        });
        expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
        const event = dispatchSpy.mock.calls[0][0];
        expect(event.type).toBe('automation-result');
        expect(event.detail).toEqual({ type: 'popup', payload: { message: 'done' } });
        dispatchSpy.mockRestore();
    });

    it('does not dispatch automation-result event when executeHandler returns null', async () => {
        executeHandler.mockResolvedValue(null);
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        render(<BreathWeaponShapeModal action={mockAction} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        await act(async () => {
            fireEvent.click(Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Choose Shape')));
        });
        expect(dispatchSpy).not.toHaveBeenCalled();
        dispatchSpy.mockRestore();
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

    it('optionKey replaces multiple spaces with single underscore', async () => {
        const actionWithSpaces = { name: 'Breath  Weapon' };
        render(<BreathWeaponShapeModal action={actionWithSpaces} playerStats={mockPlayerStats} campaignName={mockCampaignName} onClose={vi.fn()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        await act(async () => {
            fireEvent.click(Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Choose Shape')));
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('DragonbornFighter', '_Breath_Weapon_option', 'cone', 'test-campaign');
    });
});
