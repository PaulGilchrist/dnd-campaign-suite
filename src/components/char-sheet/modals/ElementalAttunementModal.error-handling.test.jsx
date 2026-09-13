// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ElementalAttunementModal from './ElementalAttunementModal.jsx';

// ── Mocks ──

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((damage, success, dcSuccess) => {
        if (dcSuccess === 'half') return success ? Math.floor(damage / 2) : damage;
        return damage;
    }),
    computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(() => []),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('./shared/AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
    default: vi.fn(({ title, icon, targets, description, note, confirmLabel, confirmIcon: _ci, onConfirm, onSkip }) => (
        <div className="sp-overlay" onClick={onSkip}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div data-testid="creature-selection-modal">
                    <span data-testid="cs-modal-title">{title}</span>
                    <span data-testid="cs-modal-icon">{icon}</span>
                    <span data-testid="cs-modal-target-count">{targets.length}</span>
                    {description && <div data-testid="cs-modal-description" dangerouslySetInnerHTML={{ __html: description }} />}
                    {note && <div data-testid="cs-modal-note" dangerouslySetInnerHTML={{ __html: note }} />}
                    <button data-testid="cs-confirm-btn" onClick={() => onConfirm(targets.map(t => t.name))} disabled={targets.length === 0}>
                        {confirmLabel || 'Confirm'}
                    </button>
                    <button data-testid="cs-skip-btn" onClick={onSkip}>Skip</button>
                </div>
            </div>
        </div>
    )),
}));

// ── Re-import mocked modules ──

import * as logService from '../../../services/ui/logService.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as aoeService from '../../../services/rules/combat/aoeService.js';
import * as combatData from '../../../services/encounters/combatData.js';

// ── Test fixtures ──

const baseAction = { name: 'Elemental Attunement' };
const basePlayerStats = {
    name: 'Monk1',
    level: 5,
    proficiency: 3,
    abilities: [
        { name: 'Strength', bonus: 2 },
        { name: 'Dexterity', bonus: 4 },
        { name: 'Constitution', bonus: 1 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Wisdom', bonus: 1 },
        { name: 'Charisma', bonus: 0 },
    ],
};
const baseProps = { action: baseAction, playerStats: basePlayerStats, campaignName: 'test-campaign', onClose: vi.fn() };

function makeProps(overrides = {}) { return { ...baseProps, ...overrides }; }
function makeCombatSummary(creatures) { return { creatures }; }

function renderModal(props = {}) {
    const handleClose = vi.fn();
    return { ...render(<ElementalAttunementModal {...makeProps({ onClose: handleClose, ...props })} />), handleClose };
}

// ── Tests ──

describe('ElementalAttunementModal error handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('handles logging, map loading, and expiration errors without crashing', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // NPC speed_reduction logging failure (Cold element, failed save)
        logService.addEntry.mockRejectedValue(new Error('network error'));
        runtimeState.getRuntimeValue.mockReturnValue([]);
        combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
            { name: 'Goblin1', type: 'npc', saveBonuses: { dex: -10 }, resistances: [], immunities: [] },
        ]));
        aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Goblin1', type: 'npc', currentHp: 7, maxHp: 7 } }]);
        renderModal({ activeOverlay: { type: 'sphere' } });
        fireEvent.click(screen.getByText('Cold'));
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith('[ElementalAttunementModal] Error logging speed reduction:', expect.any(Error));
        });

        // Map data loading failure (mapName provided, overlay triggers map loading)
        mapsService.loadMapData.mockRejectedValue(new Error('map load failed'));
        combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
            { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 },
        ]));
        renderModal({ mapName: 'test-map', activeOverlay: { type: 'sphere' } });
        fireEvent.click(screen.getByText('Fire'));
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith('[ElementalAttunementModal] Error loading map data:', expect.any(Error));
        });

        // Expiration logging failure (Fire element, closed from summary)
        logService.addEntry.mockRejectedValue(new Error('network error'));
        combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
            { name: 'Goblin1', type: 'npc', saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
        ]));
        aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Goblin1', type: 'npc', currentHp: 7, maxHp: 7 } }]);
        renderModal({ activeOverlay: { type: 'sphere' } });
        fireEvent.click(screen.getByText('Fire'));
        await waitFor(() => fireEvent.click(screen.getByRole('button', { name: /Close/ })));
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith('[ElementalAttunementModal] Error logging expiration:', expect.any(Error));
        });

        consoleSpy.mockRestore();
    });
});
