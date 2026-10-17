// @maintained-by-ai
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

function radio(index) {
    return screen.getAllByRole('radio')[index];
}

async function submit() {
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Choose Shape/ }));
    });
}

describe('BreathWeaponShapeModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        executeHandler.mockResolvedValue(null);
    });

    it('renders prompt, both shape options, and Cancel with a disabled Choose Shape', () => {
        render(<BreathWeaponShapeModal {...makeProps()} />);
        expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
        expect(screen.getByText('Choose the shape of your breath weapon:')).toBeInTheDocument();
        expect(screen.getByText('15-foot Cone')).toBeInTheDocument();
        expect(screen.getByText('30-foot Line (5 feet wide)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Choose Shape/ })).toBeDisabled();
    });

    it('shows the default title when action is missing', () => {
        render(<BreathWeaponShapeModal {...makeProps({ action: null })} />);
        expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
    });

    it('closes only via Cancel, not by clicking the overlay or modal body', () => {
        const onClose = vi.fn();
        render(<BreathWeaponShapeModal {...makeProps({ onClose })} />);
        fireEvent.click(screen.getByText('Choose the shape of your breath weapon:'));
        fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does nothing when Choose Shape is clicked with no selection', async () => {
        const onClose = vi.fn();
        render(<BreathWeaponShapeModal {...makeProps({ onClose })} />);
        await submit();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(executeHandler).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('selecting cone stores the choice, closes the modal, and runs the handler once without dispatching a null result', async () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        render(<BreathWeaponShapeModal {...makeProps()} />);
        fireEvent.click(radio(0));
        expect(radio(0)).toBeChecked();
        expect(radio(1)).not.toBeChecked();
        expect(screen.getByRole('button', { name: /Choose Shape/ })).toBeEnabled();
        await submit();
        expect(setRuntimeValue).toHaveBeenCalledWith('DragonbornFighter', '_Breath_Weapon_option', 'cone', 'test-campaign');
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        expect(executeHandler).toHaveBeenCalledWith(baseProps.action, baseProps.playerStats, baseProps.campaignName, null);
        expect(dispatchSpy).not.toHaveBeenCalled();
        dispatchSpy.mockRestore();
    });

    it('selecting line stores the choice with whitespace collapsed in the option key', async () => {
        const action = { name: 'Ancestral  Breath' };
        render(<BreathWeaponShapeModal {...makeProps({ action })} />);
        fireEvent.click(radio(1));
        expect(radio(1)).toBeChecked();
        expect(radio(0)).not.toBeChecked();
        await submit();
        expect(setRuntimeValue).toHaveBeenCalledWith('DragonbornFighter', '_Ancestral_Breath_option', 'line', 'test-campaign');
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('dispatches an automation-result event only when the handler returns a result', async () => {
        executeHandler.mockResolvedValueOnce({ type: 'popup', payload: { message: 'done' } });
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        render(<BreathWeaponShapeModal {...makeProps()} />);
        fireEvent.click(radio(0));
        await submit();
        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        const event = dispatchSpy.mock.calls[0][0];
        expect(event.type).toBe('automation-result');
        expect(event.detail).toEqual({ type: 'popup', payload: { message: 'done' } });
        dispatchSpy.mockRestore();
    });
});
