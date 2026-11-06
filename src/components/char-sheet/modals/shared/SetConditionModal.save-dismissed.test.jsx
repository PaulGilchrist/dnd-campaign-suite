// @maintained-by-ai
// SetConditionModal — handleSaveDismissedOverride seam (save-dismissed sweep
// family, 2026-11-05). The base lane renders a buttonless "Waiting for save
// roll..." freeze until every prompt resolves via save-result; the GM's
// un-rolled Dismiss used to strand it forever. The consumer drains the
// broadcast with a neutral dismissed row + save_dismissed log row (the
// condition is NEVER applied for an un-rolled save). Base forwarding is
// pinned in AreaEffectTargetModalBase.save-dismissed.test.jsx. Seam style
// mirrors BlindnessDeafnessModal.save-dismissed.test.jsx.
import { render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import SetConditionModal from './SetConditionModal.jsx';

const baseCombatSummary = {
    creatures: [{ name: 'Elf Mage', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 1 } }],
};
const PROMPT_ID = 'set-cond-dismiss-1';

vi.mock('./AreaEffectTargetModalBase.jsx', () => ({
    default: vi.fn(() => <div data-testid="area-effect-modal-base" />),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    renderTargetList: vi.fn(() => null),
    logSaveEntry: vi.fn(),
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 15),
}));

vi.mock('../../../../services/combat/conditions/conditionSaveService.js', () => ({
    addCondition: vi.fn(),
}));

vi.mock('../../../../services/combat/automation/automationService.js', () => ({
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
    default: { getName: (n) => n, guid: vi.fn(() => PROMPT_ID) },
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
    sendSaveResult: vi.fn(),
}));

import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as conditionSaveService from '../../../../services/combat/conditions/conditionSaveService.js';
import * as logService from '../../../../services/ui/logService.js';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';

function getDismissSeam() {
    render(<SetConditionModal
        combatSummary={baseCombatSummary}
        attackerName='Cleric1'
        attackerPos={null}
        saveDc={14}
        campaignName='test-campaign'
        mapData={null}
        monsters={[]}
        onClose={vi.fn()}
        characters={[]}
    />);
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

describe('SetConditionModal handleSaveDismissedOverride seam', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('matching promptId drains neutral: condition never applied, save_dismissed row, dismissed row appended', () => {
        const seam = getDismissSeam();
        const { ctx, state } = makeLiveCtx();

        seam({ detail: { promptId: PROMPT_ID, targetName: 'Elf Mage' } }, ctx);

        expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(automationRows()).toHaveLength(1);
        expect(automationRows()[0]).toMatchObject({
            automationType: 'save_dismissed',
            characterName: 'Cleric1',
            targetName: 'Elf Mage',
        });
        expect(state.pendingPrompts).toHaveLength(0);
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
});
