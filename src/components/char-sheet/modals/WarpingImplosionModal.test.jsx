import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WarpingImplosionModal from './WarpingImplosionModal.jsx';

// ── Mocks ──

vi.mock('../../../services/automation/handlers/class-sorcerer/warpingImplosionHandler.js', () => ({
    applyWarpingImplosion: vi.fn(async () => ({ type: 'confirmed', restored: false })),
}));

vi.mock('./shared/SaveAttackAoeModal.jsx', () => ({
    default: vi.fn(({ action, saveDc, saveType, damage, damageType, dcSuccess, pullMarkerEffect, onClose }) => (
        <div data-testid="save-attack-aoe-modal">
            <span data-testid="aoe-action">{action?.name}</span>
            <span data-testid="aoe-dc">{saveDc}</span>
            <span data-testid="aoe-save-type">{saveType}</span>
            <span data-testid="aoe-damage">{damage}</span>
            <span data-testid="aoe-damage-type">{damageType}</span>
            <span data-testid="aoe-dc-success">{dcSuccess}</span>
            <span data-testid="aoe-pull-marker">{pullMarkerEffect}</span>
            <button onClick={onClose}>Close AOE Modal</button>
        </div>
    )),
}));

import * as handler from '../../../services/automation/handlers/class-sorcerer/warpingImplosionHandler.js';

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
        vi.clearAllMocks();
        handler.applyWarpingImplosion.mockResolvedValue({ type: 'confirmed', restored: false });
    });

    it('choice phase shows the 120-foot teleport chooser and the free-use button', () => {
        render(<WarpingImplosionModal {...baseProps()} />);
        expect(screen.getByText(/120 feet/)).toBeTruthy();
        expect(screen.getByText(/DC 13/)).toBeTruthy();
        expect(screen.getByText(/pulled toward/i)).toBeTruthy();
        expect(screen.getByRole('button', { name: /Teleport & Implosion/ })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Restore & Teleport/ })).toBeNull();
    });

    it('offers the SP restore button only when no uses remain', () => {
        render(<WarpingImplosionModal {...baseProps({ hasRemaining: false })} />);
        expect(screen.getByRole('button', { name: /Restore & Teleport/ })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Teleport & Implosion/ })).toBeNull();
    });

    it('confirm spends the use then hands off to the AoE save picker with dcSuccess none + pulled marker', async () => {
        render(<WarpingImplosionModal {...baseProps()} />);
        fireEvent.click(screen.getByRole('button', { name: /Teleport & Implosion/ }));
        await waitFor(() => expect(screen.getByTestId('save-attack-aoe-modal')).toBeTruthy());
        expect(handler.applyWarpingImplosion).toHaveBeenCalledWith(action, playerStats, 'test-campaign', false);
        expect(screen.getByTestId('aoe-dc-success').textContent).toBe('none');
        expect(screen.getByTestId('aoe-pull-marker').textContent).toBe('pulled_toward');
        expect(screen.getByTestId('aoe-dc').textContent).toBe('13');
    });

    it('restore button confirms with restoreWithSP=true', async () => {
        render(<WarpingImplosionModal {...baseProps({ hasRemaining: false })} />);
        fireEvent.click(screen.getByRole('button', { name: /Restore & Teleport/ }));
        await waitFor(() => expect(screen.getByTestId('save-attack-aoe-modal')).toBeTruthy());
        expect(handler.applyWarpingImplosion).toHaveBeenCalledWith(action, playerStats, 'test-campaign', true);
    });

    it('refusal at confirm shows the message and never opens the picker', async () => {
        handler.applyWarpingImplosion.mockResolvedValue({ type: 'popup', payload: { description: 'No remaining uses. Nothing spent.' } });
        const onClose = vi.fn();
        render(<WarpingImplosionModal {...baseProps({ onClose })} />);
        fireEvent.click(screen.getByRole('button', { name: /Teleport & Implosion/ }));
        await waitFor(() => expect(screen.getByText('No remaining uses. Nothing spent.')).toBeTruthy());
        expect(screen.queryByTestId('save-attack-aoe-modal')).toBeNull();
        fireEvent.click(screen.getByText('Done'));
        expect(onClose).toHaveBeenCalled();
    });

    it('cancel closes without touching resources', () => {
        const onClose = vi.fn();
        render(<WarpingImplosionModal {...baseProps({ onClose })} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(onClose).toHaveBeenCalled();
        expect(handler.applyWarpingImplosion).not.toHaveBeenCalled();
    });
});
