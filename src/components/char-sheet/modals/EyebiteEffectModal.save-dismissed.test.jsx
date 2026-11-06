// @maintained-by-ai
// EyebiteEffectModal — dismiss-softlock regression (save-dismissed sweep
// family, 2026-11-05, playbook §66 "Eyebite family"). The cast parks a
// pending row awaiting save-result; the GM's un-rolled Dismiss never
// dispatches one, so the prompt silently resolved nothing. The lane opts into
// the promptId-keyed `save-dismissed` broadcast: the target is UNAFFECTED
// (no condition written — never adjudicated as a failed save), a
// save_dismissed log row lands, and the Done popup renders with a working
// button. Harness mirrors EyebiteEffectModal.player-save.test.jsx; unique
// promptIds per mint (§66 test doctrine).
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EyebiteEffectModal from './EyebiteEffectModal.jsx';

vi.mock('./shared/SecondaryTargetModal.jsx', () => ({
    default: vi.fn(({ targets, onTargetSelected, onSkip, confirmLabel }) => (
        <div data-testid="secondary-target-modal">
            <button onClick={() => onTargetSelected(targets[0].name || targets[0])} data-testid="stm-confirm" type="button">{confirmLabel}</button>
            <button onClick={onSkip} data-testid="stm-skip" type="button">Skip</button>
        </div>
    )),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
    const cells = new Map();
    const read = (key, prop) => cells.get(`${key}|${prop}`) ?? null;
    const write = (key, prop, value) => { cells.set(`${key}|${prop}`, value); return Promise.resolve(); };
    return {
        cells,
        getRuntimeValue: vi.fn(read),
        setRuntimeValue: vi.fn(write),
    };
});

vi.mock('../../../services/automation/common/damageRollback.js', () => ({
    rollback: { lastAttack: null, results: [] },
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    playerIsImmuneToCondition: vi.fn(() => false),
}));

let guidCounter = 0;
vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: (name) => name,
        guid: vi.fn(() => `eyebite-dismiss-guid-${++guidCounter}`),
    },
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
    sendSaveResult: vi.fn(),
}));

vi.mock('../../../services/combat/auras/auraConditionImmunity.js', () => ({
    getAuraConditionImmunities: vi.fn(() => Promise.resolve({ immunities: [], immunitySources: {} })),
    auraCoversCondition: vi.fn(() => false),
    splitAuraCoveredConditions: vi.fn((saveConditions) => ({ covered: [], applicable: saveConditions || [] })),
    logAuraConditionImmunity: vi.fn(),
}));

import * as runtime from '../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../services/rules/effects/expirations.js';
import * as logService from '../../../services/ui/logService.js';
import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import * as damageRollback from '../../../services/automation/common/damageRollback.js';

const { cells } = runtime;

const PLAYER = 'Elf Mage';
const CASTER = 'Witch1';
const CAMPAIGN = 'test-campaign';

function makeProps(overrides = {}) {
    return {
        combatSummary: { creatures: [{ name: PLAYER, type: 'player', saveBonuses: { wis: 1 } }] },
        attackerName: CASTER,
        saveDc: 13,
        campaignName: CAMPAIGN,
        onClose: vi.fn(),
        characters: [],
        featureName: 'Eyebite',
        rangeFeet: 60,
        ...overrides,
    };
}

// Arm: choose Panicked → confirm the single target → a WIS prompt is issued
// and the pending-keyed listeners register.
async function armPlayerPrompt(props) {
    render(<EyebiteEffectModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /^Panicked/ }));
    const confirm = await screen.findByTestId('stm-confirm');
    await act(async () => { fireEvent.click(confirm); });
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
    return savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
}

function trackSaveLedger() {
    const ledger = { open: 0 };
    const realAdd = window.addEventListener.bind(window);
    const realRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
        if (type === 'save-result' || type === 'save-dismissed') ledger.open += 1;
        return realAdd(type, fn, opts);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, fn, opts) => {
        if (type === 'save-result' || type === 'save-dismissed') ledger.open -= 1;
        return realRemove(type, fn, opts);
    });
    return ledger;
}

const dispatchDismissed = (promptId) => act(async () => {
    window.dispatchEvent(new CustomEvent('save-dismissed', { detail: { promptId } }));
    await new Promise(r => setTimeout(r, 0));
});

const automationRows = () => logService.addEntry.mock.calls.map(c => c[1]).filter(e => e && e.type === 'automation');

describe('EyebiteEffectModal — dismissed save prompt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cells.clear();
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('a matching save-dismissed: neutral Done popup, no condition, save_dismissed row, both listeners detached', async () => {
        const ledger = trackSaveLedger();
        const props = makeProps();
        const promptId = await armPlayerPrompt(props);
        expect(ledger.open).toBe(2); // save-result + save-dismissed companions

        await dispatchDismissed(promptId);

        // Neutral refusal view with a working escape.
        expect(await screen.findByText(`${PLAYER}'s save was dismissed — ${PLAYER} is unaffected.`)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(props.onClose).toHaveBeenCalledTimes(1);

        // Zero harm state: no condition write, no expiration, no fake success,
        // and the only NEW log after the cast preamble is the save_dismissed row.
        expect(cells.get(`${PLAYER}|activeConditions`) ?? null).toBe(null);
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(damageRollback.addTargetResult).not.toHaveBeenCalled();
        expect(automationRows()).toHaveLength(1);
        expect(automationRows()[0]).toMatchObject({
            automationType: 'save_dismissed',
            automationDetail: 'save_dismissed',
            characterName: CASTER,
            targetName: PLAYER,
        });

        await waitFor(() => expect(ledger.open).toBe(0)); // pending drained → cleanup removed BOTH
    });

    it('a save-dismissed for a DIFFERENT promptId stays inert (mismatch guard)', async () => {
        const props = makeProps();
        await armPlayerPrompt(props);

        await dispatchDismissed('someone-else-prompt');

        expect(automationRows()).toHaveLength(0);
        expect(screen.queryByText(/save was dismissed/)).not.toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();
    });
});
