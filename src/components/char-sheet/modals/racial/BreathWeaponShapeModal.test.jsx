// @improved-by-ai
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

const baseProps = {
    action: { name: 'Breath Weapon' },
    playerStats: { name: 'DragonbornFighter', level: 5 },
    campaignName: 'test-campaign',
    onClose: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

describe('BreathWeaponShapeModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Initial render / display ──

    it('renders modal overlay, container, header, body, and actions', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        expect(document.querySelector('.sp-header')).toBeInTheDocument();
        expect(document.querySelector('.sp-body')).toBeInTheDocument();
        expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders dragon icon and action name in header', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        const icon = document.querySelector('.fa-solid.fa-dragon');
        expect(icon).toBeInTheDocument();
        expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
    });

    it('renders dragon icon in choose shape button', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        const icon = document.querySelector('.sp-roll-btn .fa-solid.fa-dragon');
        expect(icon).toBeInTheDocument();
    });

    it('renders prompt text and both shape options', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        expect(screen.getByText('Choose the shape of your breath weapon:')).toBeInTheDocument();
        expect(screen.getByText('15-foot Cone')).toBeInTheDocument();
        expect(screen.getByText('30-foot Line (5 feet wide)')).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders two radio inputs with name breathWeaponShape', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        const inputs = document.querySelectorAll('input[name="breathWeaponShape"]');
        expect(inputs).toHaveLength(2);
    });

    it('shows default title when action is null', () => {
        render(<BreathWeaponShapeModal {...makeProps({ action: null })} />);
        expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
    });

    it('shows default title when action is undefined', () => {
        render(<BreathWeaponShapeModal {...makeProps({ action: undefined })} />);
        expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
    });

    it('shows default title when action has no name', () => {
        render(<BreathWeaponShapeModal {...makeProps({ action: {} })} />);
        expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
    });

    // ── Close behavior ──

    it('calls onClose when Cancel is clicked', () => {
        const onClose = vi.fn();
        render(<BreathWeaponShapeModal {...makeProps({ onClose })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay backdrop is clicked', () => {
        const onClose = vi.fn();
        render(<BreathWeaponShapeModal {...makeProps({ onClose })} />);
        fireEvent.click(document.querySelector('.sp-overlay'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when modal content is clicked', () => {
        const onClose = vi.fn();
        render(<BreathWeaponShapeModal {...makeProps({ onClose })} />);
        fireEvent.click(document.querySelector('.sp-modal'));
        expect(onClose).not.toHaveBeenCalled();
    });

    // ── Selection behavior ──

    it('disables Choose Shape button when nothing selected', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        expect(screen.getByRole('button', { name: 'Choose Shape' })).toBeDisabled();
    });

    it('enables Choose Shape button after selecting cone', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        expect(screen.getByRole('button', { name: 'Choose Shape' })).toBeEnabled();
    });

    it('enables Choose Shape button after selecting line', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[1]);
        expect(screen.getByRole('button', { name: 'Choose Shape' })).toBeEnabled();
    });

    it('checks the clicked radio and unchecks the other', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        expect(radios[0]).toBeChecked();
        expect(radios[1]).not.toBeChecked();
        fireEvent.click(radios[1]);
        expect(radios[0]).not.toBeChecked();
        expect(radios[1]).toBeChecked();
    });

    // ── Choose Shape click flow ──

    it('does nothing when Choose Shape is clicked with no selection', async () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Choose Shape' }));
        });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('stores cone selection and calls onClose and executeHandler', async () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Choose Shape' }));
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('DragonbornFighter', '_Breath_Weapon_option', 'cone', 'test-campaign');
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        expect(executeHandler).toHaveBeenCalledWith(baseProps.action, baseProps.playerStats, baseProps.campaignName, null);
    });

    it('stores line selection and calls onClose and executeHandler', async () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[1]);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Choose Shape' }));
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('DragonbornFighter', '_Breath_Weapon_option', 'line', 'test-campaign');
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        expect(executeHandler).toHaveBeenCalledWith(baseProps.action, baseProps.playerStats, baseProps.campaignName, null);
    });

    it('replaces multiple spaces with underscore in option key', async () => {
        const actionWithSpaces = { name: 'Breath  Weapon' };
        render(<BreathWeaponShapeModal {...makeProps({ action: actionWithSpaces })} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Choose Shape' }));
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('DragonbornFighter', '_Breath_Weapon_option', 'cone', 'test-campaign');
    });

    // ── Automation result event ──

    it('dispatches automation-result event when executeHandler returns a result', async () => {
        executeHandler.mockResolvedValue({ type: 'popup', payload: { message: 'done' } });
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        render(<BreathWeaponShapeModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Choose Shape' }));
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
        render(<BreathWeaponShapeModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Choose Shape' }));
        });
        expect(dispatchSpy).not.toHaveBeenCalled();
        dispatchSpy.mockRestore();
    });

    // ── Edge cases ──

    it('renders dragon icon in header when action is null', () => {
        render(<BreathWeaponShapeModal {...makeProps({ action: null })} />);
        const icon = document.querySelector('.fa-solid.fa-dragon');
        expect(icon).toBeInTheDocument();
    });

    it('renders damage description text for cone option', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        const matches = screen.getAllByText(/15-foot cone/i);
        expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('renders damage description text for line option', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        const matches = screen.getAllByText(/30-foot line/i);
        expect(matches.length).toBeGreaterThanOrEqual(1);
    });
});
