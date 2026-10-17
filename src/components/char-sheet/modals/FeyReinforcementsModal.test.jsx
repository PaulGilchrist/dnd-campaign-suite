// @maintained-by-ai
/**
 * FeyReinforcementsModal — arm-flow lane (modal UI ⇄ LIVE handler through a LIVE store).
 *
 * Ownership map (siblings — do not duplicate here):
 * - feyReinforcementsHandler.test.js     — handler UNIT internals: handle() modal/popup routing,
 *   recorder-unit writes/notes, CLA-138 arm-at-usesMax shape. This lane runs the REAL
 *   confirmFeyReinforcement (never mocked) and pins its outward contract through the modal:
 *   live store cells, byte-exact log row, byte-exact popup copy — internals stay there.
 * - spellPreparationService.cla138-fey-reinforcements.test.js — CAST-time consumption/auth of
 *   `_Fey_Reinforcements_freeCastCount` and the no-Concentration honour at the spell row.
 *   This lane NEVER reaches spell preparation; the latch is armed here, consumed there.
 * - StepsOfTheFeyTauntModal.*.test.jsx — a different feature entirely.
 * This lane owns: mount purity (zero store reads/writes, zero log traffic until confirmed),
 * exact stage-one copy (header/icon, full-line lead with literal <strong>, checkbox label,
 * both concentration notes byte-exact on toggle), arm via live cells (latch at usesMax,
 * noConcentration stamp, exact setRuntimeValue call sequence), result state machine (parsed
 * dangerouslySetInnerHTML — real handler copy only, never fixture-echo; Done replaces
 * CTA/Cancel), Cancel/Done each closing exactly once, overlay/modal inertness contract,
 * custom name/spell/usesMax derivation, and the live "no free casts" gate (store-seeded 0).
 *
 * FLAG (pins actual behavior, not intent):
 * - FeyReinforcementsModal.jsx:11-15 — no pending guard on handleConfirm: two clicks in one
 *   flush DOUBLE-dispatch. Harmless to state (arm is idempotent at usesMax, CLA-138) but the
 *   campaign log gets DUPLICATE ability_use rows and duplicate noConcentration stamps.
 *   Product fix: disable the CTA (or claim a pending flag) before awaiting.
 * - FeyReinforcementsModal.jsx:12 — unguarded await: a rejecting/hanging setRuntimeValue
 *   strands the modal in stage one with NO feedback (never-settling pin + recovery below; a
 *   genuine rejection escapes handleConfirm unhandled and cannot be pinned without tripping
 *   Vitest's unhandled-rejection collector — same realm-split caveat as
 *   EyebiteEffectModal.player-save.test.jsx:25-30). Product fix: try/catch → error popup.
 * - FeyReinforcementsModal.jsx:41,49,60 — stage lead copy, checkbox note and CTA hard-code
 *   the literal 'Summon Fey' even when automation.spell differs (the popup DOES ride
 *   automation.spell). Pinned by the custom-spell test. Product fix: interpolate auto.spell.
 * - FeyReinforcementsModal.jsx:24 — result reads payload.description and ignores result.type
 *   and payload.automation (inert contract data; noted, not pinned).
 *
 * Anti-vacuity: LIVE runtime store (unwritten cell = missing cell, not a call-echo); LIVE log
 * recorder inspected directly; Date.now frozen (FROZEN_TS) where the handler stamps; frozen
 * fixtures consumed BY IDENTITY (derived cells/rows prove they were used); stubs of the real
 * copy are computed FROM the handler's shipped template — zero fixture-echo; role-scoped
 * queries; findBy idiom before any result-stage query; exact full-line text; fresh vi.fn
 * onClose per makeProps; afterEach mockReset + re-arm (never clearAllMocks); deterministic
 * dice — none on this seam; no timers of any kind.
 */
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FeyReinforcementsModal from './FeyReinforcementsModal.jsx';

