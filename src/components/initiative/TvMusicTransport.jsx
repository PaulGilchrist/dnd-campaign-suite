// @maintained-by-ai
// TV-mode music transport (improve 2026-11-08 EM backlog): while the
// full-screen tracker is up, ambience previously had ZERO affordance on the
// TV screen (MusicPlayer lives in the hidden view outlet), so Pause/Stop
// meant exiting TV. This minimal header transport renders only while a mood
// is armed: Pause (when playing) + Stop, or a chip-only mood indicator for
// read-only LAN visitors (isLocalhost follows the HOSTNAME, .music-remote-note
// pattern). It drives the SAME lanes the sidebar uses — the shared commit/
// log bytes from musicTransport.js over the top-level `music` change-data key
// — and commands audio through MusicPlayer's existing remote-adoption lane
// (every transport transition this component did not itself commit drives
// the owner window's YouTube frame via the store/SSE echo). It never mounts
// a second frame, so the EM-proven TV↔playback persistence is untouched.

import React from 'react';
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js';
import useLog from '../../hooks/runtime/useLog.js';
import { buildMoodList, DEFAULT_CUSTOM_ICON } from '../../services/ui/musicConfig.js';
import { DEFAULT_MUSIC, normalizeMusic, pauseCommit, pauseLogEntry, stopCommit, stopLogEntry } from '../../services/ui/musicTransport.js';

function useActiveMood(music) {
  return React.useMemo(() => {
    if (!music.mood) return null;
    const entry = buildMoodList(music.customCategories).find(m => m.key === music.mood);
    return {
      key: music.mood,
      label: entry ? entry.label : music.mood,
      icon: entry ? entry.icon : DEFAULT_CUSTOM_ICON
    };
  }, [music.mood, music.customCategories]);
}

export default function TvMusicTransport({ campaignName, isLocalhost }) {
  const [music, setMusic] = useSyncedState('campaign', 'music', DEFAULT_MUSIC, campaignName);
  const { addEntry } = useLog(campaignName);
  const state = normalizeMusic(music);
  const active = useActiveMood(state);
  const playing = state.playing;

  // One-hand minimal footprint: nothing on the header while stopped.
  if (!active) return null;

  // Read-only visitors get the current-mood chip only — no operable controls
  // (the two-window remote-ownership law lives in the GM windows, unchanged).
  if (!isLocalhost) {
    return (
      <span className='tv-music-transport'>
        <span className='music-remote-note'>
          <i className={`fa-solid ${active.icon}`}></i>
          <span>{`${active.label} ambience ${playing ? 'playing' : 'paused'}`}</span>
        </span>
      </span>
    );
  }

  const handlePause = () => {
    setMusic(pauseCommit(state));
    addEntry(pauseLogEntry(state.mood, active.label));
  };
  const handleStop = () => {
    setMusic(stopCommit(state));
    addEntry(stopLogEntry());
  };

  // Resume is deliberately absent: cross-window resume would fight the
  // adoption law (a play commit stands every other tab's player down), and
  // the backlog ask is a minimal Pause/Stop transport. Resume stays in the
  // sidebar MusicPlayer after exiting TV.
  return (
    <span className='tv-music-transport'>
      <span className='tv-music-chip' title={`${active.label} ambience ${playing ? 'playing' : 'paused'}`}>
        <i className={`fa-solid ${active.icon}`}></i>
        <span>{playing ? active.label : `${active.label} (paused)`}</span>
      </span>
      {playing && (
        <button type='button' className='music-btn' onClick={handlePause} title='Pause' aria-label='Pause ambience'>
          <i className='fa-solid fa-pause'></i>
        </button>
      )}
      <button type='button' className='music-btn' onClick={handleStop} title='Stop' aria-label='Stop ambience'>
        <i className='fa-solid fa-stop'></i>
      </button>
    </span>
  );
}
