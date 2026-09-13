// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/rules/features/silenceService.js', () => ({
    addSilencedTarget: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

import SilenceModal from './SilenceModal.jsx';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../services/ui/logService.js';
import * as expirations from '../../../services/rules/effects/expirations.js';
import * as silenceService from '../../../services/rules/features/silenceService.js';
import * as damageUtils from '../../../services/rules/combat/damageUtils.js';

const baseProps = {
    playerStats: { name: 'Wizard1' },
    campaignName: 'test-campaign',
    aoeRadius: 20,
    onClose: vi.fn(),
    creatureTargets: [
        { name: 'Goblin1', type: 'npc' },
        { name: 'Orc Warrior', type: 'npc' },
        { name: 'Elf Mage', type: 'player' },
    ],
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

function renderModal(overrides) {
    return render(<SilenceModal {...makeProps(overrides)} />);
}

describe('SilenceModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initial render', () => {
        it('renders the modal with correct title, icon, and description', () => {
            renderModal();
            expect(screen.getByText('Silence')).toBeInTheDocument();
            const icon = screen.getByRole('button', { name: /Cast Silence/ }).querySelector('i');
            expect(icon).toHaveClass('fa-solid', 'fa-volume-xmark');
            const description = screen.getByText(/no sound can be created/);
            expect(description).toBeInTheDocument();
            expect(description.textContent).toContain('20-foot-radius sphere');
        });

        it('renders all creature targets and has confirm button disabled', () => {
            renderModal();
            expect(screen.getByText('Goblin1')).toBeInTheDocument();
            expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
            expect(screen.getByText('Elf Mage')).toBeInTheDocument();
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (0)' });
            expect(confirmButton).toBeDisabled();
        });

        it('renders the Skip button', () => {
            renderModal();
            expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        });
    });

    describe('target selection', () => {
        it('toggles a target selection on and off', () => {
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            expect(screen.getByRole('button', { name: 'Cast Silence (1)' })).toBeEnabled();
            fireEvent.click(screen.getByText('Goblin1'));
            expect(screen.getByRole('button', { name: 'Cast Silence (0)' })).toBeDisabled();
        });

        it('selects multiple targets and updates the confirm button label', () => {
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            expect(screen.getByRole('button', { name: 'Cast Silence (1)' })).toBeInTheDocument();
            fireEvent.click(screen.getByText('Orc Warrior'));
            expect(screen.getByRole('button', { name: 'Cast Silence (2)' })).toBeInTheDocument();
            fireEvent.click(screen.getByText('Elf Mage'));
            expect(screen.getByRole('button', { name: 'Cast Silence (3)' })).toBeInTheDocument();
        });
    });

    describe('skip behavior', () => {
        it('calls onClose when Skip is clicked', () => {
            renderModal();
            fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
            expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('confirm with targets', () => {
        it('sets silenceCaster, silenceCenter, and silenceRadius runtime values', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 5, gridY: 5 }],
            });
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (1)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Wizard1', 'silenceCaster', true, 'test-campaign'
            );
            const centerCall = runtimeState.setRuntimeValue.mock.calls.find(
                (c) => c[1] === 'silenceCenter'
            );
            expect(JSON.parse(centerCall[2])).toEqual({ gridX: 5, gridY: 5 });
            const radiusCall = runtimeState.setRuntimeValue.mock.calls.find(
                (c) => c[1] === 'silenceRadius'
            );
            expect(radiusCall[2]).toBe(20);
        });

        it('applies deafened condition to each targeted creature', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
            });
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            fireEvent.click(screen.getByText('Orc Warrior'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (2)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            const conditionCalls = runtimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(conditionCalls).toHaveLength(2);
            for (const call of conditionCalls) {
                expect(call[2]).toContain('deafened');
            }
        });

        it('removes existing deafened before re-adding it', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(['deafened', 'blinded']);
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
            });
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (1)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            const conditionCalls = runtimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(conditionCalls[0][2]).toEqual(['blinded', 'deafened']);
        });

        it('calls addSilencedTarget and addExpiration for each target', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
            });
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            fireEvent.click(screen.getByText('Orc Warrior'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (2)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            expect(silenceService.addSilencedTarget).toHaveBeenCalledWith(
                'Wizard1', 'Goblin1', 'test-campaign'
            );
            expect(silenceService.addSilencedTarget).toHaveBeenCalledWith(
                'Wizard1', 'Orc Warrior', 'test-campaign'
            );
            expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'Wizard1', targetName: 'Goblin1', effects: [
                    { type: 'condition', condition: 'deafened' },
                    { type: 'remove_active_buff', buffName: 'Silence' },
                ], campaignName: 'test-campaign' });
        });

        it('writes a Silence activeBuff with sourceCharacter to caster and each targeted creature', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
                creatures: [{ name: 'Goblin1' }],
            });
            runtimeState.getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'activeBuffs') return [];
                return null;
            });
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (1)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            const buffCalls = runtimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeBuffs'
            );
            expect(buffCalls).toHaveLength(2);
            const casterBuff = buffCalls.find((c) => c[0] === 'Wizard1');
            const goblinBuff = buffCalls.find((c) => c[0] === 'Goblin1');
            for (const call of [casterBuff, goblinBuff]) {
                expect(call[2]).toContainEqual(expect.objectContaining({
                    name: 'Silence',
                    effect: 'silence',
                    duration: 'concentration',
                    sourceCharacter: 'Wizard1',
                }));
            }
        });

        it('centers the zone on the first placed picked token, not the caster', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
                creatures: [
                    { name: 'Goblin1', gridX: 8, gridY: 8 },
                    { name: 'Orc Warrior', gridX: 10, gridY: 10 },
                ],
            });
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            fireEvent.click(screen.getByText('Orc Warrior'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (2)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            const centerCall = runtimeState.setRuntimeValue.mock.calls.find(
                (c) => c[1] === 'silenceCenter'
            );
            expect(JSON.parse(centerCall[2])).toEqual({ gridX: 8, gridY: 8 });
        });

        it('refuses picked creatures outside the sphere and logs the refusal', async () => {
            // Center = Goblin1 @(2,2). Orc Warrior @(8,8): dist = sqrt(72)*5 ≈ 42.4 ft > 20.
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
                creatures: [
                    { name: 'Goblin1', gridX: 2, gridY: 2 },
                    { name: 'Orc Warrior', gridX: 8, gridY: 8 },
                ],
            });
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            fireEvent.click(screen.getByText('Orc Warrior'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (2)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            const conditionCalls = runtimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(conditionCalls).toHaveLength(1);
            expect(conditionCalls[0][0]).toBe('Goblin1');
            const refusalEntry = logService.addEntry.mock.calls.find(
                (c) => c[1].type === 'automation' && c[1].creatureName === 'Orc Warrior'
            );
            expect(refusalEntry).toBeDefined();
            expect(refusalEntry[1].description).toContain('outside');
            expect(silenceService.addSilencedTarget).toHaveBeenCalledTimes(1);
            expect(silenceService.addSilencedTarget).toHaveBeenCalledWith(
                'Wizard1', 'Goblin1', 'test-campaign'
            );
        });

        it('calls addExpiration for silence buff removal on the caster', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
            });
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (1)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            const casterCalls = expirations.addExpiration.mock.calls.filter(
                (c) => c[0].attackerName === 'Wizard1' && c[0].targetName === 'Wizard1'
            );
            expect(casterCalls.length).toBeGreaterThanOrEqual(1);
            expect(casterCalls[0][0].effects).toContainEqual({ type: 'remove_active_buff', buffName: 'Silence' });
            expect(casterCalls[0][0].effects).toContainEqual({
                type: 'clear_silence_zone', casterName: 'Wizard1',
            });
        });

        it('logs condition and ability_use entries with correct details', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
            });
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (1)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            const conditionEntries = logService.addEntry.mock.calls.filter(
                (c) => c[1].type === 'condition'
            );
            expect(conditionEntries).toHaveLength(1);
            expect(conditionEntries[0][1].characterName).toBe('Goblin1');
            expect(conditionEntries[0][1].condition).toBe('Deafened');
            expect(conditionEntries[0][1].reason).toBe('Silence spell');
            expect(conditionEntries[0][1].note).toContain('Goblin1');
            expect(conditionEntries[0][1].note).toContain('Verbal');
            const abilityEntries = logService.addEntry.mock.calls.filter(
                (c) => c[1].type === 'ability_use'
            );
            expect(abilityEntries).toHaveLength(1);
            expect(abilityEntries[0][1].characterName).toBe('Wizard1');
            expect(abilityEntries[0][1].abilityName).toBe('Silence');
        });

        it('includes the aoeRadius in the ability_use log description', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
            });
            renderModal({ aoeRadius: 30 });
            fireEvent.click(screen.getByText('Goblin1'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (1)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            const abilityEntry = logService.addEntry.mock.calls.find(
                (c) => c[1].type === 'ability_use'
            );
            expect(abilityEntry[1].description).toContain('30-foot-radius');
        });

        it('dispatches combat-summary-updated event and calls onClose', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
            });
            const eventListener = vi.fn();
            window.addEventListener('combat-summary-updated', eventListener);
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (1)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            expect(eventListener).toHaveBeenCalled();
            expect(baseProps.onClose).toHaveBeenCalledTimes(1);
            window.removeEventListener('combat-summary-updated', eventListener);
        });

        it('sets silenceCenter to null when combatSummary is null', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce(null);
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (1)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            const centerCall = runtimeState.setRuntimeValue.mock.calls.find(
                (c) => c[1] === 'silenceCenter'
            );
            expect(centerCall[2]).toBe(null);
        });

        it('sets silenceCenter to null when caster has no grid position', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1' }],
            });
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (1)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            const centerCall = runtimeState.setRuntimeValue.mock.calls.find(
                (c) => c[1] === 'silenceCenter'
            );
            expect(centerCall[2]).toBe(null);
        });
    });

    describe('empty targets', () => {
        it('renders "No targets available" and disables confirm for empty array', () => {
            renderModal({ creatureTargets: [] });
            expect(screen.getByText('No targets available.')).toBeInTheDocument();
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (0)' });
            expect(confirmButton).toBeDisabled();
        });

        it('renders "No targets available" when creatureTargets is undefined', () => {
            renderModal({ creatureTargets: undefined });
            expect(screen.getByText('No targets available.')).toBeInTheDocument();
        });
    });

    describe('string targets', () => {
        it('renders and selects string targets', () => {
            renderModal({ creatureTargets: ['Goblin', 'Orc'] });
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('Orc')).toBeInTheDocument();
            fireEvent.click(screen.getByText('Goblin'));
            expect(screen.getByRole('button', { name: 'Cast Silence (1)' })).toBeInTheDocument();
        });
    });

    describe('accessibility', () => {
        it('renders all buttons with type="button"', () => {
            renderModal();
            const buttons = screen.getAllByRole('button');
            for (const button of buttons) {
                expect(button).toHaveAttribute('type', 'button');
            }
        });

        it('includes all targeted names in the ability_use description', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
            });
            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            fireEvent.click(screen.getByText('Orc Warrior'));
            fireEvent.click(screen.getByText('Elf Mage'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (3)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            const abilityEntry = logService.addEntry.mock.calls.find(
                (c) => c[1].type === 'ability_use'
            );
            expect(abilityEntry[1].description).toContain('Goblin1');
            expect(abilityEntry[1].description).toContain('Orc Warrior');
            expect(abilityEntry[1].description).toContain('Elf Mage');
        });
    });

    describe('error handling', () => {
        it('continues processing when addEntry rejects for a single target', async () => {
            damageUtils.getCombatContext.mockResolvedValueOnce({
                players: [{ name: 'Wizard1', gridX: 1, gridY: 1 }],
            });
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            logService.addEntry
                .mockReturnValueOnce(Promise.resolve())
                .mockReturnValueOnce(Promise.reject(new Error('log failed')));

            renderModal();
            fireEvent.click(screen.getByText('Goblin1'));
            fireEvent.click(screen.getByText('Orc Warrior'));
            const confirmButton = screen.getByRole('button', { name: 'Cast Silence (2)' });
            await act(async () => {
                fireEvent.click(confirmButton);
            });
            expect(silenceService.addSilencedTarget).toHaveBeenCalledTimes(2);
            expect(baseProps.onClose).toHaveBeenCalledTimes(1);
            consoleSpy.mockRestore();
        });
    });
});
