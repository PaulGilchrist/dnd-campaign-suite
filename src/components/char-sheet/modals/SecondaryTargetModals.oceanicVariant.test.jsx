// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SecondaryTargetModals from './SecondaryTargetModals.jsx';

function makeHandlers() {
    return {
        handleSweepingAttackConfirm: vi.fn(),
        handleBaitAndSwitchChoiceConfirm: vi.fn(),
        handleCommanderStrikeChoiceConfirm: vi.fn(),
        handleRallyChoiceConfirm: vi.fn(),
        handleTricksterBlessingConfirm: vi.fn(),
        handleBardicInspirationConfirm: vi.fn(),
        handleInspiringMovementConfirm: vi.fn(),
        handleOceanicGiftConfirm: vi.fn(),
        handleDestructiveStrideTargetConfirm: vi.fn(),
        handleDestructiveStrideTargetSkip: vi.fn(),
        handleStarryChaliceConfirm: vi.fn(),
    };
}

function makeOceanicModal(overrides = {}) {
    return {
        action: { name: 'Oceanic Gift' },
        playerStats: { name: 'Wild_Sage_Druid' },
        campaignName: 'test-campaign',
        creatureTargets: [{ name: 'HexWarlock', type: 'player' }],
        spellSaveDc: 17,
        wisMod: 3,
        doubleEmanation: false,
        cost: 1,
        availableUses: 3,
        ...overrides,
    };
}

function renderOceanic(modalOverrides = {}) {
    const handlers = makeHandlers();
    render(
        <SecondaryTargetModals
            mergedModalState={{ oceanicGiftTargetModal: makeOceanicModal(modalOverrides) }}
            setModalState={vi.fn()}
            {...handlers}
        />
    );
    return { handlers, toggle: screen.queryByRole('checkbox') };
}

function confirmWithAlly() {
    fireEvent.click(screen.getByText('HexWarlock'));
    fireEvent.click(screen.getByText('Grant Wrath of the Sea'));
}

describe('SecondaryTargetModals - Oceanic Gift variant toggle (CLA-240)', () => {
    it('defaults to single-ally: enabled unchecked toggle, single title, confirms doubleEmanation:false', () => {
        const { handlers } = renderOceanic();
        const toggle = screen.getByRole('checkbox');
        expect(toggle.checked).toBe(false);
        expect(toggle.disabled).toBe(false);
        expect(screen.getByText(/Oceanic Gift — Choose Ally/).textContent).not.toContain('Self + Ally');
        expect(screen.getByText(/Costs 1 Wild Shape\./)).toBeTruthy();
        confirmWithAlly();
        expect(handlers.handleOceanicGiftConfirm).toHaveBeenCalledWith('HexWarlock', false);
    });

    it('checking the toggle switches to the Self + Ally variant and confirms doubleEmanation:true', () => {
        const { handlers } = renderOceanic();
        fireEvent.click(screen.getByRole('checkbox'));
        expect(screen.getByText(/Oceanic Gift — Choose Ally \(Self \+ Ally, 2 Wild Shape\)/)).toBeTruthy();
        expect(screen.getByText(/Costs 2 Wild Shape uses/)).toBeTruthy();
        confirmWithAlly();
        expect(handlers.handleOceanicGiftConfirm).toHaveBeenCalledWith('HexWarlock', true);
    });

    it('disables the toggle when fewer than 2 Wild Shape uses remain', () => {
        const toggle = renderOceanic({ availableUses: 1 }).toggle;
        expect(toggle.disabled).toBe(true);
    });

    it('leaves the toggle enabled when exactly 2 Wild Shape uses remain', () => {
        const toggle = renderOceanic({ availableUses: 2, cost: 2 }).toggle;
        expect(toggle.disabled).toBe(false);
    });

    it('automation entry with doubleEmanation payload hides the toggle but confirms doubleEmanation:true', () => {
        const { handlers } = renderOceanic({ doubleEmanation: true, availableUses: 2, cost: 2 });
        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(screen.getByText(/Oceanic Gift — Choose Ally \(Self \+ Ally, 2 Wild Shape\)/)).toBeTruthy();
        confirmWithAlly();
        expect(handlers.handleOceanicGiftConfirm).toHaveBeenCalledWith('HexWarlock', true);
    });

    it('resets the toggle after the modal closes and reopens', () => {
        const setModalState = vi.fn();
        const handlers = makeHandlers();
        const modalState = { oceanicGiftTargetModal: makeOceanicModal() };
        const { rerender } = render(
            <SecondaryTargetModals mergedModalState={modalState} setModalState={setModalState} {...handlers} />
        );
        fireEvent.click(screen.getByRole('checkbox'));
        expect(screen.getByRole('checkbox').checked).toBe(true);
        rerender(
            <SecondaryTargetModals mergedModalState={{ oceanicGiftTargetModal: null }} setModalState={setModalState} {...handlers} />
        );
        rerender(
            <SecondaryTargetModals mergedModalState={modalState} setModalState={setModalState} {...handlers} />
        );
        expect(screen.getByRole('checkbox').checked).toBe(false);
        confirmWithAlly();
        expect(handlers.handleOceanicGiftConfirm).toHaveBeenCalledWith('HexWarlock', false);
    });
});
