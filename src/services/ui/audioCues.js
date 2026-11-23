// @maintained-by-ai
// Roadmap Item 10 (sensory cues): the one audio playback lane for short
// combat/celebration WAV cues and the hex-map weather ambience loop. The
// assets are locally-served files in public/audio/ (owner ruling 2026-11-19),
// generated deterministically by scripts/generate-audio-cues.mjs.
//
// Per-client UI settings law (AGENTS "stays local"): ON/OFF + volume are
// display preferences exactly like `theme`/`initiative-tv` — localStorage,
// NEVER the runtime store. Cue playback itself is triggered only at
// presentation seams that already exist (HpFeedback floater, the shared SSE
// log lane, the level-up banner, mounted hex weather); nothing here runs a
// timer — Audio.loop and element .play()/.pause() are browser media APIs,
// not scheduled game logic.
//
// Unlock model: browsers refuse media playback until the user has interacted
// with the page. The service settles `unlocked` two ways: a one-time// `pointerdown` listener armed EAGERLY at module load, and — because SPA
// lazy-loading can make the module EVALUATE after the session's clicks — a
// `navigator.userActivation.hasBeenActive` check on every attempt. A cue
// attempted while still locked fails SILENTLY — no throw, no console noise,
// and one-shots are DISCARDED, never queued (unlock must never blast
// stored-up events). The one honest exception is a LOOP: a startLoop wanted
// while locked is remembered as the CURRENT desired bed and started when the
// unlock lands — the bed reflects live truth (weather is still blowing), not
// a stale event. stopLoop clears the pending want; a different key
// overwrites it.
//
// Machine-gun guard: ONE pooled HTMLAudioElement per cue key. Re-firing the
// same cue restarts that single element (currentTime reset), so a burst of
// identical events in one batch collapses into one audible hit — the
// same-key floor, complemented per ROW by alreadyCued below (the SSE log lane's
// duplicate-delivery guard). No wall-clock throttle anywhere.

import { isSoundOwnerHere } from './soundOwner.js';

// cue key → served URL. public/ is served statically in dev (express + Vite)
// and copied into dist/ by the build, so these paths resolve in both modes.
// The co-located test censuses that every file exists on disk.
export const CUE_URLS = {
    hit: '/audio/hit.wav',
    crit: '/audio/crit.wav',
    miss: '/audio/miss.wav',
    fumble: '/audio/fumble.wav',
    heal: '/audio/heal.wav',
    levelup: '/audio/levelup.wav',
    'save-success': '/audio/save-success.wav',
    'save-failure': '/audio/save-failure.wav',
    'monster-death': '/audio/monster-death.wav',
    'player-down': '/audio/player-down.wav',
    'player-death': '/audio/player-death.wav',
    weather: '/audio/weather-wind.wav',
};

// localStorage pref slots (per-client UI settings, theme-toggle idiom).
// Default ON: nothing can sound before the user's own first pointerdown
// anyway (unlock model above), and cues are short and quiet by design.
const ENABLED_KEY = 'sfx-enabled';
const VOLUME_KEY = 'sfx-volume';
export const DEFAULT_SFX_VOLUME = 0.6;

export function isSfxEnabled() {
    try { return localStorage.getItem(ENABLED_KEY) !== '0'; } catch { return true; }
}

