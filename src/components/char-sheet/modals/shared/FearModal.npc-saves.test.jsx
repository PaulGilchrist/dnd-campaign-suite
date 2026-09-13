// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FearModal from './FearModal.jsx';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: 'Bane',
    automation: { type: 'bane' },
};

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { cha: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { cha: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
    ],
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CHA',
        saveDc: 14,
        onClose: vi.fn(),
        ...overrides,
    };
}

async function selectAndConfirm(props = {}) {
    const { container } = render(<FearModal {...makeProps(props)} />);
    const labels = container.querySelectorAll('.secondary-target-row');
    await act(async () => { fireEvent.click(labels[0]); });
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /Bane \(1\)/ })).toBeInTheDocument();
    });
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Bane \(1\)/ }));
    });
    return { container };
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    getAllyList.mockReturnValue(null);
});

describe('FearModal NPC saves', () => {
    describe('NPC failed save flow', () => {
        it('applies frightened condition, expiration, and fear effect on failed NPC save', async () => {
            getRuntimeValue.mockReturnValue([]);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            try {
                await selectAndConfirm();

                await waitFor(() => {
                    const conditionCalls = setRuntimeValue.mock.calls.filter(
                        call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                    );
                    expect(conditionCalls.length).toBeGreaterThan(0);
                    expect(conditionCalls[0][2]).toContain('frightened');
                });

                expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Wizard1', targetName: 'Goblin', effects: [{ type: 'condition', condition: 'frightened' }], campaignName });

                await waitFor(() => {
                    const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                        call => call[1] === 'targetEffects' && call[0] === 'campaign'
                    );
                    expect(targetEffectCalls.length).toBeGreaterThan(0);
                    const effects = targetEffectCalls[0][2];
                    const fearEffect = effects.find(e => e.effect === 'fear_end_on_los');
                    expect(fearEffect).toBeDefined();
                    expect(fearEffect.target).toBe('Goblin');
                    expect(fearEffect.source).toBe('Wizard1');
                    expect(fearEffect.condition).toBe('frightened');
                    expect(fearEffect.duration).toBe('concentration');
                });
            } finally {
                vi.restoreAllMocks();
            }
        });

        it('logs ability_use on NPC save confirm', async () => {
            getRuntimeValue.mockReturnValue([]);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            try {
                await selectAndConfirm();

                expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'Wizard1',
                    abilityName: 'Bane',
                }));
            } finally {
                vi.restoreAllMocks();
            }
        });
    });

    describe('NPC successful save', () => {
        it('does not apply condition and logs success when NPC passes save', async () => {
            getRuntimeValue.mockReturnValue([]);
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            try {
                await selectAndConfirm();

                await waitFor(() => {
                    const conditionCalls = setRuntimeValue.mock.calls.filter(
                        call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                    );
                    expect(conditionCalls.length).toBe(0);
                });

                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.success === true && call[1]?.targetName === 'Goblin'
                );
                expect(saveEntries.length).toBeGreaterThan(0);
            } finally {
                vi.restoreAllMocks();
            }
        });
    });

    describe('careful spell protection for NPCs', () => {
        it('automatically succeeds and logs for careful spell protected NPCs', async () => {
            getAllyList.mockReturnValue(['Goblin']);
            getRuntimeValue.mockReturnValue([]);
            await selectAndConfirm({ metamagicCareful: true });

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                );
                expect(conditionCalls.length).toBe(0);
            });

            const saveEntries = addEntry.mock.calls.filter(
                call => call[1]?.type === 'save_result' && call[1]?.targetName === 'Goblin'
            );
            expect(saveEntries.length).toBeGreaterThan(0);
            expect(saveEntries[0][1].description).toContain('Careful Spell protected');
        });
    });

    describe('condition deduplication', () => {
        it('does not add duplicate frightened condition when already present', async () => {
            getRuntimeValue.mockReturnValue([{ name: 'frightened' }]);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            try {
                await selectAndConfirm();

                await waitFor(() => {
                    const conditionCalls = setRuntimeValue.mock.calls.filter(
                        call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                    );
                    expect(conditionCalls.length).toBeGreaterThan(0);
                    const conditions = conditionCalls[0][2];
                    const frightenedCount = conditions.filter(c => String(c).toLowerCase() === 'frightened').length;
                    expect(frightenedCount).toBe(1);
                });
            } finally {
                vi.restoreAllMocks();
            }
        });
    });

    describe('fear effect tracking', () => {
        it('updates existing fear effect with new caster and DC', async () => {
            const existingEffect = {
                target: 'Goblin',
                effect: 'fear_end_on_los',
                source: 'OldCaster',
                condition: 'frightened',
                dc: 10,
                duration: '1 minute',
            };
            getRuntimeValue.mockReturnValue([existingEffect]);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            try {
                await selectAndConfirm();

                await waitFor(() => {
                    const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                        call => call[1] === 'targetEffects' && call[0] === 'campaign'
                    );
                    expect(targetEffectCalls.length).toBeGreaterThan(0);
                    const effects = targetEffectCalls[0][2];
                    const fearEffects = effects.filter(e => e.effect === 'fear_end_on_los');
                    expect(fearEffects.length).toBe(1);
                    expect(fearEffects[0].source).toBe('Wizard1');
                    expect(fearEffects[0].dc).toBe(14);
                });
            } finally {
                vi.restoreAllMocks();
            }
        });
    });
});
