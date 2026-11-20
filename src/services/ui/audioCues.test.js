// @maintained-by-ai
// Roadmap Item 10 (sensory cues) — the audio playback lane contract.
// Lanes: the asset census (every referenced WAV exists on disk with an honest
// length), the gesture-unlock gate (locked → SILENT no-throw, nothing
// queued), the per-client localStorage prefs (enabled default ON, volume
// clamped + live-applied), the single-element pool (same-cue restart = the
// only machine-gun dedupe), the weather loop lifecycle, and the pure
// log-entry → cue decoder. The Audio element mock is the global one from
// src/test/setup.js (Audio.instances census); resetAudioCues gives every test
// a cold module.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    CUE_URLS, DEFAULT_SFX_VOLUME,
    isSfxEnabled, setSfxEnabled,
    getSfxVolume, setSfxVolume,
    playCue, startLoop, stopLoop,
    cueForLogEntry,
    resetAudioCues,
} from './audioCues.js';

const MockAudio = globalThis.Audio;

// Simulate the user's own first interaction (the browser-unlock gesture).
// The one-time pointerdown listener is armed EAGERLY (module load), so a
// bare gesture suffices; the silent pre-gesture playCue keeps the helper
// honest to its old shape and the census clear gives a clean per-test count.
const unlock = () => {
    playCue('hit');
    document.dispatchEvent(new Event('pointerdown'));
    MockAudio.instances.length = 0;
};

const elements = () => MockAudio.instances;

const attack = (overrides = {}) => ({
    type: 'roll', rollType: 'attack', characterName: 'Alice', name: 'Longsword',
    hit: true, ...overrides,
});

beforeEach(() => {
    resetAudioCues();
    MockAudio.instances.length = 0;
    localStorage.clear();
});

afterEach(() => {
    resetAudioCues();
    vi.restoreAllMocks();
});

describe('asset census', () => {
    it('every cue URL resolves to a real file in public/audio/', () => {
        const keys = Object.keys(CUE_URLS);
        expect(keys.length).toBeGreaterThanOrEqual(12);
        for (const key of keys) {
            const file = join(process.cwd(), 'public', CUE_URLS[key].slice(1));
            expect(existsSync(file), `${key} → ${CUE_URLS[key]} must exist on disk`).toBe(true);
        }
    });

    it('one-shots are ≤1 s (ceremonial cues ≤1.5 s) and the weather bed is a 4–7 s loop (16-bit mono PCM header)', () => {
        const ceremonial = new Set(['levelup', 'player-death']);
        for (const [key, url] of Object.entries(CUE_URLS)) {
            const wav = readFileSync(join(process.cwd(), 'public', url.slice(1)));
            expect(wav.subarray(0, 4).toString()).toBe('RIFF');
            expect(wav.readUInt16LE(22), `${key} is mono`).toBe(1);
            const rate = wav.readUInt32LE(24);
            const seconds = wav.readUInt32LE(40) / (rate * 2);
            if (key === 'weather') {
                expect(seconds, 'weather loop length').toBeGreaterThanOrEqual(4);
                expect(seconds).toBeLessThanOrEqual(7);
            } else if (ceremonial.has(key)) {
                expect(seconds, `${key} ceremonial length`).toBeLessThanOrEqual(1.5);
            } else {
                expect(seconds, `${key} length`).toBeLessThanOrEqual(1);
            }
        }
    });
});

