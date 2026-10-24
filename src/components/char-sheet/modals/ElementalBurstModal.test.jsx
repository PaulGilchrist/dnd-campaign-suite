// @maintained-by-ai
/**
 * ElementalBurstModal — single-file lane (jsx:1-113, the whole modal). No siblings: this is the
 * ONLY lane for ElementalBurst. The modal is a two-phase pass-through: element-type chooser →
 * payload snapshot → SaveAttackAoeModal handoff. Lanes that own the other side of each seam:
 * - SaveAttackAoeModal.* (50+ lanes) — everything INSIDE the AOE modal (saves, damage, targets).
 *   Consumed here ONLY as a captured boundary: exact payload keys, identities, DC, die, phase gate.
 * - elementalBurstHandler.test.js — how the modal is OPENED (modalState wiring). Not here.
 *
 * Owned here (nothing else can show it):
 * - Element-phase exact copy (DC sentence, note sentence, header, five buttons + icons in authored
 *   order), DC math arms (incl. negative-DEX survival and NaN proficiency), martial-arts-die
 *   resolution arms (incl. first-match and falsy-collapse), the synchronous element→aoe commit
 *   (processing phase is UNOBSERVABLE — one act flush, zero stranded frames), the full-identity
 *   payload snapshot (action/playerStats passed to AOE BY IDENTITY, frozen fixtures prove inertness),
 *   live-vs-snapshot split (characters prop is LIVE through rerenders; the payload is frozen),
 *   exact full-line addEntry payloads (byte-exact description + frozen timestamp, synchronous),
 *   Cancel/overlay/close wiring asymmetry (Cancel forwards the click event; AOE close strips args).
 *
 * FLAGS (pinned or probe-verified; product fixes belong to the component, not this lane):
 * - jsx:31 + jsx:26 (PROBE-VERIFIED live 2026-10-17): clicking a damage type with `action`
 *   undefined throws TypeError "Cannot read properties of undefined (reading 'name')" inside the
 *   async handleTypeChoice AFTER setPhase('processing') has committed. Result: SILENT STRAND —
 *   modal renders null (phase 'processing', payload null), Cancel is gone, nothing is logged, the
 *   rejection is unhandled. Pinned as far as safely possible (safe-undefined render, :edge-cases);
 *   the click itself would fail the run at vitest's unhandled-rejection collector. Product fix:
 *   guard `action?.name` or render Cancel during 'processing'.
 * - jsx:64: header hardcodes 'Elemental Burst' even for custom action names — custom names appear
 *   ONLY in the log and payload. Pinned below; harmless but silently drifts from the action label.
 * - jsx:36/67: proficiency is UNGUARDED (`8 + dex + playerStats.proficiency`) — undefined
 *   produces 'DC NaN' in copy AND in payload saveDc. Pinned as actual behavior.
 * - jsx:15: `classLevel?.martial_arts_die || 4` collapses a legitimate 0 to d4 (benign: no d0
 *   exists) and jsx:36 `?.bonus || 0` harmlessly passes -0; negative bonus survives `|| 0`
 *   (−3 stays −3 → DC 8). Both arms pinned.
 * - jsx:55-57: handleAoeClose has NO idempotency guard and strips args (`onClose()` with zero
 *   args) while Cancel (`onClick={onClose}`, jsx:93) forwards the raw click event. Both arms
 *   pinned — the arg asymmetry is real; double-close forwards twice.
 * - jsx:69-85: inline styles (violates the no-inline-styles house rule). Not a test defect;
 *   flagged for the component owner. This lane's render helpers use NO inline styles.
 *
 * Anti-vacuity: fixtures are deep-frozen (mutation attempts throw); payload fields are pinned by
 * IDENTITY (toBe), not by echo — the mock renders call-args, and every value is independently
 * derived in-comment; Date.now frozen to FROZEN_TS so every timestamp in every exact entry is
 * deterministic; exact full-line text everywhere (no objectContaining on owned keys); role-scoped
 * queries; fresh vi.fn onClose per makeProps; afterEach mockReset + re-arm (never clearAllMocks);
 * zero bare setTimeout — the synchronous post-fireEvent assertions ARE the transition proof.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ElementalBurstModal from './ElementalBurstModal.jsx';

// ── Mocks ──

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// Captured boundary: every AOE render is recorded; the payload contract is pinned on call-args,
// its internals are SaveAttackAoeModal's lanes. Zero AOE-internal logic lives in this file.
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

function statsWith(overrides = {}) {
    return Object.freeze({ ...basePlayerStats, ...overrides });
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
    { name: 'Acid', icon: 'fa-leaf', lc: 'acid' },
    { name: 'Cold', icon: 'fa-snowflake', lc: 'cold' },
    { name: 'Fire', icon: 'fa-fire', lc: 'fire' },
    { name: 'Lightning', icon: 'fa-bolt', lc: 'lightning' },
    { name: 'Thunder', icon: 'fa-volume-high', lc: 'thunder' },
];

// ── Setup / teardown ──

beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_TS);
});

// House rule: mockReset + re-arm (never clearAllMocks); AOE stub re-armed; spies restored.
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

        it('is inert on frozen props: choosing Fire forwards the SAME frozen action/playerStats objects', () => {
            renderModal();
            chooseType('Fire');
            const props = aoeProps();
            expect(props.action).toBe(baseAction);
            expect(props.playerStats).toBe(basePlayerStats);
        });
    });

    describe('DC calculation (8 + DEX + proficiency, unguarded proficiency)', () => {
        it.each([
            { dex: 6, proficiency: 4, dc: 18, why: 'DEX 6 + PROF 4' },
            { dex: 4, proficiency: 6, dc: 18, why: 'PROF 6 alone lifts the default' },
            { dex: 0, proficiency: 3, dc: 11, why: 'DEX 0 (|| 0 is a no-op for 0)' },
        ])('DC $dc from $why lands verbatim in the DC sentence', ({ dex, proficiency, dc }) => {
            const { container } = renderModal({
                playerStats: statsWith({
                    proficiency,
                    abilities: Object.freeze([Object.freeze({ name: 'Dexterity', bonus: dex })]),
                }),
            });
            expect(descriptionLine(container)).toBe(dcSentence(dc));
        });

        it.each([
            { abilities: Object.freeze([]), name: 'empty array' },
            { abilities: undefined, name: 'undefined abilities' },
            { abilities: Object.freeze([Object.freeze({ name: 'Strength', bonus: 2 })]), name: 'no Dexterity entry' },
            { abilities: Object.freeze([Object.freeze({ name: 'Dexterity' })]), name: 'Dexterity without bonus' },
        ])('defaults DEX bonus to 0 (DC 11) when abilities is $name', ({ abilities }) => {
            const { container } = renderModal({ playerStats: statsWith({ abilities }) });
            expect(descriptionLine(container)).toBe(dcSentence(11));
        });

        it('a NEGATIVE DEX bonus survives `|| 0` (jsx:36) — DEX -3 yields DC 8, not 11', () => {
            const { container } = renderModal({
                playerStats: statsWith({ abilities: Object.freeze([Object.freeze({ name: 'Dexterity', bonus: -3 })]) }),
            });
            expect(descriptionLine(container)).toBe(dcSentence(8));
        });

        it('proficiency null: 8 + 4 + null = 12 in the exact sentence', () => {
            const { container } = renderModal({ playerStats: statsWith({ proficiency: null }) });
            expect(descriptionLine(container)).toBe(dcSentence(12));
        });

        it('proficiency 0: 8 + 4 + 0 = 12 in the exact sentence', () => {
            const { container } = renderModal({ playerStats: statsWith({ proficiency: 0 }) });
            expect(descriptionLine(container)).toBe(dcSentence(12));
        });

        it('FLAG pinned: undefined proficiency is UNGUARDED (jsx:36) — copy and payload both go NaN', () => {
            const { container } = renderModal({ playerStats: statsWith({ proficiency: undefined }) });
            expect(descriptionLine(container)).toBe(dcSentence('NaN'));
            chooseType('Fire');
            expect(aoeProps().saveDc).toBeNaN();
        });

        it('the computed DC is the numeric saveDc in the AOE payload', () => {
            renderModal({
                playerStats: statsWith({
                    proficiency: 4,
                    abilities: Object.freeze([Object.freeze({ name: 'Dexterity', bonus: 6 })]),
                }),
            });
            chooseType('Fire');
            expect(aoeProps().saveDc).toBe(18);
        });
    });

    describe('martial arts die resolution (jsx:13-16)', () => {
        it.each([
            { level: 5, class: basePlayerStats.class, die: 4, why: 'level-5 entry d4' },
            { level: 17, class: Object.freeze({ class_levels: Object.freeze([Object.freeze({ level: 17, martial_arts_die: 8 })]) }), die: 8, why: 'level-17 entry d8' },
            { level: 99, class: Object.freeze({ class_levels: Object.freeze([]) }), die: 4, why: 'no match → fallback d4' },
            { level: 5, class: undefined, die: 4, why: 'class undefined → ?. chain → d4' },
            { level: 5, class: Object.freeze({}), die: 4, why: 'class_levels undefined → || [] → d4' },
            { level: 5, class: Object.freeze({ class_levels: Object.freeze([Object.freeze({ level: 5, martial_arts_die: 0 })]) }), die: 4, why: 'die 0 collapses through || 4 (no d0 exists)' },
            { level: 5, class: Object.freeze({ class_levels: Object.freeze([Object.freeze({ level: 5, martial_arts_die: 8 }), Object.freeze({ level: 5, martial_arts_die: 4 })]) }), die: 8, why: 'find() takes the FIRST matching level' },
        ])('level $level resolves $die — $why', ({ level, class: cls, die }) => {
            const { container } = renderModal({ playerStats: statsWith({ level, class: cls }) });
            expect(noteLine(container)).toBe(noteSentence(die));
        });

        it('the resolved die reaches the payload as damage 3d8 at level 17', () => {
            renderModal({
                playerStats: statsWith({
                    level: 17,
                    class: Object.freeze({ class_levels: Object.freeze([Object.freeze({ level: 17, martial_arts_die: 8 })]) }),
                }),
            });
            chooseType('Fire');
            expect(aoeProps().damage).toBe('3d8');
        });
    });

    describe('log commit — exact full-line ability_use entries, dispatched synchronously', () => {
        it('clicking Fire calls addEntry ONCE, synchronously, with the byte-exact full entry', () => {
            const campaigns = [];
            logService.addEntry.mockImplementation((c, _e) => { campaigns.push(c); return Promise.resolve(); });
            renderModal();
            chooseType('Fire');
            // NO waitFor: the log call is synchronous inside handleTypeChoice (jsx:28).
            expect(campaigns).toEqual([CAMPAIGN]);
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
            expect(logService.addEntry.mock.calls[0][1]).toEqual({
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: 'Elemental Burst',
                description: 'Elemental Burst: Chose Fire damage type.',
                timestamp: FROZEN_TS,
            });
        });

        it.each(DAMAGE_TYPES)('$name → exact description and lowercased $lc payload', ({ name, lc }) => {
            renderModal();
            chooseType(name);
            expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: 'Elemental Burst',
                description: `Elemental Burst: Chose ${name} damage type.`,
                timestamp: FROZEN_TS,
            });
            expect(aoeProps().damageType).toBe(lc);
        });

        it('a custom campaign name routes verbatim to both the log call and the payload', () => {
            renderModal({ campaignName: 'Frostfall-clone-test' });
            chooseType('Cold');
            expect(logService.addEntry).toHaveBeenCalledWith('Frostfall-clone-test', expect.objectContaining({
                description: 'Elemental Burst: Chose Cold damage type.',
            }));
            expect(aoeProps().campaignName).toBe('Frostfall-clone-test');
        });

        it('a custom action name reaches the log description and stays the SAME object in the payload', () => {
            const custom = Object.freeze({ name: 'Storm Palm Burst' });
            renderModal({ action: custom });
            chooseType('Cold');
            expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: 'Storm Palm Burst',
                description: 'Storm Palm Burst: Chose Cold damage type.',
                timestamp: FROZEN_TS,
            });
            expect(aoeProps().action).toBe(custom);
        });

        it('markup in an action name is passed RAW to the log (this component renders no HTML sink)', async () => {
            const evil = Object.freeze({ name: '<img src=x onerror=alert(1)>' });
            const { container } = renderModal({ action: evil });
            // Header never reflects the action name — hardcoded label (flag above).
            expect(container.querySelector('.sp-header').textContent.trim()).toBe('Elemental Burst');
            chooseType('Fire');
            expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                description: '<img src=x onerror=alert(1)>: Chose Fire damage type.',
            }));
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
            // Commit is synchronous and independent of the log lane (jsx:28 never awaited).
            expect(screen.getByTestId('save-attack-aoe-modal')).toBeInTheDocument();
            expect(aoeProps().damageType).toBe('fire');
            expect(aoeProps().saveDc).toBe(15);
            await vi.waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith('[ElementalBurstModal] Error logging type choice:', err);
            });
            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('AOE payload contract (captured boundary — internals owned by SaveAttackAoeModal lanes)', () => {
        it('first AOE render receives the full exact key set in JSX order', () => {
            renderModal();
            chooseType('Fire');
            expect(Object.keys(aoeProps())).toEqual([
                'action', 'playerStats', 'campaignName', 'shape', 'range',
                'damage', 'damageType', 'saveType', 'saveDc', 'dcSuccess', 'characters', 'onClose',
            ]);
        });

        it('constants ride the payload verbatim: sphere/20/3d4/DEX/half, and identity for action+stats+campaign', () => {
            renderModal();
            chooseType('Fire');
            const props = aoeProps();
            expect(props.shape).toBe('sphere');
            expect(props.range).toBe(20);
            expect(props.damage).toBe('3d4');
            expect(props.saveType).toBe('DEX');
            expect(props.dcSuccess).toBe('half');
            expect(props.action).toBe(baseAction);
            expect(props.playerStats).toBe(basePlayerStats);
            expect(props.campaignName).toBe(CAMPAIGN);
            // typeof-only onClose pin cut (#245 sharpen): behavior-owned at
            // 'AOE close forwards onClose EXACTLY ONCE with ZERO args' below —
            // that test clicks the mock's onClick={onClose} wire and asserts the
            // parent's fresh onClose fires (undefined prop would inert-fire and fail it).
        });

        it('characters defaults to null when the parent omits the prop', () => {
            renderModal();
            chooseType('Fire');
            expect(aoeProps().characters).toBeNull();
            expect(screen.getByTestId('aoe-characters')).toHaveTextContent('null');
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
                playerStats: statsWith({ level: 17, class: Object.freeze({ class_levels: Object.freeze([Object.freeze({ level: 17, martial_arts_die: 8 })]) }) }),
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

        it('a second click on the same type is structurally impossible (unmounted) — exactly one log, one AOE', () => {
            renderModal();
            chooseType('Fire');
            expect(screen.queryByRole('button', { name: 'Cold' })).toBeNull();
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
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

        it('overlay-background click is inert — no onClose, full chooser intact', () => {
            const { container, onClose } = renderModal();
            fireEvent.click(document.querySelector('.sp-overlay'));
            expect(onClose).not.toHaveBeenCalled();
            expect(container.querySelector('.sp-modal')).toBeInTheDocument();
            expect(screen.getAllByRole('button')).toHaveLength(6);
        });

        it('modal-content click is inert — no onClose', () => {
            const { onClose } = renderModal();
            fireEvent.click(document.querySelector('.sp-modal'));
            expect(onClose).not.toHaveBeenCalled();
        });

        it('Cancel calls onClose ONCE and forwards the raw click event (jsx:93 asymmetry vs handleAoeClose)', () => {
            const { onClose } = renderModal();
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(onClose.mock.calls[0][0].type).toBe('click');
        });

        it('AOE close forwards onClose EXACTLY ONCE with ZERO args (handleAoeClose strips the event, jsx:55-57)', () => {
            const { onClose } = renderModal();
            chooseType('Fire');
            fireEvent.click(screen.getByRole('button', { name: 'Close AOE Modal' }));
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(onClose.mock.calls[0]).toEqual([]);
        });

        it('FLAG pinned: double AOE-close forwards TWICE — no idempotency guard at jsx:55', () => {
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
            // FLAG (probe-verified): CLICKING here strands the modal silently (jsx:31 throws after
            // setPhase('processing'); unhandled rejection would fail the run — cannot pin the click).
            // Safe surface only: render + Cancel.
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
            expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: undefined,
                description: 'undefined: Chose Thunder damage type.',
                timestamp: FROZEN_TS,
            });
            expect(aoeProps().action).toBe(nameless);
        });
    });
});
