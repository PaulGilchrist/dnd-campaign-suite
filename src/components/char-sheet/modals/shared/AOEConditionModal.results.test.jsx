// @maintained-by-ai
// Results lane for AOEConditionModal: (1) activeConditions deduplication on fail-apply,
// (2) trap blocking exclusion of eligible targets (full source-distinguishing branch
// matrix of the component-local isTargetExcludedByTraps). Save resolution/prompts/logging
// lives in save-flow, overlay seams in overlay, SP-024 clocks in expiry, Heightened
// Spell in integration, render/selection in test.jsx.

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AOEConditionModal from './AOEConditionModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

// SP-024: fail grants stamp ONE addExpiration clock per failing target;
// the real expirationQueue stays inert in this harness.
vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// Re-import mocked modules
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';

// ── Test fixtures ──

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: 'Blinding Darkness',
};

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { con: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { con: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { con: 1 } },
    ],
};

const baseEffects = [{ type: 'blinded', condition: 'blinded' }];

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CON',
        saveDc: 12,
        effects: baseEffects,
        conditionLabel: 'Blinded',
        onClose: vi.fn(),
        ...overrides,
    };
}

// Route getRuntimeValue so only campaign targetEffects (trap lane) and per-target
// activeConditions (dedup lane) return what each test needs; everything else []
function mockRuntime({ targetEffects = [], activeConditions = [] } = {}) {
    getRuntimeValue.mockImplementation((_scope, key) => {
        if (key === 'targetEffects') return targetEffects;
        if (key === 'activeConditions') return activeConditions;
        return [];
    });
}

function selectTarget(name) {
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(name) }));
}

// ── Tests ──

describe('AOEConditionModal - Results & Behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatSummary.mockReturnValue(baseCombatSummary);
        addEntry.mockResolvedValue(undefined);
        getAllyList.mockReturnValue(null);
        mockRuntime();
    });

    // ── Condition deduplication ──

    it('does not duplicate an active condition and preserves unrelated conditions on a failed save', async () => {
        mockRuntime({ activeConditions: ['blinded', 'restrained'] });
        vi.spyOn(Math, 'random').mockReturnValue(0.01); // roll 1 + 0 < DC 12 → fail
        try {
            render(<AOEConditionModal {...makeProps()} />);
            selectTarget('Goblin');
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Blinding Darkness/ }));
            });

            await waitFor(() => {
                const writes = setRuntimeValue.mock.calls.filter(
                    call => call[0] === 'Goblin' && call[1] === 'activeConditions'
                );
                expect(writes.length).toBe(1);
                const conditions = writes[0][2];
                expect(conditions.filter(c => String(c).toLowerCase() === 'blinded')).toHaveLength(1);
                expect(conditions).toContain('restrained');
            });
        } finally {
            vi.restoreAllMocks();
        }
    });

    // ── Trap blocking exclusion (component-local isTargetExcludedByTraps) ──

    describe('blocking effects exclude creatures from eligible targets', () => {
        // Each TRAP_BLOCKING_EFFECTS entry blocks a trapped target, and the source
        // field distinguishes allowed (same-source cage-mates) from blocked attacks.
        const blockingCases = [
            ...['forcecage', 'maze', 'banishment', 'imprisonment'].map(effect => ({
                label: `${effect}: trapped target excluded, untrapped targets remain`,
                targetEffects: [{ effect, target: 'Goblin', source: 'CasterA' }],
                expectGoblin: false,
                expectOrc: true,
            })),
            {
                label: 'trapped attacker excludes every target',
                targetEffects: [{ effect: 'forcecage', target: 'Wizard1', source: 'CasterA' }],
                expectGoblin: false,
                expectOrc: false,
            },
            {
                label: 'same-source trap allows attack on cage-mate',
                targetEffects: [
                    { effect: 'forcecage', target: 'Wizard1', source: 'CasterA' },
                    { effect: 'forcecage', target: 'Goblin', source: 'CasterA' },
                ],
                expectGoblin: true,
                expectOrc: false,
            },
            {
                label: 'different-source traps block the attack',
                targetEffects: [
                    { effect: 'forcecage', target: 'Wizard1', source: 'CasterA' },
                    { effect: 'forcecage', target: 'Goblin', source: 'CasterB' },
                ],
                expectGoblin: false,
                expectOrc: false,
            },
        ];

        it.each(blockingCases)('$label', ({ targetEffects, expectGoblin, expectOrc }) => {
            mockRuntime({ targetEffects });
            render(<AOEConditionModal {...makeProps()} />);
            if (expectGoblin) {
                expect(screen.getByText('Goblin')).toBeInTheDocument();
            } else {
                expect(screen.queryByText('Goblin')).not.toBeInTheDocument();
            }
            if (expectOrc) {
                expect(screen.getByText('Orc')).toBeInTheDocument();
            } else {
                expect(screen.queryByText('Orc')).not.toBeInTheDocument();
            }
        });
    });
});
