// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WarpingImplosionModal from './WarpingImplosionModal.jsx';
import SaveAttackAoeModal from './shared/SaveAttackAoeModal.jsx';
import * as handler from '../../../services/automation/handlers/class-sorcerer/warpingImplosionHandler.js';

// ── Mocks (keys match exactly what the modal reads) ──

vi.mock('../../../services/automation/handlers/class-sorcerer/warpingImplosionHandler.js', () => ({
    // Real handler resolves { type: 'confirmed', restored: !!restoreWithSP } on success
    applyWarpingImplosion: vi.fn(() => Promise.resolve({ type: 'confirmed', restored: false })),
}));

// Full props land on the mock function for exact-payload pins; DOM stays minimal.
vi.mock('./shared/SaveAttackAoeModal.jsx', () => ({
    default: vi.fn(({ onClose }) => (
        <div data-testid="save-attack-aoe-modal">
            <button onClick={onClose}>Close AOE Modal</button>
        </div>
    )),
}));

// ── Fixtures ──

const action = { name: 'Warping Implosion', automation: { damage: '3d10', damageType: 'Force', saveType: 'STR', shape: 'emanation_30ft', resourceCost: 'sorcery_points', restoreCost: 5 } };
const playerStats = { name: 'AberrantSorcerer', level: 18 };

function baseProps(overrides = {}) {
    return {
        action,
        playerStats,
        campaignName: 'test-campaign',
        saveDc: 13,
        saveType: 'STR',
        shape: 'emanation_30ft',
        rangeFeet: 30,
        damageExpression: '3d10',
        damageType: 'Force',
        teleportRange: 120,
        canRestore: true,
        restoreCost: 5,
        hasRemaining: true,
        onClose: vi.fn(),
        ...overrides,
    };
}

describe('WarpingImplosionModal', () => {
    beforeEach(() => {
        handler.applyWarpingImplosion.mockReset();
        handler.applyWarpingImplosion.mockResolvedValue({ type: 'confirmed', restored: false });
        SaveAttackAoeModal.mockClear();
    });

    it('choice phase shows the 120-foot teleport rules copy and spends the free use via one button', () => {
        render(<WarpingImplosionModal {...baseProps()} />);
        expect(screen.getByText(/120 feet/)).toBeTruthy();
        expect(screen.getByText(/DC 13/)).toBeTruthy();
        expect(screen.getByText(/pulled toward/i)).toBeTruthy();
        expect(screen.getByText(/expends your 1 use/i)).toBeTruthy();
        expect(screen.getByRole('button', { name: /Teleport & Implosion/ })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Restore & Teleport/ })).toBeNull();
    });

    it('with no uses left offers the SP restore button, and neither action button when SPs cannot cover the cost', () => {
        const { unmount } = render(<WarpingImplosionModal {...baseProps({ hasRemaining: false, canRestore: true })} />);
        expect(screen.getByRole('button', { name: /Restore & Teleport.*spend 5 Sorcery Points/ })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Teleport & Implosion/ })).toBeNull();
        unmount();

        render(<WarpingImplosionModal {...baseProps({ hasRemaining: false, canRestore: false })} />);
        expect(screen.queryByRole('button', { name: /Restore & Teleport/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /Teleport & Implosion/ })).toBeNull();
        expect(screen.getByText(/not enough Sorcery Points to restore/i)).toBeTruthy();
    });

    it('free-use confirm spends nothing extra, stays inert until clicked, then hands the exact payload to the AoE picker', async () => {
        const onClose = vi.fn();
        render(<WarpingImplosionModal {...baseProps({ onClose })} />);
        expect(handler.applyWarpingImplosion).not.toHaveBeenCalled();
        expect(SaveAttackAoeModal).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /Teleport & Implosion/ }));
        await waitFor(() => expect(screen.getByTestId('save-attack-aoe-modal')).toBeTruthy());

        expect(handler.applyWarpingImplosion).toHaveBeenCalledWith(action, playerStats, 'test-campaign', false);
        expect(SaveAttackAoeModal).toHaveBeenCalled();
        expect(SaveAttackAoeModal.mock.calls.at(-1)[0]).toEqual({
            action,
            playerStats,
            campaignName: 'test-campaign',
            shape: 'emanation_30ft',
            range: 30,
            damage: '3d10',
            damageType: 'Force',
            saveType: 'STR',
            saveDc: 13,
            dcSuccess: 'none',
            pullMarkerEffect: 'pulled_toward',
            logSaveSuccess: true,
            characters: null,
            onClose,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Close AOE Modal' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('restore confirm spends 5 SP via restoreWithSP=true and still opens the AoE picker', async () => {
        render(<WarpingImplosionModal {...baseProps({ hasRemaining: false })} />);
        fireEvent.click(screen.getByRole('button', { name: /Restore & Teleport/ }));
        await waitFor(() => expect(screen.getByTestId('save-attack-aoe-modal')).toBeTruthy());
        expect(handler.applyWarpingImplosion).toHaveBeenCalledWith(action, playerStats, 'test-campaign', true);
    });

    it('refusal at confirm shows the handler message and never opens the picker; Done closes the modal', async () => {
        handler.applyWarpingImplosion.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Warping Implosion',
                description: 'Warping Implosion: No remaining uses. Restore with 5 Sorcery Points or finish a Long Rest. Nothing spent.',
                automation: action.automation,
            },
        });
        const onClose = vi.fn();
        render(<WarpingImplosionModal {...baseProps({ onClose })} />);
        fireEvent.click(screen.getByRole('button', { name: /Teleport & Implosion/ }));
        await waitFor(() => expect(screen.getByText(/No remaining uses.*Nothing spent\./)).toBeTruthy());
        expect(screen.queryByTestId('save-attack-aoe-modal')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('cancel closes without touching resources', () => {
        const onClose = vi.fn();
        render(<WarpingImplosionModal {...baseProps({ onClose })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalled();
        expect(handler.applyWarpingImplosion).not.toHaveBeenCalled();
    });
});
