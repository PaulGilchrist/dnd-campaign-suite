// @maintained-by-ai
// ElementalAttunementModal — dismiss-softlock regression (save-dismissed sweep
// family, 2026-11-05). The 'processing' view (Resolving saves… / Waiting for
// save roll…) renders NO BUTTONS AT ALL, and the modal only advances when
// every pendingPrompts row resolves via save-result. The GM's un-rolled
// Dismiss dispatches a dedicated `save-dismissed` (dismiss doctrine — a
// dismissed save never resolves), which used to leave this view frozen
// forever. The lane now drains the dismissed prompt with an honest
// "Save dismissed — unaffected" row + a save_dismissed log row; a dismissed
// target takes NO damage / suffers no effect, and the drain reaches the
// summary view whose Close button works.
// Harness mirrors ElementalAttunementModal.player-save.test.jsx (live stores,
// frozen promptIds: Math.random 0.5 → `${FROZEN_TS}-i`).
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ElementalAttunementModal from './ElementalAttunementModal.jsx';

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

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', async (importOriginal) => ({
    ...await importOriginal(),
    computeDamageAfterSave: vi.fn((damage, success, dcSuccess) => {
        if (dcSuccess === 'half') return success ? Math.floor(damage / 2) : damage;
        return damage;
    }),
    computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
    applyDamageToTarget: vi.fn((summary, targetName, damage) => {
        const creature = summary?.creatures?.find(c => c.name === targetName);
        if (creature) creature.currentHp = Math.max(0, creature.currentHp - damage);
    }),
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

import * as runtime from '../../../hooks/runtime/useRuntimeState.js';
import * as applyDamage from '../../../services/rules/combat/applyDamage.js';
import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import * as aoeService from '../../../services/rules/combat/aoeService.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as logService from '../../../services/ui/logService.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';

const { cells } = runtime;

const PLAYER = 'Monk1';
const CAMPAIGN = 'test-campaign';
const OVERLAY = Object.freeze({ type: 'sphere' });
const FROZEN_TS = 1737000000000;
const PROMPT_ID_1 = `${FROZEN_TS}-i`;

const baseAction = Object.freeze({ name: 'Elemental Attunement' });
const basePlayerStats = Object.freeze({
    name: PLAYER,
    level: 5,
    proficiency: 3,
    abilities: Object.freeze([
        Object.freeze({ name: 'Wisdom', bonus: 1 }),
    ]),
});

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName: CAMPAIGN,
        onClose: vi.fn(),
        activeOverlay: OVERLAY,
        ...overrides,
    };
}

function makePlayer(name, currentHp, dexSave) {
    return { name, type: 'player', currentHp, maxHp: currentHp, saveBonuses: { dex: dexSave }, resistances: [], immunities: [] };
}

function seedPlayers(...players) {
    const summary = Object.freeze({ creatures: Object.freeze(players) });
    combatData.getCombatSummary.mockReturnValue(summary);
    aoeService.getAffectedCreatures.mockReturnValue(players.map(c => ({ creature: c })));
    return summary;
}

// Listener ledger for the modal's save buses (pass-through spies).
let netOpen = () => 0;

async function armFirePrompt() {
    fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));
    await screen.findByText(/Waiting for save roll/);
    // Flush so the pendingPrompts-keyed listener effect registers.
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalled());
}

const dispatchDismissed = (promptId) => act(async () => {
    window.dispatchEvent(new CustomEvent('save-dismissed', { detail: { promptId } }));
    await new Promise(r => setTimeout(r, 0));
});

beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_TS);
    let open = 0;
    const realAdd = window.addEventListener.bind(window);
    const realRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
        if (type === 'save-result' || type === 'save-dismissed') open += 1;
        return realAdd(type, fn, opts);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, fn, opts) => {
        if (type === 'save-result' || type === 'save-dismissed') open -= 1;
        return realRemove(type, fn, opts);
    });
    netOpen = () => open;
});

afterEach(() => {
    cleanup();
    cells.clear();
    vi.restoreAllMocks();
    runtime.getRuntimeValue.mockReset().mockImplementation((key, prop) => cells.get(`${key}|${prop}`) ?? null);
    runtime.setRuntimeValue.mockReset().mockImplementation((key, prop, value) => { cells.set(`${key}|${prop}`, value); return Promise.resolve(); });
    savePromptService.sendSavePrompt.mockReset();
    combatData.getCombatSummary.mockReset().mockReturnValue(null);
    aoeService.getAffectedCreatures.mockReset().mockReturnValue([]);
    logService.addEntry.mockReset().mockResolvedValue(undefined);
    applyDamage.applyDamageToTarget.mockClear();
    addExpiration.mockClear();
});

describe('ElementalAttunementModal — dismissed save prompt', () => {
    it('a matching save-dismissed un-strands the buttonless processing view: neutral row, drain to summary with working Close, zero harm, save_dismissed log row', async () => {
        const p1 = makePlayer('Player1', 20, 3);
        const onClose = vi.fn();
        seedPlayers(p1);
        render(<ElementalAttunementModal {...makeProps({ onClose })} />);
        await armFirePrompt();
        expect(netOpen()).toBe(2); // save-result + save-dismissed registered

        await dispatchDismissed(PROMPT_ID_1);

        // Pending row gone; honest neutral row appears.
        expect(document.querySelectorAll('.abjure-result-pending')).toHaveLength(0);
        // Drain-to-empty flips the phase to the summary view — Close works.
        const close = await screen.findByRole('button', { name: /Close/ });
        expect(document.body.textContent).toMatch(/Save dismissed — unaffected/);
        expect(document.body.textContent).not.toMatch(/Waiting for save roll/);

        // Neutral: no damage, no condition/effect writes on the victim.
        expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
        expect(cells.get('Player1|activeConditions') ?? null).toBe(null);
        expect(p1.currentHp).toBe(20);
        // Honest log: exactly one automation save_dismissed row, zero save/roll rows.
        const rows = logService.addEntry.mock.calls.map(c => c[1]);
        const dismissRows = rows.filter(e => e.type === 'automation' && e.automationDetail === 'save_dismissed');
        expect(dismissRows).toHaveLength(1);
        expect(dismissRows[0]).toMatchObject({ targetName: 'Player1', saveType: 'DEX', characterName: PLAYER });
        expect(rows.filter(e => e.type === 'roll')).toHaveLength(0);

        // Both listeners detached: pendingPrompts drained → effect cleanup.
        await waitFor(() => expect(netOpen()).toBe(0));
        fireEvent.click(close);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('a save-dismissed for a DIFFERENT promptId stays inert (mismatch guard)', async () => {
        seedPlayers(makePlayer('Player1', 20, 3));
        render(<ElementalAttunementModal {...makeProps()} />);
        await armFirePrompt();

        await dispatchDismissed('1999-x-not-mine');

        expect(document.querySelectorAll('.abjure-result-pending')).toHaveLength(1);
        expect(document.body.textContent).toMatch(/Waiting for save roll/);
        expect(logService.addEntry.mock.calls.map(c => c[1]).some(e => e.automationDetail === 'save_dismissed')).toBe(false);
    });
});