export function setSfxEnabled(on) {
    try { localStorage.setItem(ENABLED_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

export function getSfxVolume() {
    try {
        const raw = localStorage.getItem(VOLUME_KEY);
        if (raw === null) return DEFAULT_SFX_VOLUME; // Number(null) is 0 — absent means default
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : DEFAULT_SFX_VOLUME;
    } catch { return DEFAULT_SFX_VOLUME; }
}

/** Persist the per-client volume AND re-apply it to every live element, so a
 *  looping bed (weather) responds immediately, not on its next start. */
export function setSfxVolume(volume) {
    const clamped = Math.min(1, Math.max(0, Number(volume) || 0));
    try { localStorage.setItem(VOLUME_KEY, String(clamped)); } catch { /* ignore */ }
    for (const el of pool.values()) el.volume = clamped;
}

// ── One-time gesture unlock ──
let unlocked = false;
let unlockListener = null;
let pendingLoop = null; // loop key wanted while still locked (see header)

function unlockOnFirstGesture() {
    if (unlockListener || typeof document === 'undefined') return;
    unlockListener = () => {
        unlocked = true;
        consumePendingLoop();
    };
    document.addEventListener('pointerdown', unlockListener, { once: true });
}

function consumePendingLoop() {
    if (pendingLoop !== null && isSfxEnabled()) {
        const key = pendingLoop;
        pendingLoop = null;
        startLoop(key);
    }
}

// The browser's own activation truth: this session has ALREADY seen user
// interaction (SPA module-load lags the clicks that revealed the view — the
// eager listener would arm too late to ever see one). Where the API exists,
// it settles `unlocked` at every attempt without waiting for a next gesture.
function refreshUnlock() {
    if (unlocked) return;
    try {
        if (navigator.userActivation && navigator.userActivation.hasBeenActive) {
            unlocked = true;
            consumePendingLoop();
        }
    } catch { /* older engines: listener path remains the only route */ }
}

// Eager arm: unlocks on the user's first gesture of the session — long
// before any cue seam could otherwise fire.
unlockOnFirstGesture();

/** Test seam (resetSSEClient precedent): drop the pooled elements, the
 *  unlock listener, its flag and the cued-row id set so suites start from a
 *  cold audio module. */
export function resetAudioCues() {
    for (const el of pool.values()) el.pause();
    pool.clear();
    cuedRowIds.clear();
    if (unlockListener) document.removeEventListener('pointerdown', unlockListener);
    unlockListener = null;
    unlocked = false;
    pendingLoop = null;
    unlockOnFirstGesture(); // cold module state = eagerly armed, mirror load
}

// ── Element pool (one instance per cue key) ──
const pool = new Map();

function obtain(key) {
    if (!pool.has(key)) {
        const el = new Audio(CUE_URLS[key]);
        el.volume = getSfxVolume();
        pool.set(key, el);
    }
    return pool.get(key);
}

// Playback gate shared by every entry point: unknown key is a programming
// error (loud), locked/disabled/audio-less is a silent honest no-op. The
// Sound Owner law (Phase 5, soundOwner.js) joins it: the table has ONE set of
// speakers — a non-owner tab returns silently even with its own SFX toggle
// on (the toggle now governs the owner screen loudness, not per-seat play).
function gate(key) {
    if (!CUE_URLS[key]) {
        console.error(`[audioCues] unknown cue "${key}"`);
        return false;
    }
    if (!isSfxEnabled()) return false;
    if (!isSoundOwnerHere()) return false;
    refreshUnlock();
    if (!unlocked) {
        unlockOnFirstGesture();
        return false;
    }
    if (typeof Audio === 'undefined') return false;
    return true;
}

function attemptPlay(el) {
    const result = el.play();
    // jsdom/unlocked-but-refused playback honesty: play() may reject — a cue
    // that cannot sound fails silently, it never throws into a render seam.
    if (result && typeof result.catch === 'function') result.catch(() => {});
}

/** Fire a one-shot cue. Re-firing the SAME cue while it plays restarts the
 *  single pooled element (natural same-frame dedupe, see header). */
export function playCue(key) {
    if (!gate(key)) return;
    const el = obtain(key);
    el.loop = false;
    el.pause();
    el.currentTime = 0;
    attemptPlay(el);
}

/** Start a looping bed (weather ambience). Already-playing loops are left
 *  untouched — starting is idempotent, there is no clock-based fade. While
 *  still gesture-locked the wanted key is remembered (CURRENT truth, not an
 *  event) and started at unlock; see the unlock model in the header. */
export function startLoop(key) {
    if (!CUE_URLS[key]) {
        console.error(`[audioCues] unknown cue "${key}"`);
        return;
    }
    if (!isSfxEnabled() || typeof Audio === 'undefined') return;
    if (!isSoundOwnerHere()) return;
    refreshUnlock();
    if (!unlocked) {
        pendingLoop = key;
        unlockOnFirstGesture();
        return;
    }
    pendingLoop = null;
    const el = obtain(key);
    el.loop = true;
    if (el.paused) attemptPlay(el);
}

/** Stop a looping bed immediately (instant stop, simplest honest thing).
 *  Also drops a not-yet-unlocked pending want, so a bed the user already
 *  left can never start late. */
export function stopLoop(key) {
    if (pendingLoop === key) pendingLoop = null;
    const el = pool.get(key);
    if (!el) return;
    el.pause();
    el.loop = false;
    el.currentTime = 0;
}

// roll-entry branch of the decoder: attack outcomes + raw save results.
function cueForRollEntry(entry) {
    if (entry.rollType === 'attack') {
        if (entry.isNatural1) return 'fumble';
        if (entry.isCrit) return 'crit';
        if (entry.hit === true) return 'hit';
        if (entry.hit === false) return 'miss';
        return null;
    }
    if (entry.rollType === 'save' && entry.name !== 'Concentration Save') {
        if (entry.saveResult === 'success') return 'save-success';
        if (entry.saveResult === 'failure') return 'save-failure';
    }
    return null;
}

// ── Per-row idempotence for the SSE log cue lane (improve 2026-11-21) ──
// A duplicate delivery of the same log row — an SSE resend after a brief
// drop, or a CombatCues remount replaying the newest append — must never
// re-voice a moment. Every row the lane cues is remembered by its server-
// stamped GUID `id` (log.js addEntry stamps one on EVERY append) and later
// deliveries of that id stay silent. The set lives at MODULE level, like the
// element pool above, so the guard survives component remounts; only a page
// reload empties it, and there the cue lane's no-initial-GET mount law means
// history never retro-cues anyway. Bounded FIFO: Sets iterate insertion order,
// so the oldest cued id evicts first; the cap comfortably outlives the shared
// lane's traffic (the server log caps at 500 rows).
const MAX_CUED_ROW_IDS = 200;
const cuedRowIds = new Set();

/** Record that log row `id` has been through the cue lane. Returns TRUE when
 *  the id was already recorded — the caller must then stay silent. */
export function alreadyCued(id) {
    if (cuedRowIds.has(id)) return true;
    cuedRowIds.add(id);
    if (cuedRowIds.size > MAX_CUED_ROW_IDS) {
        cuedRowIds.delete(cuedRowIds.values().next().value);
    }
    return false;
}

/**
 * Decode one already-synced log entry into a cue key, or null for "stay
 * silent". Pure twin of the outcome badges the log/TV panel already render
 * (RollAttackBadges/RollModeBadges read the same flags):
 *
 * - attack rolls: natural-1 fumbles outrank everything, then crits, then
 *   plain hit/miss. Damage/initiative rolls produce nothing — damage's HP
 *   movement gets its audio twin at the floater seam instead (HpFeedback),
 *   so no moment is ever double-voiced.
 * - saving-throw rolls (saveResult 'success'/'failure'): the one moment no
 *   other lane voices (failed-save damage is silent here, successful saves
 *   have no floater). Concentration saves are EXCLUDED — they re-voice every
 *   hit taken and would machine-gun the table. Special outcomes (e.g.
 *   'soulstitch_auto_success') are not raw save results: they stay silent.
 * - hp_change stamped threshold 'dead': a monster falls silent forever
 *   ('monster-death'); a player at 0 HP is DYING, not dead (5e), so the
 *   softer 'player-down' sounds — the entry's isPlayer stamp written by the
 *   damage/GM-override lanes is what tells them apart.
 * - death_save result 'dead' (the fatal third failure): the true player
 *   death — the serious 'player-death' knell. Rolls/stabilize/clear stay
 *   silent; the table already hears the dice.
 */
export function cueForLogEntry(entry) {
    if (!entry) return null;
    if (entry.type === 'roll') return cueForRollEntry(entry);
    if (entry.type === 'hp_change' && entry.threshold === 'dead') {
        return entry.isPlayer ? 'player-down' : 'monster-death';
    }
    if (entry.type === 'death_save' && entry.result === 'dead') return 'player-death';
    return null;
}
