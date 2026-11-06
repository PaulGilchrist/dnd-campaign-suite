// @maintained-by-ai
// SaveAttackHealModal — handleSaveDismissedOverride seam (save-dismissed sweep
// family, 2026-11-05). The base lane freezes buttonless at "Waiting for save
// roll..." until every prompt resolves via save-result; the GM's un-rolled
// Dismiss used to strand it forever. The consumer drains the broadcast with a
// neutral "dismissed — no damage" row + save_dismissed log row — NO damage,
// no lastAttack overwrite (a dismissed save is never adjudicated as a failed
// save). Base forwarding pinned in AreaEffectTargetModalBase.save-dismissed
// .test.jsx; mock scaffold mirrors SaveAttackHealModal.saveFlows.test.jsx with
// a prop-capturing base stub.
import { render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import SaveAttackHealModal from './SaveAttackHealModal.jsx';

const PROMPT_ID = 'heal-dismiss-prompt-1';

const baseCombatSummary = {
    creatures: [
        { name: 'Player One', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { con: 1 } },
    ],
};

vi.mock('./AreaEffectTargetModalBase.jsx', () => ({
    default: vi.fn(() => <div data-testid="area-effect-modal-base" />),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    renderTargetList: vi.fn(() => null),
    logSaveEntry: vi.fn(),
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
    isWithinRange: vi.fn(() => true),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
    sendSaveResult: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 10, rolls: [1, 2, 3, 4], modifier: 0 })),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
    default: { getName: (n) => n, guid: vi.fn(() => PROMPT_ID) },
}));

vi.mock('../../../../services/ui/storage.js', () => ({
    default: { set: vi.fn(), get: vi.fn() },
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/automation/common/healingRoll.js', () => ({
    logHealingToSSE: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    computeDamageAfterEvasion: vi.fn(),
    hasEvasionForSave: vi.fn(() => false),
    normalizeSaveType: vi.fn((t) => String(t).toUpperCase()),
}));

import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';
import * as logService from '../../../../services/ui/logService.js';
import AreaEffectTargetModalBase from './AreaEffectTargetModalBase.jsx';

function makeProps(overrides = {}) {
    return {
        combatSummary: baseCombatSummary,
        attackerName: 'Cleric1',
        attackerPos: null,
        saveDc: 10,
        campaignName: 'test-campaign',
        mapData: null,
        featureName: 'Divine Smite',
        saveType: 'CON',
        rangeFeet: 60,
        damageExpression: '4d6',
        damageType: 'Radiant',
        healExpression: '2d8',
        onClose: vi.fn(),
        characters: [],
        ...overrides,
    };
}

function getDismissSeam() {
    render(<SaveAttackHealModal {...makeProps()} />);
    const seam = AreaEffectTargetModalBase.mock.calls.at(-1)[0].handleSaveDismissedOverride;
    expect(seam).toBeTypeOf('function');
    return seam;
}

function makeLiveCtx() {
    const state = { results: [], pendingPrompts: [{ promptId: PROMPT_ID, targetName: 'Player One' }] };
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

describe('SaveAttackHealModal handleSaveDismissedOverride seam', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('matching promptId drains neutral: zero damage, save_dismissed row, dismissed row appended with zeroed damage', () => {
        const seam = getDismissSeam();
        const { ctx, state } = makeLiveCtx();

        seam({ detail: { promptId: PROMPT_ID, targetName: 'Player One' } }, ctx);

        expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'lastAttack', expect.anything(), expect.anything());
        expect(automationRows()).toHaveLength(1);
        expect(automationRows()[0]).toMatchObject({
            automationType: 'save_dismissed',
            characterName: 'Cleric1',
            abilityName: 'Divine Smite',
            targetName: 'Player One',
        });
        expect(state.pendingPrompts).toHaveLength(0);
        expect(state.results[0]).toMatchObject({
            targetName: 'Player One', success: true, dismissed: true, rawDamage: 0, finalDamage: 0,
        });
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
