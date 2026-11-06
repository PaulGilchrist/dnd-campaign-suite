// @maintained-by-ai
// BlindnessDeafnessModal — handleSaveDismissedOverride seam (save-dismissed
// sweep family, 2026-11-05). The base's processing view has NO buttons until
// allResolved (results.length >= selected), and resolution ran solely off
// save-result — a GM Dismiss on the un-rolled prompt stranded that buttonless
// freeze forever. The consumer now drains the broadcast with a neutral
// "dismissed — unaffected" row + save_dismissed log row (no condition ever
// applied). The base's own event forwarding/lifetime is pinned in
// AreaEffectTargetModalBase.save-dismissed.test.jsx; this lane owns the
// consumer's drain semantics. Harness mirrors
// BlindnessDeafnessModal.saveResult.test.jsx (mocked base, live-state seam).
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BlindnessDeafnessModal from './BlindnessDeafnessModal.jsx';

const baseCombatSummary = {
    creatures: [
        { name: 'Elf Mage', type: 'player', saveBonuses: { con: 1 } },
    ],
};

const BLENDED = { key: 'blinded', label: 'Blinded', condition: 'blinded' };
const DEAFENED = { key: 'deafened', label: 'Deafened', condition: 'deafened' };
const PROMPT_ID = 'bd-dismiss-prompt-1';

vi.mock('./shared/AreaEffectTargetModalBase.jsx', () => ({
    default: vi.fn(() => <div data-testid="area-effect-modal-base" />),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/conditions/conditionSaveService.js', () => ({
    addCondition: vi.fn(),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: (name) => name,
        guid: vi.fn(() => PROMPT_ID),
    },
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
    sendSaveResult: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/spells/blindnessDeafnessHandler.js', () => ({
    handle: vi.fn(),
    getEffectOptions: vi.fn(() => [BLENDED, DEAFENED]),
}));

import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../services/rules/effects/expirations.js';
import * as conditionSaveService from '../../../services/combat/conditions/conditionSaveService.js';
import * as logService from '../../../services/ui/logService.js';
import AreaEffectTargetModalBase from './shared/AreaEffectTargetModalBase.jsx';

function makeProps(overrides = {}) {
    return {
        combatSummary: baseCombatSummary,
        attackerName: 'Witch1',
        attackerPos: { gridX: 10, gridY: 10 },
        saveDc: 14,
        campaignName: 'test-campaign',
        mapData: null,
        onClose: vi.fn(),
        characters: [],
        featureName: 'Blindness/Deafness',
        rangeFeet: 120,
        ...overrides,
    };
}

function getDismissSeam() {
    render(<BlindnessDeafnessModal {...makeProps()} />);
    const seam = AreaEffectTargetModalBase.mock.calls.at(-1)[0].handleSaveDismissedOverride;
    expect(seam).toBeTypeOf('function');
    return seam;
}

function makeLiveCtx() {
    const state = { results: [], pendingPrompts: [{ promptId: PROMPT_ID, targetName: 'Elf Mage' }] };
    const ctx = {
        processing: true,
        combatSummary: baseCombatSummary,
        get results() { return state.results; },
        get pendingPrompts() { return state.pendingPrompts; },
        setProcessing: vi.fn(),
        setResults: vi.fn((fn) => { state.results = fn(state.results); }),
        setPendingPrompts: vi.fn((fn) => { state.pendingPrompts = fn(state.pendingPrompts); }),
    };
    return { ctx, state };
}

const automationRows = () => logService.addEntry.mock.calls.map(c => c[1]).filter(e => e && e.type === 'automation');

describe('BlindnessDeafnessModal handleSaveDismissedOverride seam', () => {
    beforeEach(() => {
        runtimeState.getRuntimeValue.mockReturnValue(null);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('matching promptId drains neutral: no condition, save_dismissed row, dismissed result row appended, pending emptied', async () => {
        const seam = getDismissSeam();
        const { ctx, state } = makeLiveCtx();

        seam({ detail: { promptId: PROMPT_ID, targetName: 'Elf Mage' } }, ctx);

        await Promise.resolve();

        expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(automationRows()).toHaveLength(1);
        expect(automationRows()[0]).toMatchObject({
            automationType: 'save_dismissed',
            automationDetail: 'save_dismissed',
            characterName: 'Witch1',
            abilityName: 'Blindness/Deafness',
            targetName: 'Elf Mage',
        });
        expect(state.pendingPrompts).toHaveLength(0);
        expect(state.results).toHaveLength(1);
        expect(state.results[0]).toMatchObject({ targetName: 'Elf Mage', success: true, dismissed: true });
    });

    it('a save-dismissed for a DIFFERENT promptId leaves the state untouched (mismatch guard)', () => {
        const seam = getDismissSeam();
        const { ctx, state } = makeLiveCtx();

        seam({ detail: { promptId: 'not-my-prompt' } }, ctx);

        expect(ctx.setResults).not.toHaveBeenCalled();
        expect(ctx.setPendingPrompts).not.toHaveBeenCalled();
        expect(automationRows()).toHaveLength(0);
        expect(state.pendingPrompts).toHaveLength(1);
    });

    it('a dismissed event WITHOUT a matching pending row is inert even for the right id after drain', () => {
        const seam = getDismissSeam();
        const { ctx } = makeLiveCtx();

        // Empty pending (e.g. already resolved) — nothing to drain.
        seam({ detail: { promptId: PROMPT_ID } }, { ...ctx, pendingPrompts: [] });

        expect(automationRows()).toHaveLength(0);
    });
});
