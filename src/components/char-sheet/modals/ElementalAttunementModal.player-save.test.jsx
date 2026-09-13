// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import * as aoeService from '../../../services/rules/combat/aoeService.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as logService from '../../../services/ui/logService.js';
import * as applyDamage from '../../../services/rules/combat/applyDamage.js';

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

describe('ElementalAttunementModal player save handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    });

    describe('save prompt parameters', () => {
        it.each([
            { element: 'Fire', expectedRawDamage: 5 },
            { element: 'Lightning', expectedRawDamage: 5 },
            { element: 'Cold', expectedRawDamage: undefined },
        ])('sends save prompt with $expectedRawDamage rawDamage for $element element on player targets', async ({ element, expectedRawDamage }) => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Player1', type: 'player', saveBonuses: { dex: 3 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText(element));
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
            const [campaign, promptData] = savePromptService.sendSavePrompt.mock.calls[0];
            expect(campaign).toBe('test-campaign');
            expect(promptData.targetName).toBe('Player1');
            expect(promptData.saveType).toBe('DEX');
            expect(promptData.saveDc).toBe(12);
            expect(promptData.rawDamage).toBe(expectedRawDamage);
        });
    });

    describe('save-result event handling', () => {
        it.each([
            { element: 'Fire', success: true, expectedText: ['Saved', '2 fire'] },
            { element: 'Lightning', success: false, expectedText: ['Failed', '5 lightning'] },
        ])('records save result with damage data for $element element (success: $success)', async ({ element, success, expectedText }) => {
            const saveBonus = success ? 3 : -10;
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Player1', type: 'player', saveBonuses: { dex: saveBonus }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText(element));
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
            const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
            await waitFor(() => expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument());
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId, targetName: 'Player1', success, roll: success ? 15 : 5, saveBonus, total: success ? 18 : -5, rawDamage: 5 },
                }));
            });
            await waitFor(() => expect(screen.getByText(/Results/)).toBeInTheDocument());
            const body = document.querySelector('.sp-body');
            expect(body.textContent).toContain('Player1');
            for (const text of expectedText) {
                expect(body.textContent).toContain(text);
            }
        });

        it('applies speed_reduction condition on player Cold save failure', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Player1', type: 'player', saveBonuses: { dex: -10 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Cold'));
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
            const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
            await waitFor(() => expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument());
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId, targetName: 'Player1', success: false, roll: 5, saveBonus: -10, total: -5, rawDamage: 0 },
                }));
            });
            await waitFor(() => {
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    'Player1',
                    'activeConditions',
                    expect.arrayContaining(['speed_reduction']),
                    'test-campaign'
                );
            });
        });

        it('does not apply speed_reduction condition on player Cold save success', async () => {
            runtimeState.getRuntimeValue.mockReturnValue([]);
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Player1', type: 'player', saveBonuses: { dex: 10 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Cold'));
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
            const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
            await waitFor(() => expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument());
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId, targetName: 'Player1', success: true, roll: 15, saveBonus: 10, total: 25, rawDamage: 0 },
                }));
            });
            await waitFor(() => expect(screen.getByText(/Results/)).toBeInTheDocument());
            const body = document.querySelector('.sp-body');
            expect(body.textContent).toContain('no effect');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'Player1',
                'activeConditions',
                expect.arrayContaining(['speed_reduction']),
                'test-campaign'
            );
        });

        it('calls applyDamageToTarget for player Fire save result', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Player1', type: 'player', saveBonuses: { dex: 3 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
            const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
            await waitFor(() => expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument());
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId, targetName: 'Player1', success: false, roll: 10, saveBonus: 3, total: 13, rawDamage: 5 },
                }));
            });
            await waitFor(() => expect(applyDamage.applyDamageToTarget).toHaveBeenCalled(), { timeout: 10000 });
            const callArgs = applyDamage.applyDamageToTarget.mock.calls[0];
            expect(callArgs[1]).toBe('Player1');
            expect(callArgs[3]).toEqual(['fire']);
            expect(callArgs[4].campaignName).toBe('test-campaign');
        });
    });

    describe('save-result listener lifecycle', () => {
        it('removes save-result listener on unmount', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Player1', type: 'player', saveBonuses: { dex: 3 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 } }]);
            const { unmount } = renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
            const spy = vi.spyOn(window, 'removeEventListener');
            unmount();
            expect(spy).toHaveBeenCalledWith('save-result', expect.any(Function));
            spy.mockRestore();
        });

        it('ignores save-result events with unknown promptId', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Player1', type: 'player', saveBonuses: { dex: 3 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId: 'nonexistent-id', targetName: 'Player1', success: true, roll: 15, saveBonus: 3, total: 18, rawDamage: 5 },
                }));
            });
            await waitFor(() => expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument());
        });

        it('ignores save-result events with no detail', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Player1', type: 'player', saveBonuses: { dex: 3 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', { detail: null }));
            });
            expect(screen.queryByText(/Results/)).not.toBeInTheDocument();
        });
    });

    describe('save-result error handling', () => {
        it('logs error and records result when addEntry rejects for player damage path', async () => {
            logService.addEntry.mockRejectedValue(new Error('network error'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Player1', type: 'player', saveBonuses: { dex: 3 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
            const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
            await waitFor(() => expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument());
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId, targetName: 'Player1', success: false, roll: 5, saveBonus: 3, total: 8, rawDamage: 5 },
                }));
            });
            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith('[ElementalAttunementModal] Error logging player save:', expect.any(Error));
            });
            const body = document.querySelector('.sp-body');
            expect(body.textContent).toContain('Player1');
            consoleSpy.mockRestore();
        });

        it('logs error and records effect when addEntry rejects for player effect path', async () => {
            logService.addEntry.mockRejectedValue(new Error('network error'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            runtimeState.getRuntimeValue.mockReturnValue([]);
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Player1', type: 'player', saveBonuses: { dex: -10 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Cold'));
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
            const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
            await waitFor(() => expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument());
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId, targetName: 'Player1', success: false, roll: 5, saveBonus: -10, total: -5, rawDamage: 0 },
                }));
            });
            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith('[ElementalAttunementModal] Error logging player effect:', expect.any(Error));
            });
            const body = document.querySelector('.sp-body');
            expect(body.textContent).toContain('Player1');
            consoleSpy.mockRestore();
        });

        it('removes pending prompt after save-result even when logging fails', async () => {
            logService.addEntry.mockRejectedValue(new Error('network error'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Player1', type: 'player', saveBonuses: { dex: 3 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
            const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
            await waitFor(() => expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument());
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId, targetName: 'Player1', success: false, roll: 5, saveBonus: 3, total: 8, rawDamage: 5 },
                }));
            });
            await waitFor(() => {
                expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument();
            });
            consoleSpy.mockRestore();
        });
    });

    describe('multiple player targets', () => {
        it('sends save prompts for all player targets', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Player1', type: 'player', saveBonuses: { dex: 3 }, resistances: [], immunities: [] },
                { name: 'Player2', type: 'player', saveBonuses: { dex: 5 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([
                { creature: { name: 'Player1', type: 'player', currentHp: 10, maxHp: 10 } },
                { creature: { name: 'Player2', type: 'player', currentHp: 8, maxHp: 8 } },
            ]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(2);
            });
        });
    });
});