describe('cue map / decoder', () => {
    it('maps every documented cue key to its /audio/ URL', () => {
        expect(CUE_URLS).toMatchObject({
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
        });
    });

    it('decode table: attack entries resolve fumble > crit > hit > miss', () => {
        expect(cueForLogEntry(attack({ isNatural1: true, hit: false }))).toBe('fumble');
        expect(cueForLogEntry(attack({ isCrit: true, isNatural20: true }))).toBe('crit');
        expect(cueForLogEntry(attack())).toBe('hit');
        expect(cueForLogEntry(attack({ hit: false }))).toBe('miss');
        expect(cueForLogEntry(attack({ hit: false, isAutoMiss: true }))).toBe('miss');
    });

    it('decode: raw save results cue success/failure; special outcomes stay silent', () => {
        expect(cueForLogEntry({ type: 'roll', rollType: 'save', saveResult: 'success' })).toBe('save-success');
        expect(cueForLogEntry({ type: 'roll', rollType: 'save', saveResult: 'failure' })).toBe('save-failure');
        // Special (non-raw) outcomes are not the table's save moment — silent.
        expect(cueForLogEntry({ type: 'roll', rollType: 'save', saveResult: 'soulstitch_auto_success' })).toBeNull();
        expect(cueForLogEntry({ type: 'roll', rollType: 'save', saveResult: { success: true } })).toBeNull();
        expect(cueForLogEntry({ type: 'roll', rollType: 'save' })).toBeNull();
        // Concentration saves re-voice every hit taken — never a second cue.
        expect(cueForLogEntry({ type: 'roll', rollType: 'save', name: 'Concentration Save', saveResult: 'success' })).toBeNull();
        // End-of-turn condition repeats (rollType 'condition-save', boolean
        // success) fire every round per effect — machine-gun, stay silent.
        expect(cueForLogEntry({ type: 'roll', rollType: 'condition-save', success: true })).toBeNull();
    });

    it('decode: dead-threshold HP changes cue monster-death vs player-down', () => {
        expect(cueForLogEntry({ type: 'hp_change', threshold: 'dead', targetName: 'Goblin' })).toBe('monster-death');
        expect(cueForLogEntry({ type: 'hp_change', threshold: 'dead', targetName: 'Thorin', isPlayer: true })).toBe('player-down');
        // No dead threshold (plain damage, bloodied, heals) stays silent —
        // the floater/heal lane already voices HP movement.
        expect(cueForLogEntry({ type: 'hp_change', threshold: 'bloodied' })).toBeNull();
        expect(cueForLogEntry({ type: 'hp_change', delta: -5 })).toBeNull();
        expect(cueForLogEntry({ type: 'hp_change', delta: 5, isHealing: true })).toBeNull();
    });

    it('decode: the fatal third death save cues player-death; other tracks silent', () => {
        expect(cueForLogEntry({ type: 'death_save', characterName: 'Thorin', result: 'dead' })).toBe('player-death');
        expect(cueForLogEntry({ type: 'death_save', characterName: 'Thorin', result: 'stable' })).toBeNull();
        expect(cueForLogEntry({ type: 'death_save', characterName: 'Thorin', result: 'removed' })).toBeNull();
        // Plain death-save rolls (success boolean, no terminal result) silent.
        expect(cueForLogEntry({ type: 'death_save', success: false, totalFailures: 2 })).toBeNull();
    });

    it('decode: anything that is not a voiced moment stays silent (no double-voice)', () => {
        expect(cueForLogEntry(attack({ hit: undefined }))).toBeNull();
        expect(cueForLogEntry({ type: 'roll', rollType: 'damage', hit: true, isCrit: true })).toBeNull();
        expect(cueForLogEntry({ type: 'roll', rollType: 'initiative' })).toBeNull();
        expect(cueForLogEntry({ type: 'note' })).toBeNull();
        expect(cueForLogEntry(null)).toBeNull();
    });
});

describe('gesture unlock gate', () => {
    it('before any user gesture the cue fails SILENTLY — no element, no throw, nothing queued', () => {
        expect(() => playCue('hit')).not.toThrow();
        expect(elements()).toHaveLength(0);

        // The gesture lands…
        unlock();
        // …and NOTHING stored-up blasts on unlock: the pre-gesture attempt is
        // gone, only a fresh attempt after the gesture plays.
        expect(elements()).toHaveLength(0);
        playCue('hit');
        expect(elements()).toHaveLength(1);
    });

    it('unknown cue key is a loud programming error but never throws', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        unlock();
        expect(() => playCue('nope')).not.toThrow();
        expect(error).toHaveBeenCalledWith('[audioCues] unknown cue "nope"');
        expect(elements()).toHaveLength(0);
    });

    it('a rejected play() (browser refusal) is swallowed, never thrown', () => {
        unlock();
        playCue('hit');
        const el = elements()[0];
        el.play.mockImplementationOnce(() => Promise.reject(new DOMException('blocked')));
        expect(() => playCue('hit')).not.toThrow();
    });

    it('navigator.userActivation settles the gate without a listener-visible gesture (SPA lazy-load lag)', () => {
        // The module can EVALUATE after the session's clicks (view-split
        // lazy load). The browser's own activation truth must then unlock
        // immediately — no queued one-shots, but the current bed plays.
        Object.defineProperty(navigator, 'userActivation', {
            value: { hasBeenActive: true }, configurable: true,
        });
        try {
            playCue('hit');
            expect(elements()[0].src).toContain('/audio/hit.wav');
            startLoop('weather');
            expect(elements()[1].src).toContain('/audio/weather-wind.wav');
            expect(elements()[1].loop).toBe(true);
        } finally {
            delete navigator.userActivation;
        }
    });
});