// ── LIVE runtime store (anti-vacuous): the REAL handler arms cells here; inspected directly ──
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
    const cells = new Map();
    return {
        cells,
        getRuntimeValue: vi.fn((name, key) => cells.get(`${name}|${key}`) ?? null),
        setRuntimeValue: vi.fn((name, key, value) => { cells.set(`${name}|${key}`, value); return Promise.resolve(); }),
    };
});

// LIVE log recorder: rows land in `log` and are read back — "logged" is proven on the array.
vi.mock('../../../services/ui/logService.js', () => {
    const log = [];
    return {
        log,
        addEntry: vi.fn((campaign, entry) => { log.push({ campaign, entry }); return Promise.resolve(); }),
    };
});

import * as runtime from '../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../services/ui/logService.js';

const { cells } = runtime;
const { log } = logService;

const PLAYER = 'TestCharacter';
const CAMPAIGN = 'test-campaign';
const FROZEN_TS = 1737000000000;
const LATCH = '_Fey_Reinforcements_freeCastCount';
const NOCONC = '_Fey_Reinforcements_noConcentration';

// ── Fixtures (frozen; consumed by identity — derived cells/rows prove THIS action was used) ──
const ACTION = Object.freeze({
    name: 'Fey Reinforcements',
    automation: Object.freeze({ type: 'fey_reinforcements', usesMax: 1, spell: 'Summon Fey' }),
});
const PLAYER_STATS = Object.freeze({ name: PLAYER });

// Fresh vi.fn per render (house rule: no shared module-level onClose).
function makeProps(overrides = {}) {
    return {
        action: ACTION,
        playerStats: PLAYER_STATS,
        campaignName: CAMPAIGN,
        onClose: vi.fn(),
        ...overrides,
    };
}

// ── Byte-exact copy, computed FROM feyReinforcementsHandler.js:73,80,89 as shipped ──
const concNote = (noConc) => (noConc ? ' Concentration skipped — duration 1 minute.' : '');
const castsPhrase = (n) => `${n} free cast${n === 1 ? '' : 's'}`;
const EM_COPY = (spell) => `Open your spell sheet and cast ${spell} normally — no spell slot will be consumed.`;
const armedPopup = (feature, spell, usesMax, noConc) =>
    `${feature}: ${spell} free cast armed (${castsPhrase(usesMax)} available).${concNote(noConc)}<br/><br/><em>${EM_COPY(spell)}</em>`;
// textContent of the parsed popup (BR contributes nothing).
const armedText = (feature, spell, usesMax, noConc) =>
    `${feature}: ${spell} free cast armed (${castsPhrase(usesMax)} available).${concNote(noConc)}${EM_COPY(spell)}`;
const armLogRow = (feature, spell, usesMax, noConc) => ({
    type: 'ability_use',
    characterName: PLAYER,
    abilityName: feature,
    spellName: spell,
    note: `${feature}: ${spell} free cast armed — no spell slot and no Material components consumed.${concNote(noConc)} ${castsPhrase(usesMax)} available until your next Long Rest.`,
    timestamp: FROZEN_TS,
});

const NO_CASTS_COPY = 'No free casts remaining. Finish a Long Rest to regain them.';
const LEAD_COPY = 'Cast Summon Fey without material components or spell slot. This use does not consume a spell slot.';
const NOTE_NORMAL = 'The fey reinforcements will require Concentration and last up to 1 hour (normal Summon Fey duration).';
const NOTE_SKIPPED = 'The fey reinforcements will not require Concentration and will last 1 minute.';
const CHECKBOX_NAME = 'Skip Concentration (duration becomes 1 minute)';

async function clickSummon() {
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Summon Fey' }));
    });
}

// ── Setup / teardown ──

beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_TS);
});

// House rule: mockReset (not clearAllMocks/resetAllMocks) + re-arm; live cells/log wiped.
afterEach(() => {
    cleanup();
    cells.clear();
    log.length = 0;
    vi.restoreAllMocks();
    runtime.getRuntimeValue.mockReset().mockImplementation((name, key) => cells.get(`${name}|${key}`) ?? null);
    runtime.setRuntimeValue.mockReset().mockImplementation((name, key, value) => { cells.set(`${name}|${key}`, value); return Promise.resolve(); });
    logService.addEntry.mockReset().mockImplementation((campaign, entry) => { log.push({ campaign, entry }); return Promise.resolve(); });
});

