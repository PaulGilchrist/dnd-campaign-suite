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
// with the page. The service settles `unlocked` two ways: a one-time
// `pointerdown` listener armed EAGERLY at module load, and — because SPA
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
// identical events in one batch collapses into one audible hit — the only
// dedupe mechanism, no wall-clock throttle anywhere.

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
 *  unlock listener and its flag so suites start from a cold audio module. */
export function resetAudioCues() {
    for (const el of pool.values()) el.pause();
    pool.clear();
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
// error (loud), locked/disabled/audio-less is a silent honest no-op.
function gate(key) {
    if (!CUE_URLS[key]) {
        console.error(`[audioCues] unknown cue "${key}"`);
        return false;
    }
    if (!isSfxEnabled()) return false;
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

/**
 * Decode one already-synced log entry into a combat cue key, or null for
 * "stay silent". Pure twin of the attack-outcome badges the log/TV panel
 * already render (RollAttackBadges/RollModeBadges read the same flags):
 * natural-1 fumbles outrank everything, then crits, then plain hit/miss.
 * Damage/save/initiative entries deliberately produce nothing — their HP
 * movement gets its audio twin at the floater seam instead (HpFeedback),
 * so no moment is ever double-voiced.
 */
export function cueForRollEntry(entry) {
    if (!entry || entry.type !== 'roll' || entry.rollType !== 'attack') return null;
    if (entry.isNatural1) return 'fumble';
    if (entry.isCrit) return 'crit';
    if (entry.hit === true) return 'hit';
    if (entry.hit === false) return 'miss';
    return null;
}