describe('per-client prefs (localStorage UI lanes)', () => {
    it('sound effects default ON and persist through the sfx-enabled key', () => {
        expect(isSfxEnabled()).toBe(true);
        setSfxEnabled(false);
        expect(localStorage.getItem('sfx-enabled')).toBe('0');
        expect(isSfxEnabled()).toBe(false);
        setSfxEnabled(true);
        expect(localStorage.getItem('sfx-enabled')).toBe('1');
    });

    it('OFF mutes even after the unlock gesture', () => {
        unlock();
        setSfxEnabled(false);
        playCue('crit');
        expect(elements()).toHaveLength(0);
    });

    it('volume persists clamped 0–1, defaults to the authored default', () => {
        expect(getSfxVolume()).toBe(DEFAULT_SFX_VOLUME);
        setSfxVolume(0.35);
        expect(localStorage.getItem('sfx-volume')).toBe('0.35');
        expect(getSfxVolume()).toBe(0.35);
        setSfxVolume(5);
        expect(getSfxVolume()).toBe(1);
        setSfxVolume(-2);
        expect(getSfxVolume()).toBe(0);
    });

    it('a live loop hears a volume change immediately', () => {
        unlock();
        startLoop('weather');
        const el = elements()[0];
        expect(el.volume).toBe(DEFAULT_SFX_VOLUME);
        setSfxVolume(0.2);
        expect(el.volume).toBe(0.2);
    });
});

describe('playback pool', () => {
    it('one element per cue key; a repeated cue RESTARTS it (the same-batch dedupe)', () => {
        unlock();
        playCue('hit');
        playCue('hit');
        playCue('hit');
        expect(elements()).toHaveLength(1);
        const el = elements()[0];
        expect(el.src).toContain('/audio/hit.wav');
        expect(el.play).toHaveBeenCalledTimes(3);
        expect(el.pause).toHaveBeenCalledTimes(3); // each fire restarts the single element
    });

    it('distinct cues keep distinct elements (audibly layerable)', () => {
        unlock();
        playCue('hit');
        playCue('crit');
        expect(elements()).toHaveLength(2);
    });
});

describe('weather loop lifecycle', () => {
    it('starts once, is idempotent while running, stops instantly', () => {
        unlock();
        startLoop('weather');
        startLoop('weather');
        const el = elements()[0];
        expect(el.loop).toBe(true);
        expect(el.play).toHaveBeenCalledTimes(1);

        stopLoop('weather');
        expect(el.pause).toHaveBeenCalledTimes(1);
        expect(el.loop).toBe(false);
        expect(el.currentTime).toBe(0);

        // Re-arm after clear → plays again on the same pooled element.
        startLoop('weather');
        expect(elements()).toHaveLength(1);
        expect(el.play).toHaveBeenCalledTimes(2);
    });

    it('locked: no element yet; the unlock gesture starts the wanted bed (current-truth law)', () => {
        startLoop('weather');
        expect(elements()).toHaveLength(0); // silent while locked…
        document.dispatchEvent(new Event('pointerdown'));
        const el = elements()[0]; // …but the CURRENT bed starts at unlock, not a stale blast
        expect(el).toBeDefined();
        expect(el.src).toContain('/audio/weather-wind.wav');
        expect(el.loop).toBe(true);
    });

    it('stopLoop while locked cancels the pending want — no late start on unlock', () => {
        startLoop('weather');
        stopLoop('weather');
        document.dispatchEvent(new Event('pointerdown'));
        expect(elements()).toHaveLength(0);
    });

    it('a newer wanted bed overwrites the pending one', () => {
        startLoop('weather'); // only loopable bed key exists, but a second want replaces the first
        startLoop('weather');
        document.dispatchEvent(new Event('pointerdown'));
        expect(elements().filter(el => el.loop)).toHaveLength(1);
    });

    it('muted: the loop never starts, not even on unlock', () => {
        setSfxEnabled(false);
        startLoop('weather');
        document.dispatchEvent(new Event('pointerdown'));
        expect(elements()).toHaveLength(0);
    });

    it('one-shots wanted while locked are DISCARDED, never blasted on unlock', () => {
        playCue('hit');
        document.dispatchEvent(new Event('pointerdown'));
        expect(elements()).toHaveLength(0);
    });

    it('stopLoop for a cue that never started is inert', () => {
        expect(() => stopLoop('weather')).not.toThrow();
    });
});
