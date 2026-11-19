// @maintained-by-ai
// Roadmap Item 10 (sensory cues): hex-map weather ambience. One short
// seamless wind-bed WAV looping while (and only while) an overlay-bearing
// weather state is mounted in view — the exact visibility law
// WeatherOverlay already applies (clear/unknown paints no overlay, so it
// plays no sound; `hasWeatherOverlay` is the shared source of truth).
//
// Lifecycle is pure mount/prop-driven: start when active weather lands (GM
// roll or SSE echo), stop the instant weather clears/changes to a
// non-overlay condition, and stop on unmount (view navigation, campaign
// leave). Instant start/stop — no clock-based fades (AGENTS No Game Timers;
// Audio.loop itself is a browser media API, not a scheduled callback).
// Mixing under the YouTube ambience lane is un-ducked by design.

import { useEffect } from 'react';
import { startLoop, stopLoop } from '../../services/ui/audioCues.js';
import { hasWeatherOverlay } from './weatherConditions.js';

const AMBIENCE_KEY = 'weather';

export default function WeatherAmbience({ weather }) {
    const active = hasWeatherOverlay(weather?.condition);

    useEffect(() => {
        if (!active) return undefined;
        startLoop(AMBIENCE_KEY);
        return () => stopLoop(AMBIENCE_KEY);
    }, [active]);

    return null;
}