describe('FeyReinforcementsModal — arm flow through the live store', () => {

    it('mount purity: exact stage-one copy with zero store reads/writes and zero log traffic', () => {
        const props = makeProps();
        const { container } = render(<FeyReinforcementsModal {...props} />);

        expect(screen.getByText('Fey Reinforcements')).toBeInTheDocument();
        expect(container.querySelector('.sp-header .fa-solid.fa-leaf')).toBeInTheDocument();
        const lead = container.querySelector('.sp-body p');
        expect(lead.textContent).toBe(LEAD_COPY);
        expect(lead.querySelector('strong').textContent).toBe('Summon Fey');
        expect(screen.getByRole('checkbox', { name: CHECKBOX_NAME }).checked).toBe(false);
        expect(container.querySelector('.fey-reinforcements-modal-note').textContent).toBe(NOTE_NORMAL);
        expect(screen.getByRole('button', { name: 'Summon Fey' }).querySelector('.fa-leaf')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();

        expect(runtime.getRuntimeValue.mock.calls).toEqual([]);
        expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
        expect(logService.addEntry.mock.calls).toEqual([]);
        expect(cells.size).toBe(0);
        expect(log).toEqual([]);
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it('checkbox toggles the note copy byte-exact both ways and nothing else moves', () => {
        render(<FeyReinforcementsModal {...makeProps()} />);
        const checkbox = screen.getByRole('checkbox', { name: CHECKBOX_NAME });
        const note = document.querySelector('.fey-reinforcements-modal-note');

        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(true);
        expect(note.textContent).toBe(NOTE_SKIPPED);

        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(false);
        expect(note.textContent).toBe(NOTE_NORMAL);

        expect(screen.getByRole('button', { name: 'Summon Fey' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    describe('arm (real handler, live store)', () => {
        it.each([false, true])('Summon Fey (skipConcentration=%s): exact reads, exact live writes, byte-exact log row, result stage', async (skipConc) => {
            const props = makeProps();
            const { container } = render(<FeyReinforcementsModal {...props} />);
            if (skipConc) fireEvent.click(screen.getByRole('checkbox', { name: CHECKBOX_NAME }));
            await clickSummon();

            // One read of the live latch, then the exact CLA-138 write sequence:
            // latch re-armed AT usesMax (never decremented at arm), checkbox stamp boolean.
            expect(runtime.getRuntimeValue.mock.calls).toEqual([[PLAYER, LATCH, CAMPAIGN]]);
            expect(runtime.setRuntimeValue.mock.calls).toEqual([
                [PLAYER, LATCH, 1, CAMPAIGN],
                [PLAYER, NOCONC, skipConc, CAMPAIGN],
            ]);
            expect(cells.get(`${PLAYER}|${LATCH}`)).toBe(1);
            expect(cells.get(`${PLAYER}|${NOCONC}`)).toBe(skipConc);

            // Exactly one ability_use row, byte-exact, on the LIVE recorder.
            expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, armLogRow('Fey Reinforcements', 'Summon Fey', 1, skipConc)]]);
            expect(log).toEqual([{ campaign: CAMPAIGN, entry: armLogRow('Fey Reinforcements', 'Summon Fey', 1, skipConc) }]);

            // Result stage replaces stage one (findBy idiom): CTA/Cancel/lead gone, Done in.
            expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Summon Fey' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
            expect(screen.queryByText(LEAD_COPY)).not.toBeInTheDocument();
            expect(screen.queryByRole('checkbox', { name: CHECKBOX_NAME })).not.toBeInTheDocument();

            // Real handler popup copy, byte-exact after parsing — the shipped contract, no echo.
            const body = container.querySelector('.sp-body');
            expect(body.textContent).toBe(armedText('Fey Reinforcements', 'Summon Fey', 1, skipConc));
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it('result renders through dangerouslySetInnerHTML: parsed <em> and two <br>, never escaped markup', async () => {
            const { container } = render(<FeyReinforcementsModal {...makeProps()} />);
            await clickSummon();

            await screen.findByText(EM_COPY('Summon Fey'));
            const body = container.querySelector('.sp-body');
            expect(body.querySelector('em')).not.toBeNull();
            expect(body.querySelector('em').textContent).toBe(EM_COPY('Summon Fey'));
            expect(body.querySelectorAll('br')).toHaveLength(2);
            // Byte-exact markup structure (serializer emits void <br>; normalize to pin the
            // shipped template, then prove nothing was escaped into visible text).
            expect(body.innerHTML.replace(/<br>/g, '<br/>')).toBe(armedPopup('Fey Reinforcements', 'Summon Fey', 1, false));
            expect(body.innerHTML).not.toContain('&lt;em&gt;');
            expect(screen.queryByText(/<em>/)).not.toBeInTheDocument();
        });

        it('custom name/spell/usesMax derive keys, plural copy and log row — but stage copy and CTA stay hard-coded "Summon Fey" (FLAG)', async () => {
            const action = Object.freeze({
                name: 'Woodland Reinforcements',
                automation: Object.freeze({ type: 'fey_reinforcements', usesMax: 2, spell: 'Summon Beast' }),
            });
            const { container } = render(<FeyReinforcementsModal {...makeProps({ action })} />);

            expect(screen.getByText('Woodland Reinforcements')).toBeInTheDocument();
            // FLAG :41/:60 — stage lead + checkbox + CTA never read automation.spell.
            expect(container.querySelector('.sp-body p strong').textContent).toBe('Summon Fey');
            expect(screen.getByRole('button', { name: 'Summon Fey' }).textContent.trim()).toBe('Summon Fey');

            await clickSummon();

            expect(runtime.setRuntimeValue.mock.calls).toEqual([
                [PLAYER, '_Woodland_Reinforcements_freeCastCount', 2, CAMPAIGN],
                [PLAYER, '_Woodland_Reinforcements_noConcentration', false, CAMPAIGN],
            ]);
            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, armLogRow('Woodland Reinforcements', 'Summon Beast', 2, false)],
            ]);
            const body = container.querySelector('.sp-body');
            expect(body.textContent).toBe(armedText('Woodland Reinforcements', 'Summon Beast', 2, false));
            expect(screen.getByText(EM_COPY('Summon Beast'))).toBeInTheDocument();
        });

        it('live latch seeded 0: gate refuses with the exact popup, zero writes, zero log, result stage still offered', async () => {
            cells.set(`${PLAYER}|${LATCH}`, 0);
            const props = makeProps();
            render(<FeyReinforcementsModal {...props} />);
            await clickSummon();

            expect(await screen.findByText(NO_CASTS_COPY)).toBeInTheDocument();
            expect(runtime.getRuntimeValue.mock.calls).toEqual([[PLAYER, LATCH, CAMPAIGN]]);
            expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
            expect(logService.addEntry.mock.calls).toEqual([]);
            expect(log).toEqual([]);
            expect(cells.get(`${PLAYER}|${LATCH}`)).toBe(0);
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it('double-click in one flush DOUBLE-arms with duplicate byte-exact log rows (FLAG :11-15 no pending guard); latch stays idempotent at usesMax', async () => {
            const { container } = render(<FeyReinforcementsModal {...makeProps()} />);

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Summon Fey' }));
                fireEvent.click(screen.getByRole('button', { name: 'Summon Fey' }));
            });

            expect(runtime.getRuntimeValue.mock.calls).toEqual([
                [PLAYER, LATCH, CAMPAIGN],
                [PLAYER, LATCH, CAMPAIGN],
            ]);
            // Sync interleaving: click1 writes the latch, click2 reads it back and writes again
            // (both stampers run in the microtask tails) — duplicate stamps, harmless state.
            expect(runtime.setRuntimeValue.mock.calls).toEqual([
                [PLAYER, LATCH, 1, CAMPAIGN],
                [PLAYER, LATCH, 1, CAMPAIGN],
                [PLAYER, NOCONC, false, CAMPAIGN],
                [PLAYER, NOCONC, false, CAMPAIGN],
            ]);
            expect(cells.get(`${PLAYER}|${LATCH}`)).toBe(1);

            // The real cost: TWO identical ability_use rows in the campaign log.
            const row = armLogRow('Fey Reinforcements', 'Summon Fey', 1, false);
            expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, row], [CAMPAIGN, row]]);
            expect(log).toEqual([{ campaign: CAMPAIGN, entry: row }, { campaign: CAMPAIGN, entry: row }]);

            // One result stage survives (last-write-wins state, one Done).
            expect(screen.getAllByRole('button', { name: 'Done' })).toHaveLength(1);
            expect(container.querySelector('.sp-body').textContent).toBe(armedText('Fey Reinforcements', 'Summon Fey', 1, false));
        });

        it('setRuntimeValue never settles (unguarded await :12): modal strands in stage one — no stamp, no log, no popup — a healthy re-click fully recovers (FLAG)', async () => {
            const { container } = render(<FeyReinforcementsModal {...makeProps()} />);
            runtime.setRuntimeValue.mockImplementationOnce(() => new Promise(() => {}));

            await clickSummon();

            // Stranded at the latch write: cell unwritten, stamp/log/popup all dead, stage one intact.
            expect(runtime.setRuntimeValue.mock.calls).toEqual([[PLAYER, LATCH, 1, CAMPAIGN]]);
            expect(cells.has(`${PLAYER}|${LATCH}`)).toBe(false);
            expect(logService.addEntry.mock.calls).toEqual([]);
            expect(log).toEqual([]);
            expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
            expect(container.querySelector('.sp-body p').textContent).toBe(LEAD_COPY);

            // Arm is re-entrant (nothing was consumed): a healthy re-click resolves fully.
            runtime.setRuntimeValue.mockImplementation((name, key, value) => { cells.set(`${name}|${key}`, value); return Promise.resolve(); });
            await clickSummon();

            expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
            expect(cells.get(`${PLAYER}|${LATCH}`)).toBe(1);
            expect(cells.get(`${PLAYER}|${NOCONC}`)).toBe(false);
            expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, armLogRow('Fey Reinforcements', 'Summon Fey', 1, false)]]);
            expect(container.querySelector('.sp-body').textContent).toBe(armedText('Fey Reinforcements', 'Summon Fey', 1, false));
        });
    });

    describe('close semantics', () => {
        it('Cancel closes exactly once and resolves nothing', () => {
            const props = makeProps();
            render(<FeyReinforcementsModal {...props} />);

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(props.onClose).toHaveBeenCalledTimes(1);
            expect(runtime.getRuntimeValue.mock.calls).toEqual([]);
            expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
            expect(cells.size).toBe(0);
            expect(logService.addEntry.mock.calls).toEqual([]);
            expect(log).toEqual([]);
        });

        it('Done after an arm closes exactly once and leaves the seam frozen', async () => {
            const props = makeProps();
            render(<FeyReinforcementsModal {...props} />);
            await clickSummon();
            const done = await screen.findByRole('button', { name: 'Done' });

            fireEvent.click(done);

            expect(props.onClose).toHaveBeenCalledTimes(1);
            expect(runtime.getRuntimeValue.mock.calls).toEqual([[PLAYER, LATCH, CAMPAIGN]]);
            expect(runtime.setRuntimeValue.mock.calls).toHaveLength(2);
            expect(logService.addEntry.mock.calls).toHaveLength(1);
            expect(log).toHaveLength(1);
        });

        it.each(['.sp-overlay', '.sp-modal'])('click on %s is inert: no close path exists on either container', (selector) => {
            const props = makeProps();
            render(<FeyReinforcementsModal {...props} />);

            fireEvent.click(document.querySelector(selector));

            expect(props.onClose).not.toHaveBeenCalled();
            expect(runtime.getRuntimeValue.mock.calls).toEqual([]);
            expect(screen.getByRole('button', { name: 'Summon Fey' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });
    });
});
