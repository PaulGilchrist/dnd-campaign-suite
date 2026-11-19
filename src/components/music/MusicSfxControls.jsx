// @maintained-by-ai
// Roadmap Item 10 (sensory cues): per-client "sound effects" ON/OFF + volume,
// living in the Music view's control row — the app's one existing audio
// settings affordance, reachable by GM and LAN visitors alike (the Music view
// is delegable/player-open, unlike the GM-only Admin view where the theme
// toggle sits). Settings are localStorage UI prefs (theme/initiative-tv
// idiom, NEVER the runtime store): the cue lane in services/ui/audioCues.js
// reads them directly, so no campaign data is involved and other tabs are
// deliberately untouched — sound is per-seat, unlike the shared ambience
// volume beside it. Flipping ON previews the cue lane (the click itself is
// the browser's unlock gesture, so the preview is honest, not guaranteed
// silent-play).

import { useState } from 'react';
import {
    isSfxEnabled, setSfxEnabled,
    getSfxVolume, setSfxVolume,
    playCue,
} from '../../services/ui/audioCues.js';

export default function MusicSfxControls() {
    const [enabled, setEnabled] = useState(isSfxEnabled);
    const [volume, setVolume] = useState(() => Math.round(getSfxVolume() * 100));

    const toggle = () => {
        const next = !enabled;
        setSfxEnabled(next);
        setEnabled(next);
        if (next) playCue('hit');
    };

    const handleVolume = (event) => {
        const percent = Number(event.target.value);
        setVolume(percent);
        setSfxVolume(percent / 100);
    };

    return (
        <>
            <button
                className="music-btn"
                onClick={toggle}
                aria-pressed={enabled}
                title={enabled ? 'Mute sound effects' : 'Enable sound effects'}
                aria-label="Sound effects"
            >
                <i className={`fa-solid ${enabled ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
            </button>
            <input
                className="music-volume"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolume}
                title="Sound effects volume"
                aria-label="Sound effects volume"
            />
        </>
    );
}
