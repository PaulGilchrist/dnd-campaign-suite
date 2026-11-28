// @maintained-by-ai 2026-11-27
/**
 * ElementalBurstModal — single-file lane (jsx:1-117, the whole modal). No siblings: this is the
 * ONLY lane for ElementalBurst (elementalBurstHandler.test.js owns how the modal is OPENED;
 * CharActionModals.async-confirm-handlers.test.jsx MOCKS this component, never tests it).
 * The modal is a two-phase pass-through: element-type chooser → payload snapshot →
 * SaveAttackAoeModal handoff. Lanes that own the other side of each seam:
 * - SaveAttackAoeModal.* (46 lanes) — everything INSIDE the AOE modal (saves, damage, targets).
 *   Consumed here ONLY as a captured boundary: exact payload shape, identities, DC, die, phase gate.
 * - useOverlayEntranceFocus — its own hook lane; not pinned here.
 *
 * Owned here (nothing else can show it):
 * - Element-phase exact copy (DC sentence, note sentence, header, five buttons + icons in authored
 *   order), DC math arms (incl. negative-DEX survival and NaN proficiency), martial-arts-die
 *   resolution arms (incl. first-match and falsy-collapse), the synchronous element→aoe commit
 *   (processing phase is UNOBSERVABLE — one act flush, zero stranded frames), the full-shape
 *   payload toEqual + reference identity (#1890: action/playerStats forwarded BY IDENTITY,
 *   frozen fixtures prove inertness), live-vs-snapshot split (characters prop is LIVE through
 *   rerenders; the payload is frozen), exact full-line addEntry payloads (byte-exact description
 *   + frozen timestamp, synchronous), Cancel/overlay/close wiring asymmetry (Cancel forwards the
 *   click event; AOE close strips args).
 *
 * CLUSTER AUDIT (run2#1978 handoff, three predicted classes — all CLEAN on this component):
 * - Unreachable modal mocks: none. SaveAttackAoeModal is the phase-'aoe' mount and IS reached by
 *   every chooseType flow; logService.addEntry is called at jsx:29. Nothing mocked is dead.
 * - setCombatSummaryCache phantom: N/A — the component imports NO combatData module at all
 *   (imports are logService, SaveAttackAoeModal, useOverlayEntranceFocus only).
 * - applyDamage mirror overrides: N/A — the AOE mock is a render-capture stub (call-args
 *   census), it re-implements zero rules math.
 * - Double-roll redisplay (rolls!=total): N/A — this modal renders no save-result summary;
 *   result display is entirely SaveAttackAoeModal's surface.
 *
 * TRIMMED (2026-11-27 audit; same-branch deletions with rationale, 50 tests → 33):
 * - 'is inert on frozen props' — exact duplicate of the full-shape payload test's toBe identity
 *   pins for action/playerStats.
 * - DC it.each 3 operand arms → 1 arm (dex 6/prof 4 → 18): all three arms exercised the ONE
 *   expression `8 + dex + proficiency`; the kept arm varies BOTH operands to a sum (18) distinct
 *   from base (15), proving neither operand is ignored. Base 15 is pinned by the mount copy test.
 * - DC it.each 4 default-abilities arms → 2: 'empty array' and 'Dexterity without bonus' land on
 *   the identical undefined→`|| 0` branch already proven by 'no Dexterity entry' (find miss) and
 *   'undefined abilities' (`?.` chain on abilities itself).
 * - 'proficiency 0' arm — same output (12) and same coercion branch as 'proficiency null'.
 * - 'the computed DC is the numeric saveDc 18 in the payload' — saveDc COMPUTATION is pinned by
 *   the NaN flag arm (varied proficiency → payload NaN) and saveDc 15 lands in the full-shape
 *   payload toEqual; the 18-arm re-ran an already-pinned branch.
 * - Martial-die arms 'level 5 → d4 (base)' (exact duplicate of the mount note-sentence test) and
 *   'class {} → d4' (class_levels undefined → `|| []` find-miss — same branch as 'level 99, []').
 * - DAMAGE_TYPES it.each (5 renders × identical template) → ONE Cold arm: description is one
 *   interpolation already byte-pinned by the Fire test, damageType is one `toLowerCase()` path;
 *   the five NAMES are census-pinned by the ordered button test.
 * - Object.keys() JSX-order census — absorbed: full-shape toEqual demands the identical key SET
 *   (missing/renamed keys fail); spread ORDER is not a contract (child destructures).
 * - 'characters defaults to null' — absorbed into the full-shape toEqual (characters: null); its
 *   rendered-span check asserted the MOCK's own template, not the component.
 * - 'second click structurally impossible' — subsumed by the detached-node re-click test (a
 *   strictly stronger double-fire detector) + the transition test's button-gone assertion.
 * - overlay-background click + modal-content click → merged (one render, both nodes clicked —
 *   both are the same no-listener absence witness).
 * - Log-commit test 1: mockImplementation campaign-capture array dropped — full-args
 *   toEqual([CAMPAIGN, entry]) pins the campaign argument identically (call-only mirrors #1964).
 * - objectContaining rows → exact full entries (markup test, custom-campaign test): every
 *   remaining entry pin is a complete 5-key toEqual; every pin below fails if its owned byte
 *   changes (masked-row pass #1962).
 *
 * FLAGS (pinned or probe-verified; product fixes belong to the component, not this lane;
 * line refs re-verified against current component bytes 2026-11-27):
 * - jsx:27 + jsx:32-33 (PROBE-VERIFIED live 2026-10-17): clicking a damage type with `action`
 *   undefined throws TypeError "Cannot read properties of undefined (reading 'name')" inside the
 *   async handleTypeChoice AFTER setPhase('processing') has committed (:27). Result: SILENT
 *   STRAND — modal renders null (phase 'processing', payload null), Cancel is gone, nothing is
 *   logged, the rejection is unhandled. Pinned as far as safely possible (safe-undefined render,
 *   :edge-cases); the click itself would fail the run at vitest's unhandled-rejection collector.
 *   Product fix: guard `action?.name` or render Cancel during 'processing'.
 * - jsx:68: header hardcodes 'Elemental Burst' even for custom action names — custom names appear
 *   ONLY in the log and payload. Pinned below; harmless but silently drifts from the action label.
 * - jsx:37 + jsx:71: proficiency is UNGUARDED (`8 + dex + playerStats.proficiency`) — undefined
 *   produces 'DC NaN' in copy AND NaN payload saveDc. Pinned as actual behavior.
 * - jsx:16: `classLevel?.martial_arts_die || 4` collapses a legitimate 0 to d4 (benign: no d0
 *   exists) and `?.bonus || 0` (:37/:71) harmlessly passes -0; negative bonus survives `|| 0`
 *   (−3 stays −3 → DC 8). Both arms pinned.
 * - jsx:56-58: handleAoeClose has NO idempotency guard and strips args (`onClose()` with zero
 *   args) while Cancel (`onClick={onClose}`, jsx:97) forwards the raw click event. Both arms
 *   pinned — the arg asymmetry is real; double-close forwards twice.
 * - jsx:73-88: inline styles (violates the no-inline-styles house rule). Not a test defect;
 *   flagged for the component owner. This lane's render helpers use NO inline styles.
 *
 * Anti-vacuity: fixtures are deep-frozen (mutation attempts throw); payload action/playerStats
 * pinned by IDENTITY (toBe) inside a full-shape toEqual; Date.now frozen to FROZEN_TS — verified
 * stamping outlet at jsx:34 — so every timestamp in every exact entry is deterministic; exact
 * full-line text everywhere (no objectContaining on owned keys); role-scoped queries; fresh vi.fn
 * onClose per makeProps; afterEach mockReset + re-arm (never clearAllMocks); zero bare setTimeout
 * — the synchronous post-fireEvent assertions ARE the transition proof; waitFor ONLY for the
 * genuine addEntry-rejection .catch seam.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ElementalBurstModal from './ElementalBurstModal.jsx';

// ── Mocks (both paths verified on disk; factory keys = the component's actual imports:
// { addEntry } from logService.js:274, default export from SaveAttackAoeModal.jsx) ──

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// Captured boundary: every AOE render is recorded; the payload contract is pinned on call-args,
// its internals are SaveAttackAoeModal's 46 lanes. Zero AOE-internal logic — and zero rules
// math mirrors (#1978) — lives in this file.
vi.mock('./shared/SaveAttackAoeModal.jsx', () => ({
    default: vi.fn(({ action, damage, damageType, saveDc, saveType, characters, onClose }) => (
        <div data-testid="save-attack-aoe-modal">
            <span data-testid="aoe-action">{action?.name}</span>
            <span data-testid="aoe-damage">{damage}</span>
            <span data-testid="aoe-damage-type">{damageType}</span>
            <span data-testid="aoe-save-type">{saveType}</span>
            <span data-testid="aoe-save-dc">{saveDc}</span>
            <span data-testid="aoe-characters">{JSON.stringify(characters ?? null)}</span>
            <button onClick={onClose}>Close AOE Modal</button>
        </div>
    )),
}));

// ── Re-import mocked modules ──

import * as logService from '../../../services/ui/logService.js';
import * as SaveAttackAoeModalMock from './shared/SaveAttackAoeModal.jsx';

// Stable stub implementation for afterEach re-arm (mockReset then re-arm, house rule).
const AOE_STUB = SaveAttackAoeModalMock.default.getMockImplementation();

// ── Fixtures (deep-frozen: the component MUST NOT mutate them; attempts throw) ──

const CAMPAIGN = 'test-campaign';
const PLAYER = 'Monk1';
const FROZEN_TS = 1737000000000;

const baseAction = Object.freeze({ name: 'Elemental Burst' });

// DC = 8 + DEX 4 + PROF 3 = 15; martial die at level 5 = d4 → '3d4'.
const basePlayerStats = Object.freeze({
    name: PLAYER,
    level: 5,
    proficiency: 3,
    abilities: Object.freeze([
        Object.freeze({ name: 'Strength', bonus: 2 }),
        Object.freeze({ name: 'Dexterity', bonus: 4 }),
        Object.freeze({ name: 'Constitution', bonus: 1 }),
        Object.freeze({ name: 'Intelligence', bonus: 0 }),
        Object.freeze({ name: 'Wisdom', bonus: 1 }),
        Object.freeze({ name: 'Charisma', bonus: 0 }),
    ]),
    class: Object.freeze({
        class_levels: Object.freeze([
            Object.freeze({ level: 1, martial_arts_die: 4 }),
            Object.freeze({ level: 2, martial_arts_die: 4 }),
            Object.freeze({ level: 3, martial_arts_die: 4 }),
            Object.freeze({ level: 4, martial_arts_die: 4 }),
            Object.freeze({ level: 5, martial_arts_die: 4 }),
        ]),
    }),
});

// Fresh vi.fn per render (house rule: no shared module-level onClose).
function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName: CAMPAIGN,
        onClose: vi.fn(),
        ...overrides,
    };
}

// ── Helpers ──

function renderModal(props = {}) {
    const onClose = vi.fn();
    const utils = render(<ElementalBurstModal {...makeProps({ onClose, ...props })} />);
    return {
        onClose,
        ...utils,
        rerenderWith: (nextProps = {}) => utils.rerender(<ElementalBurstModal {...makeProps({ onClose, ...nextProps })} />),
    };
}

function chooseType(name) {
    fireEvent.click(screen.getByRole('button', { name }));
}

function statsWith(overrides = {}) {
    return Object.freeze({ ...basePlayerStats, ...overrides });
}

const LEVEL_17_CLASS = Object.freeze({ class_levels: Object.freeze([Object.freeze({ level: 17, martial_arts_die: 8 })]) });
const dexOnly = bonus => Object.freeze([Object.freeze({ name: 'Dexterity', bonus })]);

// Element-phase copy lives in exact textContent — no regex soup.
function descriptionLine(container) {
    return container.querySelector('.sp-body p').textContent;
}
function noteLine(container) {
    return container.querySelector('.sp-note').textContent;
}
const dcSentence = dc => `Choose a damage type for the elemental burst. Each creature in a 20-foot-radius sphere within 120 feet must make a Dexterity saving throw (DC ${dc}).`;
const noteSentence = die => `On a failed save, a creature takes 3d${die} damage of the chosen type. On a successful save, a creature takes half as much damage.`;

// Payload call-args of the Nth AOE render.
function aoeProps(call = 0) {
    return SaveAttackAoeModalMock.default.mock.calls[call][0];
}

const DAMAGE_TYPES = [
    { name: 'Acid', icon: 'fa-leaf' },
    { name: 'Cold', icon: 'fa-snowflake' },
    { name: 'Fire', icon: 'fa-fire' },
    { name: 'Lightning', icon: 'fa-bolt' },
    { name: 'Thunder', icon: 'fa-volume-high' },
];

// ── Setup / teardown ──

beforeEach(() => {
    // Date.now is a VERIFIED stamping outlet (jsx:34 timestamp field), so freezing is warranted.
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_TS);
});

// House rule: mockReset + re-arm (never clearAllMocks); AOE stub re-armed; spies restored.
// Every per-test addEntry override is re-baselined here (#1965).
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    logService.addEntry.mockReset().mockResolvedValue(undefined);
    SaveAttackAoeModalMock.default.mockReset().mockImplementation(AOE_STUB);
});

// ── Tests ──

describe('ElementalBurstModal', () => {
    describe('element phase — mount purity and exact copy', () => {
        it('renders the exact DEX-save description sentence with DC 15 (8 + DEX 4 + PROF 3)', () => {
            const { container } = renderModal();
            expect(descriptionLine(container)).toBe(dcSentence(15));
        });

        it('renders the exact damage note sentence for 3d4 at level 5', () => {
            const { container } = renderModal();
            expect(noteLine(container)).toBe(noteSentence(4));
        });

        it('renders all five damage buttons in authored order, each with its exact icon', () => {
            renderModal();
            const buttons = screen.getAllByRole('button');
            // 5 type buttons + Cancel — nothing else mounts in the chooser.
            expect(buttons.map(b => b.textContent.trim())).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder', 'Cancel']);
            for (const { name, icon } of DAMAGE_TYPES) {
                const btn = screen.getByRole('button', { name });
                expect(btn.querySelector('i').className).toBe(`fa-solid ${icon}`);
            }
        });

        it('FLAG pinned: header hardcodes Elemental Burst even when the action has a custom name', () => {
            const { container } = renderModal({ action: Object.freeze({ name: 'Storm Palm' }) });
            expect(container.querySelector('.sp-header').textContent.trim()).toBe('Elemental Burst');
        });

        it('mounts inertly: zero addEntry calls, zero AOE renders, zero onClose calls', () => {
            const { onClose } = renderModal();
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(SaveAttackAoeModalMock.default).not.toHaveBeenCalled();
            expect(onClose).not.toHaveBeenCalled();
            expect(screen.queryByTestId('save-attack-aoe-modal')).toBeNull();
        });
    });

    describe('DC calculation (8 + DEX + proficiency, unguarded proficiency)', () => {
        it('DC 18 (DEX 6 + PROF 4 — both operands varied from base) lands verbatim in the DC sentence', () => {
            const { container } = renderModal({
                playerStats: statsWith({ proficiency: 4, abilities: dexOnly(6) }),
            });
            expect(descriptionLine(container)).toBe(dcSentence(18));
        });

        it.each([
            { abilities: undefined, name: 'undefined abilities (?. chain)' },
            { abilities: Object.freeze([Object.freeze({ name: 'Strength', bonus: 2 })]), name: 'no Dexterity entry (find miss → ?.bonus undefined → || 0)' },
        ])('defaults DEX bonus to 0 (DC 11) when abilities is $name', ({ abilities }) => {
            const { container } = renderModal({ playerStats: statsWith({ abilities }) });
            expect(descriptionLine(container)).toBe(dcSentence(11));
        });

        it('a NEGATIVE DEX bonus survives `|| 0` (jsx:37) — DEX -3 yields DC 8, not 11', () => {
            const { container } = renderModal({ playerStats: statsWith({ abilities: dexOnly(-3) }) });
            expect(descriptionLine(container)).toBe(dcSentence(8));
        });

        it('proficiency null coerces: 8 + 4 + null = 12 in the exact sentence', () => {
            const { container } = renderModal({ playerStats: statsWith({ proficiency: null }) });
            expect(descriptionLine(container)).toBe(dcSentence(12));
        });

        it('FLAG pinned: undefined proficiency is UNGUARDED (jsx:37/:71) — copy and payload both go NaN', () => {
            const { container } = renderModal({ playerStats: statsWith({ proficiency: undefined }) });
            expect(descriptionLine(container)).toBe(dcSentence('NaN'));
            chooseType('Fire');
            expect(aoeProps().saveDc).toBeNaN();
        });
    });

    describe('martial arts die resolution (jsx:14-17)', () => {
        it.each([
            { level: 17, class: LEVEL_17_CLASS, die: 8, why: 'level-17 entry d8' },
            { level: 99, class: Object.freeze({ class_levels: Object.freeze([]) }), die: 4, why: 'no match → fallback d4' },
            { level: 5, class: undefined, die: 4, why: 'class undefined → ?. chain → d4' },
            { level: 5, class: Object.freeze({ class_levels: Object.freeze([Object.freeze({ level: 5, martial_arts_die: 0 })]) }), die: 4, why: 'die 0 collapses through || 4 (no d0 exists)' },
            { level: 5, class: Object.freeze({ class_levels: Object.freeze([Object.freeze({ level: 5, martial_arts_die: 8 }), Object.freeze({ level: 5, martial_arts_die: 4 })]) }), die: 8, why: 'find() takes the FIRST matching level' },
        ])('level $level resolves $die — $why', ({ level, class: cls, die }) => {
            const { container } = renderModal({ playerStats: statsWith({ level, class: cls }) });
            expect(noteLine(container)).toBe(noteSentence(die));
        });

        it('the resolved die reaches the payload as damage 3d8 at level 17', () => {
            renderModal({ playerStats: statsWith({ level: 17, class: LEVEL_17_CLASS }) });
            chooseType('Fire');
            expect(aoeProps().damage).toBe('3d8');
        });
    });

    describe('log commit — exact full-line ability_use entries, dispatched synchronously', () => {
        it('clicking Fire calls addEntry ONCE, synchronously, with the byte-exact full args', () => {
            renderModal();
            chooseType('Fire');
            // NO waitFor: the log call is synchronous inside handleTypeChoice (jsx:29).
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
            expect(logService.addEntry.mock.calls[0]).toEqual([CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: 'Elemental Burst',
                description: 'Elemental Burst: Chose Fire damage type.',
                timestamp: FROZEN_TS,
            }]);
        });

        it('choosing Cold: exact log description and lowercased damageType in the payload', () => {
            renderModal();
            chooseType('Cold');
            expect(logService.addEntry.mock.calls[0]).toEqual([CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: 'Elemental Burst',
                description: 'Elemental Burst: Chose Cold damage type.',
                timestamp: FROZEN_TS,
            }]);
            expect(aoeProps().damageType).toBe('cold');
        });

        it('a custom campaign name routes verbatim to both the full log args and the payload', () => {
            renderModal({ campaignName: 'Frostfall-clone-test' });
            chooseType('Cold');
            expect(logService.addEntry.mock.calls[0]).toEqual(['Frostfall-clone-test', {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: 'Elemental Burst',
                description: 'Elemental Burst: Chose Cold damage type.',
                timestamp: FROZEN_TS,
            }]);
            expect(aoeProps().campaignName).toBe('Frostfall-clone-test');
        });

        it('a custom action name reaches the log description and stays the SAME object in the payload', () => {
            const custom = Object.freeze({ name: 'Storm Palm Burst' });
            renderModal({ action: custom });
            chooseType('Cold');
            expect(logService.addEntry.mock.calls[0]).toEqual([CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: 'Storm Palm Burst',
                description: 'Storm Palm Burst: Chose Cold damage type.',
                timestamp: FROZEN_TS,
            }]);
            expect(aoeProps().action).toBe(custom);
        });

        it('markup in an action name is passed RAW to the log (this component renders no HTML sink)', () => {
            const evil = Object.freeze({ name: '<img src=x onerror=alert(1)>' });
            const { container } = renderModal({ action: evil });
            chooseType('Fire');
            expect(logService.addEntry.mock.calls[0]).toEqual([CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: evil.name,
                description: '<img src=x onerror=alert(1)>: Chose Fire damage type.',
                timestamp: FROZEN_TS,
            }]);
            // No HTML sink in this modal: nothing parsed anywhere in the mounted tree.
            expect(container.querySelector('img, script, [onerror]')).toBeNull();
            expect(screen.getByTestId('aoe-action')).toHaveTextContent('<img src=x onerror=alert(1)>');
        });

        it('addEntry rejection logs the EXACT prefixed error once and never blocks the AOE commit', async () => {
            const err = new Error('network down');
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            logService.addEntry.mockRejectedValueOnce(err);
            renderModal();
            chooseType('Fire');
            // Commit is synchronous and independent of the log lane (jsx:29 never awaited).
            expect(screen.getByTestId('save-attack-aoe-modal')).toBeInTheDocument();
            expect(aoeProps().damageType).toBe('fire');
            expect(aoeProps().saveDc).toBe(15);
            // Genuine async seam: the .catch at jsx:35 lands on a microtask.
            await vi.waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith('[ElementalBurstModal] Error logging type choice:', err);
            });
            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('AOE payload contract (captured boundary — internals owned by SaveAttackAoeModal lanes)', () => {
        it('first AOE render receives the FULL exact payload: every key/value + identity forwards', () => {
            renderModal();
            chooseType('Fire');
            const props = aoeProps();
            // Full-shape toEqual (#1890): an identical key SET and values — renaming, dropping or
            // changing any key (shape/range/damage/saveType/dcSuccess/characters default) fails.
            expect(props).toEqual({
                action: baseAction,
                playerStats: basePlayerStats,
                campaignName: CAMPAIGN,
                shape: 'sphere',
                range: 20,
                damage: '3d4',
                damageType: 'fire',
                saveType: 'DEX',
                saveDc: 15,
                dcSuccess: 'half',
                characters: null,
                onClose: expect.any(Function),
            });
            // toEqual is recursive-equality; identity of the two pass-through objects is its own pin.
            expect(props.action).toBe(baseAction);
            expect(props.playerStats).toBe(basePlayerStats);
            // typeof-only onClose pin: behavior-owned below — the AOE-close test clicks the
            // mock's onClick={onClose} wire and proves the parent's fresh onClose fires.
        });

        it('SNAPSHOT vs LIVE: after selection, payload stays frozen but the characters prop stays live through rerenders', () => {
            const goblins = Object.freeze(['Goblin1']);
            const { rerenderWith } = renderModal({ characters: goblins });
            chooseType('Fire');
            expect(aoeProps(0).characters).toBe(goblins);

            // Rerender with a level-17 playerStats and NEW characters: the payload was snapshotted
            // at selection (still 3d4/DC 15/basePlayerStats by identity) while characters flows live.
            const elves = Object.freeze(['Elf1']);
            rerenderWith({
                characters: elves,
                playerStats: statsWith({ level: 17, class: LEVEL_17_CLASS }),
            });
            const props = aoeProps(1);
            expect(props.characters).toBe(elves);
            expect(props.damage).toBe('3d4');
            expect(props.saveDc).toBe(15);
            expect(props.playerStats).toBe(basePlayerStats);
            // No re-commit: the frozen payload never re-fires the chooser.
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
        });
    });

    describe('phase machine — one synchronous commit, unmount as double-fire guard', () => {
        it('element→aoe lands in ONE act flush: buttons gone, AOE present, processing never observable', () => {
            renderModal();
            chooseType('Fire');
            // fireEvent wraps act: NO waitFor needed — the transition IS synchronous.
            expect(screen.getByTestId('save-attack-aoe-modal')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Fire' })).toBeNull();
            expect(screen.queryByText(/Choose a damage type/)).toBeNull();
            expect(document.querySelector('.sp-overlay')).toBeNull();
            expect(SaveAttackAoeModalMock.default).toHaveBeenCalledTimes(1);
        });

        it('re-clicking a detached button node dispatches nothing (React ignores unmounted targets)', () => {
            renderModal();
            const fireBtn = screen.getByRole('button', { name: 'Fire' });
            fireEvent.click(fireBtn);
            fireEvent.click(fireBtn); // stale node post-unmount
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
            expect(SaveAttackAoeModalMock.default).toHaveBeenCalledTimes(1);
        });

        it('clicking the overlay backdrop and the modal content are both inert — no onClose, chooser intact', () => {
            const { container, onClose } = renderModal();
            fireEvent.click(document.querySelector('.sp-overlay'));
            fireEvent.click(document.querySelector('.sp-modal'));
            expect(onClose).not.toHaveBeenCalled();
            expect(container.querySelector('.sp-modal')).toBeInTheDocument();
            expect(screen.getAllByRole('button')).toHaveLength(6);
        });

        it('Cancel calls onClose ONCE and forwards the raw click event (jsx:97 asymmetry vs handleAoeClose)', () => {
            const { onClose } = renderModal();
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(onClose.mock.calls[0][0].type).toBe('click');
        });

        it('AOE close forwards onClose EXACTLY ONCE with ZERO args (handleAoeClose strips the event, jsx:56-58)', () => {
            const { onClose } = renderModal();
            chooseType('Fire');
            fireEvent.click(screen.getByRole('button', { name: 'Close AOE Modal' }));
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(onClose.mock.calls[0]).toEqual([]);
        });

        it('FLAG pinned: double AOE-close forwards TWICE — no idempotency guard at jsx:56', () => {
            const { onClose } = renderModal();
            chooseType('Fire');
            const closeBtn = screen.getByRole('button', { name: 'Close AOE Modal' });
            fireEvent.click(closeBtn);
            fireEvent.click(closeBtn);
            expect(onClose).toHaveBeenCalledTimes(2);
            expect(SaveAttackAoeModalMock.default).toHaveBeenCalledTimes(1);
        });
    });

    describe('edge cases', () => {
        it('undefined action renders the full chooser safely (header hardcoded) — Cancel still wired', () => {
            // FLAG (probe-verified): CLICKING here strands the modal silently (jsx:32-33 throws
            // after setPhase('processing') at :27; unhandled rejection would fail the run — cannot
            // pin the click). Safe surface only: render + Cancel.
            const { onClose } = renderModal({ action: undefined });
            expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
            expect(screen.getAllByRole('button')).toHaveLength(6);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('an action WITHOUT a name still commits: abilityName undefined, description "undefined:"', () => {
            const nameless = Object.freeze({});
            renderModal({ action: nameless });
            chooseType('Thunder');
            expect(logService.addEntry.mock.calls[0]).toEqual([CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: undefined,
                description: 'undefined: Chose Thunder damage type.',
                timestamp: FROZEN_TS,
            }]);
            expect(aoeProps().action).toBe(nameless);
        });
    });
});
