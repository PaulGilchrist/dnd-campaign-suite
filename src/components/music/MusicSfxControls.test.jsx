// @maintained-by-ai
// Roadmap Item 10 (sensory cues) — the per-client SFX settings widget on the
// Music control row. Runs against the REAL audioCues service + the global
// Audio mock (setup.js): the widget's contract is the localStorage pref bytes
// it writes, its pressed/icon face, and the honest preview law (flipping ON
// after the user's own gesture audibly plays the hit cue; a locked browser
// stays silent by the service's unlock gate — tested there).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MusicSfxControls from './MusicSfxControls.jsx';
import { DEFAULT_SFX_VOLUME, resetAudioCues } from '../../services/ui/audioCues.js';

const MockAudio = globalThis.Audio;
const unlock = () => document.dispatchEvent(new Event('pointerdown'));

const toggleBtn = () => screen.getByRole('button', { name: 'Sound effects' });
const slider = () => screen.getByRole('slider', { name: 'Sound effects volume' });

beforeEach(() => {
    resetAudioCues();
    MockAudio.instances.length = 0;
    localStorage.clear();
    render(<MusicSfxControls />);
});

describe('MusicSfxControls', () => {
    it('defaults to ON (pressed face, loud icon) with the authored default volume', () => {
        expect(toggleBtn()).toHaveAttribute('aria-pressed', 'true');
        expect(toggleBtn().querySelector('i')).toHaveClass('fa-volume-high');
        expect(slider()).toHaveValue(String(Math.round(DEFAULT_SFX_VOLUME * 100)));
    });

    it('muting persists sfx-enabled=0 and drops to the crossed-out icon', () => {
        fireEvent.click(toggleBtn());
        expect(localStorage.getItem('sfx-enabled')).toBe('0');
        expect(toggleBtn()).toHaveAttribute('aria-pressed', 'false');
        expect(toggleBtn().querySelector('i')).toHaveClass('fa-volume-xmark');
    });

    it('flipping back ON restores the pref and previews the cue lane (post-gesture)', () => {
        fireEvent.click(toggleBtn()); // OFF — never cues
        fireEvent.click(toggleBtn()); // ON — preview attempt while still locked: arms the gesture listener silently
        unlock(); // the user's own first interaction
        expect(MockAudio.instances).toHaveLength(0); // nothing queued — honest silence
        fireEvent.click(toggleBtn()); // OFF again
        fireEvent.click(toggleBtn()); // ON → the preview is audible now
        const played = MockAudio.instances.filter(el => el.src === '/audio/hit.wav');
        expect(played).toHaveLength(1);
        expect(played[0].play).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('sfx-enabled')).toBe('1');
    });

    it('the slider writes the per-client volume pref (and never the shared store)', () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        fireEvent.change(slider(), { target: { value: '35' } });
        expect(localStorage.getItem('sfx-volume')).toBe('0.35');
        expect(slider()).toHaveValue('35');
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});
