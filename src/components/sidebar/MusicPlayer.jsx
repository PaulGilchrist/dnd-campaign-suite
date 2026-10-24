import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js';
import { setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';
import useLog from '../../hooks/runtime/useLog.js';
import { MOODS, DEFAULT_VOLUME, getMood, getTracksForMood, extractVideoId } from '../../services/ui/musicConfig.js';
import { saveMusicOverrides } from '../../services/ui/musicService.js';
import * as youtubePlayer from '../../services/ui/youtubePlayer.js';
import './MusicPlayer.css';

const YT_FRAME_ID = 'yt-music-frame';

const DEFAULT_MUSIC = { mood: null, playing: false, volume: DEFAULT_VOLUME, overrides: {} };

const moodLabel = (moodKey) => (getMood(moodKey) || {}).label || moodKey;

function parseTrackList(text) {
  return text
    .split(/[\n,]+/)
    .map(line => extractVideoId(line))
    .filter(Boolean)
    .map(videoId => ({ videoId, title: videoId }));
}

function MusicPlayer({ campaignName, isLocalhost }) {
  const [rawMusic, setMusic] = useSyncedState('campaign', 'music', DEFAULT_MUSIC, campaignName);
  const music = useMemo(
    () => (rawMusic && typeof rawMusic === 'object' ? { ...DEFAULT_MUSIC, ...rawMusic } : DEFAULT_MUSIC),
    [rawMusic]
  );

  const [volume, setVolume] = useState(music.volume ?? DEFAULT_VOLUME);
  const [editing, setEditing] = useState(false);
  const [playerMounted, setPlayerMounted] = useState(false);
  const [editMood, setEditMood] = useState(MOODS[0].key);
  const [trackText, setTrackText] = useState('');
  const [editorError, setEditorError] = useState(null);
  // Display-only save/reset confirmation toast (mirrors .sessions-toast /
  // .encounter-toast): names the mood so a closed editor still leaves a trace.
  const [toast, setToast] = useState(null);
  const { addEntry } = useLog(campaignName);

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 2500); // toast auto-hide (display only, no game state)
  }, []);

  useEffect(() => {
    if (!isLocalhost || !playerMounted) return;
    youtubePlayer.ensurePlayer(YT_FRAME_ID);
    return () => youtubePlayer.dispose();
  }, [isLocalhost, playerMounted]);

  useEffect(() => {
    youtubePlayer.setVolume(volume);
  }, [volume]);

  const selectMood = useCallback((moodKey) => {
    const tracks = getTracksForMood(moodKey, music.overrides);
    if (tracks.length === 0) {
      console.error(`No tracks configured for mood "${moodKey}"`);
      return;
    }
    setPlayerMounted(true);
    youtubePlayer.playTracks(tracks.map(t => t.videoId));
    setMusic({ ...music, mood: moodKey, playing: true });
    const mood = getMood(moodKey);
    addEntry({
      type: 'music',
      action: 'set_ambience',
      mood: moodKey,
      message: `GM set ambience: ${mood ? mood.label : moodKey} — ${tracks[0].title}`
    });
  }, [music, setMusic, addEntry]);

  const togglePlay = useCallback(() => {
    if (!music.mood) return;
    if (music.playing) {
      youtubePlayer.pause();
      setMusic({ ...music, playing: false });
    } else {
      if (!playerMounted) {
        setPlayerMounted(true);
        const tracks = getTracksForMood(music.mood, music.overrides);
        if (tracks.length === 0) {
          console.error(`No tracks configured for mood "${music.mood}"`);
          return;
        }
        youtubePlayer.playTracks(tracks.map(t => t.videoId));
      } else {
        youtubePlayer.resume();
      }
      setMusic({ ...music, playing: true });
    }
  }, [music, setMusic, playerMounted]);

  const stopMusic = useCallback(() => {
    youtubePlayer.stop();
    setMusic({ ...music, mood: null, playing: false });
    addEntry({ type: 'music', action: 'stop', message: 'GM stopped ambience' });
  }, [music, setMusic, addEntry]);

  const handleVolume = useCallback((event) => {
    const next = Number(event.target.value) / 100;
    setVolume(next);
    setMusic({ ...music, volume: next });
  }, [music, setMusic]);

  const openEditor = useCallback(() => {
    const tracks = getTracksForMood(editMood, music.overrides);
    setTrackText(tracks.map(t => t.videoId).join('\n'));
    setEditorError(null);
    setEditing(true);
  }, [editMood, music.overrides]);

  const changeEditMood = useCallback((event) => {
    const moodKey = event.target.value;
    setEditMood(moodKey);
    const tracks = getTracksForMood(moodKey, music.overrides);
    setTrackText(tracks.map(t => t.videoId).join('\n'));
    setEditorError(null);
  }, [music.overrides]);

  const saveTracks = useCallback(async () => {
    const tracks = parseTrackList(trackText);
    if (tracks.length === 0) {
      console.error('No valid YouTube URLs or video ids entered');
      setEditorError('No valid YouTube URLs or video ids entered');
      return;
    }
    const overrides = { ...music.overrides, [editMood]: tracks };
    // PATCH { overrides } only — playing/mood are never sent here, so a save while
    // stopped cannot flip server playing:true (surprise-autoplay guard, server merge).
    const saved = await saveMusicOverrides(campaignName, overrides);
    if (!saved) {
      showToast(`Failed to save ${moodLabel(editMood)} tracks`, true);
      return;
    }
    // Pin the local store to server truth, skipSync: the server already holds it.
    setRuntimeObject('campaign', { music: saved }, campaignName, true);
    if (saved.mood === editMood && saved.playing) {
      setPlayerMounted(true);
      youtubePlayer.playTracks(tracks.map(t => t.videoId));
    }
    setEditorError(null);
    setEditing(false);
    showToast(`${moodLabel(editMood)} tracks saved`);
  }, [trackText, editMood, music, campaignName, showToast]);

  const resetMood = useCallback(async () => {
    const overrides = { ...music.overrides };
    delete overrides[editMood];
    const saved = await saveMusicOverrides(campaignName, overrides);
    if (!saved) {
      showToast(`Failed to reset ${moodLabel(editMood)} overrides`, true);
      return;
    }
    setRuntimeObject('campaign', { music: saved }, campaignName, true);
    const tracks = getTracksForMood(editMood, saved.overrides);
    setTrackText(tracks.map(t => t.videoId).join('\n'));
    setEditorError(null);
    showToast(`${moodLabel(editMood)} overrides reset to defaults`);
  }, [editMood, music, campaignName, showToast]);

  if (!isLocalhost) return null;

  const playing = music.playing;

  return (
    <div className="music-player">
      <div className="sidebar-section-header sidebar-section-header-static">
        <i className="fa-solid fa-music"></i> Music
      </div>
      <div className="music-moods">
        {MOODS.map((mood) => (
          <button
            key={mood.key}
            className={`music-mood-btn${playing && music.mood === mood.key ? ' active' : ''}`}
            onClick={() => selectMood(mood.key)}
            title={`Play ${mood.label} ambience`}
          >
            <i className={`fa-solid ${mood.icon}`}></i> {mood.label}
          </button>
        ))}
      </div>
      <div className="music-controls">
        <button className="music-btn" onClick={togglePlay} disabled={!music.mood} title={playing ? 'Pause' : 'Play'}>
          <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'}`}></i>
        </button>
        <button className="music-btn" onClick={stopMusic} disabled={!music.mood} title="Stop">
          <i className="fa-solid fa-stop"></i>
        </button>
        <input
          className="music-volume"
          type="range"
          min="0"
          max="100"
          value={Math.round(volume * 100)}
          onChange={handleVolume}
          title="Volume"
        />
        <button className="music-btn" onClick={openEditor} title="Edit tracks for this mood">
          <i className="fa-solid fa-pen"></i>
        </button>
      </div>
      {editing && (
        <div className="music-editor">
          <label htmlFor="music-editor-mood">Mood</label>
          <select id="music-editor-mood" value={editMood} onChange={changeEditMood}>
            {MOODS.map((mood) => (
              <option key={mood.key} value={mood.key}>{mood.label}</option>
            ))}
          </select>
          <textarea
            id="music-editor-urls"
            className="music-editor-urls"
            rows={3}
            value={trackText}
            onChange={(event) => {
              setTrackText(event.target.value);
              setEditorError(null);
            }}
            placeholder="One YouTube URL or video ID per line"
          />
          {editorError && <div className="music-editor-error">{editorError}</div>}
          <div className="music-editor-actions">
            <button className="music-btn" onClick={saveTracks}>Save</button>
            <button className="music-btn" onClick={resetMood} title="Restore starter tracks">Reset</button>
            <button className="music-btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
      {toast && (
        <div className={`music-toast${toast.isError ? ' music-toast-error' : ''}`} role="status">
          {toast.message}
        </div>
      )}
      {playerMounted && (
        <div className="yt-music-frame"><div id={YT_FRAME_ID}></div></div>
      )}
    </div>
  );
}

export default MusicPlayer;
