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

import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as applyDamage from '../../../services/rules/combat/applyDamage.js';
import * as aoeService from '../../../services/rules/combat/aoeService.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as logService from '../../../services/ui/logService.js';
import * as areaEffectUtils from './shared/AreaEffectTargetModalBase.utils.jsx';

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

describe('ElementalAttunementModal NPC save resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        vi.spyOn(global.Math, 'random').mockReturnValue(0.1);
    });

    function setupNPC(name = 'Goblin1', saveBonuses = { dex: 2 }, resistances = [], immunities = []) {
        combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
            { name, type: 'npc', saveBonuses, resistances, immunities },
        ]));
        aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name, type: 'npc', currentHp: 7, maxHp: 7 } }]);
    }

    describe('NPC save resolution', () => {
        it('calls setRuntimeValue for activeConditions on speed_reduction failure', async () => {
            setupNPC('Goblin1', { dex: -10 });
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Cold'));
            await waitFor(() => {
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Goblin1', 'activeConditions', expect.arrayContaining(['speed_reduction']), 'test-campaign');
            });
        });

        it('does not duplicate speed_reduction when already present', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(['speed_reduction']);
            setupNPC('Goblin1', { dex: -10 });
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Cold'));
            await waitFor(() => {
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    'Goblin1',
                    'activeConditions',
                    ['speed_reduction'],
                    'test-campaign'
                );
            });
        });

        it.each([
            { element: 'Fire', saveBonuses: { dex: 2 }, damageType: ['fire'], expectedArgs: [1, 'Goblin1', expect.any(Number), ['fire'], 'test-campaign'] },
            { element: 'Thunder', saveBonuses: { con: 2 }, damageType: ['thunder'], expectedArgs: [1, 'Goblin1', expect.any(Number), ['thunder'], 'test-campaign'] },
        ])('calls applyDamageToTarget for $element with correct parameters', async ({ element, saveBonuses }) => {
            setupNPC('Goblin1', saveBonuses);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText(element));
            await waitFor(() => {
                expect(applyDamage.applyDamageToTarget).toHaveBeenCalled();
                const callArgs = applyDamage.applyDamageToTarget.mock.calls[0];
                expect(callArgs[1]).toBe('Goblin1');
                expect(callArgs[3]).toEqual([element.toLowerCase()]);
                expect(callArgs[4].campaignName).toBe('test-campaign');
            });
        });

        it.each([
            { element: 'Fire', saveType: 'dex' },
            { element: 'Thunder', saveType: 'con' },
        ])('logs save-damage roll entry for NPC with $element', async ({ element, saveType }) => {
            const saveBonuses = element === 'Fire' ? { dex: 2 } : { con: 2 };
            setupNPC('Goblin1', saveBonuses);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText(element));
            await waitFor(() => {
                expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                    type: 'roll',
                    rollType: 'save-damage',
                    saveType,
                    saveResult: expect.any(String),
                    saveDc: 12,
                    targetName: 'Goblin1',
                    damageType: element.toLowerCase(),
                }));
            });
        });

        it('logs ability_use entry for Cold speed_reduction on NPC', async () => {
            setupNPC();
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Cold'));
            await waitFor(() => {
                expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                    type: 'ability_use',
                    abilityName: 'Elemental Attunement',
                    saveDc: 12,
                }));
            });
        });

        it('calls persistAndNotify with combat summary and campaign name after resolving', async () => {
            setupNPC();
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                expect(areaEffectUtils.persistAndNotify).toHaveBeenCalled();
                const callArgs = areaEffectUtils.persistAndNotify.mock.calls[0];
                expect(callArgs[0]).toEqual(makeCombatSummary([
                    expect.objectContaining({ name: 'Goblin1', type: 'npc' }),
                ]));
                expect(callArgs[1]).toBe('test-campaign');
            });
        });

        it('handles NPC with no saveBonuses property', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Goblin1', type: 'npc' },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Goblin1', type: 'npc', currentHp: 7, maxHp: 7 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                    type: 'roll',
                    rollType: 'save-damage',
                }));
            });
        });
    });

    describe('summary phase', () => {
        it('shows "Saved" text for successful NPC saves', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Goblin1', type: 'npc', saveBonuses: { dex: 10 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Goblin1', type: 'npc', currentHp: 7, maxHp: 7 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            fireEvent.click(screen.getByText('Fire'));
            await waitFor(() => {
                const body = document.querySelector('.sp-body');
                expect(body.textContent).toContain('Saved');
            });
        });

        it('shows "speed reduced by 15 ft" for failed Cold saves', async () => {
            combatData.getCombatSummary.mockReturnValue(makeCombatSummary([
                { name: 'Goblin1', type: 'npc', saveBonuses: { dex: -10 }, resistances: [], immunities: [] },
            ]));
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: { name: 'Goblin1', type: 'npc', currentHp: 7, maxHp: 7 } }]);
            renderModal({ activeOverlay: { type: 'sphere' } });
            const btn = document.querySelector('.sp-roll-btn');
            if (btn) fireEvent.click(btn);
            await waitFor(() => {
                const body = document.querySelector('.sp-body');
                expect(body.textContent).toContain('speed reduced by 15 ft');
            });
        });
    });
});
