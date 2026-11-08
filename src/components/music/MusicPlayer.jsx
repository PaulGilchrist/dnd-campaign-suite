import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js';
import { setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';
import useLog from '../../hooks/runtime/useLog.js';
import { MOODS, DEFAULT_VOLUME, getTracksForMood, extractVideoId, buildMoodList, makeCategoryKey, CATEGORY_ICONS, DEFAULT_CUSTOM_ICON } from '../../services/ui/musicConfig.js';
import { saveMusicOverrides, saveMusicCategories } from '../../services/ui/musicService.js';
import { useReloadGuard } from '../../hooks/management/useReloadGuard.js';
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';
import * as youtubePlayer from '../../services/ui/youtubePlayer.js';
import './MusicPlayer.css';

const YT_FRAME_ID = 'yt-music-frame';

const DEFAULT_MUSIC = { mood: null, playing: false, volume: DEFAULT_VOLUME, overrides: {}, customCategories: {} };

function parseTrackList(text) {
  return text
    .split(/[\n,]+/)
    .map(line => extractVideoId(line))
    .filter(Boolean)
    .map(videoId => ({ videoId, title: videoId }));
}

// One sidebar mood chip: the play button plus, for custom categories only,
// a small × delete affordance (built-ins are permanent — improve 2026-11-07).
// Extracted from MusicPlayer to keep the panel body focused; pure props.
function MusicMoodChip({ mood, active, trackCount, onSelect, onDelete }) {
  // Empty custom category: the click opens the editor (see selectMood), so
  // the tooltip promises that instead of playback.
  const title = trackCount === 0 && mood.custom
    ? `Add ${mood.label} tracks`
    : `Play ${mood.label} ambience`;
  return (
    <span className="music-mood-item">
      <button
        className={`music-mood-btn${active ? ' active' : ''}`}
        onClick={() => onSelect(mood.key)}
        title={title}
      >
        <i className={`fa-solid ${mood.icon}`}></i> {mood.label}
      </button>
      {mood.custom && (
        <button
          className="music-mood-delete"
          onClick={() => onDelete(mood.key)}
          title={`Delete ${mood.label} category`}
          aria-label={`Delete ${mood.label} category`}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      )}
    </span>
  );
}

// Create-category form (improve 2026-11-07): name + preset icon picker.
// Pure presentational — all state/handlers owned by MusicPlayer.
function MusicCategoryForm({ label, icon, error, onLabelChange, onIconChange, onSubmit, onCancel }) {
  return (
    <div className="music-editor music-category-form">
      <label htmlFor="music-category-label">Category name</label>
      <input
        id="music-category-label"
        type="text"
        value={label}
        maxLength={40}
        placeholder="e.g. Crypt, Underdark, Boss Fight"
        onChange={(event) => onLabelChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') onSubmit(); }}
      />
      <label id="music-category-icons-label">Icon</label>
      <div className="music-icon-picker" role="group" aria-labelledby="music-category-icons-label">
        {CATEGORY_ICONS.map((choice) => (
          <button
            key={choice}
            type="button"
            className={`music-btn music-icon-btn${icon === choice ? ' active' : ''}`}
            onClick={() => onIconChange(choice)}
            title={choice}
            aria-label={`Icon ${choice}`}
          >
            <i className={`fa-solid ${choice}`}></i>
          </button>
        ))}
      </div>
      {error && <div className="music-editor-error">{error}</div>}
      <div className="music-editor-actions">
        <button className="music-btn" onClick={onSubmit}>Create</button>
        <button className="music-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// The two role=dialog confirm modals (backlog 2026-11-08 EK migration off
// native window.confirm): hoisted presentational wrappers over the shared
// DeleteConfirmModal so the retired copy renders VERBATIM inside the family
// chrome (null when their trigger is idle, FriendlyFireConfirmModal idiom).
// Kept out of MusicPlayer's body (complexity cap) — pure props in.
function MusicDeleteCategoryModal({ moodKey, moodLabel, onCancel, onConfirm }) {
  if (!moodKey) return null;
  return (
    <DeleteConfirmModal
      titleId="music-delete-category-title"
      title="Delete Music Category"
      confirmLabel="Yes, Delete Category"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {`Delete the ${moodLabel(moodKey)} category? Its track list will be removed.`}
    </DeleteConfirmModal>
  );
}

function MusicDiscardChangesModal({ pending, message, onCancel, onConfirm }) {
  if (!pending) return null;
  return (
    <DeleteConfirmModal
      titleId="music-discard-changes-title"
      title="Discard Changes?"
      confirmLabel="Yes, Discard"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {message}
    </DeleteConfirmModal>
  );
}

// Display-only save/reset confirmation toast — moved out of MusicPlayer's
// render body (complexity budget, improve 2026-11-07); markup unchanged.
function MusicToast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`music-toast${toast.isError ? ' music-toast-error' : ''}`} role="status">
      {toast.message}
    </div>
  );
}

// Ambience duty is delegable: the view is open to players, not GM-only.
// `visible` (App: activeView === 'music') only controls whether the PANEL
// renders — the component itself stays mounted across view navigation so the
// YouTube player survives and audio plays continuously wherever the user is.
// Only Pause/Stop (or closing the campaign) ever silences it.
function MusicPlayer({ campaignName, visible = true }) {
  const [rawMusic, setMusic] = useSyncedState('campaign', 'music', DEFAULT_MUSIC, campaignName);
  const music = useMemo(
    () => (rawMusic && typeof rawMusic === 'object' ? { ...DEFAULT_MUSIC, ...rawMusic } : DEFAULT_MUSIC),
    [rawMusic]
  );

  // Merged sidebar catalogue (improve 2026-11-07): frozen starter MOODS plus
  // this campaign's customCategories. Display order stays A–Z; MOODS itself
  // keeps canonical catalogue order (tests pin MOODS[0]='town').
  const moods = useMemo(() => buildMoodList(music.customCategories), [music.customCategories]);
  const sortedMoods = useMemo(
    () => [...moods].sort((a, b) => a.label.localeCompare(b.label)),
    [moods]
  );
  const moodLabel = useCallback(
    (moodKey) => (moods.find(m => m.key === moodKey) || {}).label || moodKey,
    [moods]
  );
  const isCustomMood = useCallback(
    (moodKey) => !!(moods.find(m => m.key === moodKey) || {}).custom,
    [moods]
  );

  const [volume, setVolume] = useState(music.volume ?? DEFAULT_VOLUME);
  const [editing, setEditing] = useState(false);
  const [playerMounted, setPlayerMounted] = useState(false);
  const [editMood, setEditMood] = useState(MOODS[0].key);
  const [trackText, setTrackText] = useState('');
  const [editorError, setEditorError] = useState(null);
  // Dirty-draft guard for the inline editor (improve 2026-10-29-AE backlog,
  // parity with the six .ct-* lanes' ×/Cancel NAMED discard, 4d4b1e69a, and
  // the wizard, 4569f2d67): Cancel or a mood-select switch silently discarded
  // a typed-but-unsaved track list. Shares the house useReloadGuard — seed
  // the snapshot wherever the editor (re)seeds the textarea, re-baseline on
  // Reset (save-lane stays open); only a draft that deep-differs from its
  // seed pays the discard prompt, naming the mood being LEFT. The prompt
  // itself migrated off native window.confirm onto the shared
  // DeleteConfirmModal role="dialog" tier (backlog 2026-11-08 EK, friendly-
  // fire precedent): the guard supplies the dirty verdict (isDraftDirty),
  // the pending action waits in UI-local state until an explicit button.
  const editorDraft = useMemo(() => ({ trackText }), [trackText]);
  const { seedDraft, clearDraft, isDraftDirty } = useReloadGuard({
    modalOpen: editing,
    formData: editorDraft,
  });
  // Live-validation hint (improve 2026-10-29-AF backlog, parity with the
  // .ct-* lanes' typed-while-live duplicate banners, e.g. Quests.jsx
  // getDuplicateState): the count is derived from the SAME parseTrackList
  // Save uses — single source of truth, no second parser, no extra state,
  // no writes while typing. Zero-valid input reads as a warning hint so a
  // wiped/garbled draft is visible before the Save click pays the
  // leaf-inline rejection.
  const parsedTracks = useMemo(() => parseTrackList(trackText), [trackText]);
  // Display-only save/reset confirmation toast (mirrors .sessions-toast /
  // .encounter-toast): names the mood so a closed editor still leaves a trace.
  const [toast, setToast] = useState(null);
  const { addEntry } = useLog(campaignName);

  // Remote-adoption guard (bug-music-player-no-remote-state-adoption): the
  // last {mood,playing} THIS tab committed with its own click (or null until
  // the first observation, which is the mount baseline — nothing changed
  // remotely yet). The adoption effect skips bytes it committed itself, so
  // the SSE echo of a local action never re-commands the local player.
  const localMusicRef = useRef(null);

  // Last volume THIS tab committed with its own slider (or null until the
  // first observation) — the volume sibling of localMusicRef, same echo-skip
  // doctrine (see the adoption effect below).
  const localVolumeRef = useRef(null);

  // Latest {music, playerMounted} for the unmount lane below (refs so the
  // []-dep effect never re-runs during the component's life).
  const leaveViewRef = useRef(null);
  leaveViewRef.current = { music, playerMounted };

  // All mood/playing transitions go through here so the adoption guard stays
  // in step with what this tab committed.
  const commitMusic = useCallback((next) => {
    localMusicRef.current = { mood: next.mood ?? null, playing: !!next.playing };
    setMusic(next);
  }, [setMusic]);

  // Remote-state adoption (mirrors the useTravelToolSync adopt lane): the
  // shared 'music' key mirrors across tabs but the YouTube player is per-tab,
  // so a transition committed by ANOTHER client must drive this tab's module
  // to match. A play/mood change always originates from a click in a tab that
  // mounts its own player, so every other tab stands down (stop + unmount) —
  // only the acting tab produces audio, and no tab's UI ever claims a player
  // state its module was never commanded to. Pause is gentler: the owner just
  // pauses, keeping its frame so a later local resume reuses it.
  useEffect(() => {
    const seen = { mood: music.mood, playing: music.playing };
    const last = localMusicRef.current;
    localMusicRef.current = seen;
    if (!last) return; // mount baseline — adopt nothing on first observation
    if (seen.mood === last.mood && seen.playing === last.playing) return; // own echo / no transport change
    if (!playerMounted) return; // no local player to command
    if (seen.playing || !seen.mood) {
      youtubePlayer.stop();
      setPlayerMounted(false);
      console.info(seen.playing
        ? "[MusicPlayer] Ambience started in another tab — releasing this tab's player (no double playback)"
        : "[MusicPlayer] Ambience stopped in another tab — releasing this tab's player");
    } else {
      youtubePlayer.pause();
      console.info("[MusicPlayer] Ambience paused in another tab — pausing this tab's player");
    }
  }, [music.mood, music.playing, playerMounted]);

  // Volume adoption (bug-music-volume-no-cross-tab-adoption): the useState
  // seed above loses the race to async store hydration, so the shared key's
  // volume is folded in whenever the hydrated/echoed value first changes
  // after mount — a remote tab's slider move (or the hydration landing)
  // re-seeds this tab's slider, and the useEffect([volume]) →
  // youtubePlayer.setVolume below then drives the owner's iframe without a
  // remount. Echo-safe like the transport guard: a value equal to the last
  // observation, or to what THIS tab just committed via the slider, is never
  // re-applied (the SSE echo of a local drag cannot clobber in-flight state).
  useEffect(() => {
    const seen = music.volume ?? DEFAULT_VOLUME;
    const last = localVolumeRef.current;
    localVolumeRef.current = seen;
    if (last === null) return; // mount baseline — useState already holds it
    if (seen === last) return; // own echo / no change
    setVolume(seen);
  }, [music.volume]);

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 2500); // toast auto-hide (display only, no game state)
  }, []);

  useEffect(() => {
    if (!playerMounted) return;
    youtubePlayer.ensurePlayer(YT_FRAME_ID);
    return () => youtubePlayer.dispose();
  }, [playerMounted]);

  // The panel is now persistent-mounted (App renders it outside the view
  // outlet, hidden via the `visible` prop when another view is active), so
  // navigating between views never unmounts it and the audio plays on. This
  // lane only fires on a REAL teardown — leaving the campaign / unmounting
  // the app — where the iframe dies with the DOM: un-arm the shared mood so
  // no tab is left claiming playback this window no longer owns (the stop
  // button's honest state, plus a log row naming the seam).
  useEffect(() => () => {
    const state = leaveViewRef.current;
    if (!state || !state.playerMounted || !state.music.playing) return;
    youtubePlayer.stop();
    commitMusic({ ...state.music, mood: null, playing: false });
    addEntry({ type: 'music', action: 'stop', message: 'Stopped ambience (left campaign)' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    youtubePlayer.setVolume(volume);
  }, [volume]);

  // Shared editor seeding lane (openEditor, mood-select switch, and the
  // click-an-empty-custom-category shortcut all funnel through here).
  const seedEditor = useCallback((moodKey) => {
    setEditMood(moodKey);
    const tracks = getTracksForMood(moodKey, music.overrides);
    const text = tracks.map(t => t.videoId).join('\n');
    setTrackText(text);
    seedDraft({ trackText: text });
    setEditorError(null);
  }, [music.overrides, seedDraft]);

  const selectMood = useCallback((moodKey) => {
    const tracks = getTracksForMood(moodKey, music.overrides);
    if (tracks.length === 0) {
      // A brand-new custom category starts empty: clicking it goes straight
      // to the editor (seeded on that mood) instead of erroring — the DJ's
      // next step IS adding tracks. Built-ins reaching this arm is a
      // catalogue bug, so they keep the honest console.error.
      if (isCustomMood(moodKey)) {
        seedEditor(moodKey);
        setEditing(true);
        return;
      }
      console.error(`No tracks configured for mood "${moodKey}"`);
      return;
    }
    setPlayerMounted(true);
    youtubePlayer.playTracks(tracks.map(t => t.videoId));
    commitMusic({ ...music, mood: moodKey, playing: true });
    addEntry({
      type: 'music',
      action: 'set_ambience',
      mood: moodKey,
      message: `Set ambience: ${moodLabel(moodKey)} — ${tracks[0].title}`
    });
  }, [music, commitMusic, addEntry, isCustomMood, seedEditor, moodLabel]);

  const togglePlay = useCallback(() => {
    if (!music.mood) return;
    if (music.playing) {
      youtubePlayer.pause();
      commitMusic({ ...music, playing: false });
      addEntry({
        type: 'music',
        action: 'pause',
        mood: music.mood,
        message: `Paused ${moodLabel(music.mood)} ambience`
      });
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
      commitMusic({ ...music, playing: true });
      addEntry({
        type: 'music',
        action: 'resume',
        mood: music.mood,
        message: `Resumed ${moodLabel(music.mood)} ambience`
      });
    }
  }, [music, commitMusic, playerMounted, addEntry, moodLabel]);

  const stopMusic = useCallback(() => {
    youtubePlayer.stop();
    commitMusic({ ...music, mood: null, playing: false });
    addEntry({ type: 'music', action: 'stop', message: 'Stopped ambience' });
  }, [music, commitMusic, addEntry]);

  // Queue exhaustion (youtubePlayer.js handleError): every track failed
  // back-to-back — un-arm the mood and tell the listener honestly instead of the
  // transport claiming it is playing dead videos. Toast lane mirrors the
  // editor-save errors; the log row follows the set_ambience/stop pattern.
  useEffect(() => {
    const handleQueueExhausted = (event) => {
      const label = music.mood ? moodLabel(music.mood) : 'this mood';
      const failedIds = (event.detail || {}).videoIds || [];
      commitMusic({ ...music, mood: null, playing: false });
      showToast(`No playable tracks for ${label} ambience`, true);
      addEntry({
        type: 'music',
        action: 'no_playable_tracks',
        mood: music.mood,
        message: `Ambience stopped — no playable tracks for ${label}${failedIds.length > 0 ? ` (${failedIds.join(', ')})` : ''}`
      });
    };
    window.addEventListener('music-queue-exhausted', handleQueueExhausted);
    return () => window.removeEventListener('music-queue-exhausted', handleQueueExhausted);
  }, [music, commitMusic, showToast, addEntry, moodLabel]);

  const handleVolume = useCallback((event) => {
    const next = Number(event.target.value) / 100;
    setVolume(next);
    // Record as this tab's own commit so the adoption effect skips the SSE
    // echo (mirrors commitMusic's localMusic guard) — a late echo can never
    // clobber an in-flight slider drag.
    localVolumeRef.current = next;
    setMusic({ ...music, volume: next });
  }, [music, setMusic]);

  // "Edit tracks for this mood" must mean the mood IN PLAY (bug-music-editor-
  // wrong-mood-default): with an active mood the editor seeds, names, and
  // saves THAT mood — previously it always opened on MOODS[0] ('town'), so a
  // player adding Tavern tracks while tavern played silently misfiled them into
  // overrides.town. With no mood active there is no "this mood", so fall back
  // to the last mood selected in the editor's select (starts at MOODS[0]).
  const openEditor = useCallback(() => {
    seedEditor(music.mood || editMood);
    setEditing(true);
  }, [music.mood, editMood, seedEditor]);

  // Pending discard (UI-local ephemeral prompt state — a half-answered
  // confirm, never the runtime store; No-Game-Timers: waits indefinitely for
  // an explicit button). `nextMood` null = the Cancel close path; a mood key
  // = the select-switch path (the select DOM value is reverted immediately,
  // the seed only lands on confirm).
  const [pendingDiscard, setPendingDiscard] = useState(null);

  const changeEditMood = useCallback((event) => {
    const moodKey = event.target.value;
    // Switching moods re-seeds the textarea — an unsaved draft pays the same
    // NAMED discard modal (naming the mood being LEFT). Cancel keeps the edit
    // on the original mood; the select was already reset by hand: editMood
    // state never changed, so React has no re-render that would restore the
    // DOM value.
    if (isDraftDirty()) {
      setPendingDiscard({ nextMood: moodKey });
      event.target.value = editMood;
      return;
    }
    seedEditor(moodKey);
  }, [editMood, isDraftDirty, seedEditor]);

  // Cancel close path (parity with the .ct-* handleRequestClose doctrine): a
  // dirty draft opens the discard modal first; a clean draft closes silently
  // as before.
  const cancelEdit = useCallback(() => {
    if (isDraftDirty()) {
      setPendingDiscard({ nextMood: null });
      return;
    }
    clearDraft();
    setEditing(false);
  }, [isDraftDirty, clearDraft]);

  // Discard-modal confirm: executes what the retired native-confirm lane ran
  // inline — switch re-seeds the target mood, close discards + unmounts the
  // editor. Cancel just clears the pending prompt (everything stays inert).
  const confirmPendingDiscard = useCallback(() => {
    const pending = pendingDiscard;
    setPendingDiscard(null);
    if (!pending) return;
    if (pending.nextMood) {
      seedEditor(pending.nextMood);
    } else {
      clearDraft();
      setEditing(false);
    }
  }, [pendingDiscard, seedEditor, clearDraft]);

  const saveTracks = useCallback(async () => {
    const tracks = parseTrackList(trackText);
    if (tracks.length === 0) {
      // Invalid user input, not an app fault: the inline .music-editor-error
      // below (plus the live zero-count hint) is the user-facing feedback, so
      // this only leaves a console.debug trace (spellValidation drop-list
      // precedent, 9a82ec4ef) instead of mirroring every rejected paste as a
      // console.error. Genuine save/network faults keep console.error in
      // musicService.postMusicPatch.
      console.debug('[MusicPlayer] No valid YouTube URLs or video ids entered');
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
    clearDraft();
    setEditing(false);
    showToast(`${moodLabel(editMood)} tracks saved`);
  }, [trackText, editMood, music, campaignName, showToast, clearDraft, moodLabel]);

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
    const text = tracks.map(t => t.videoId).join('\n');
    setTrackText(text);
    // Reset lands the editor on the defaults with the modal still open —
    // re-baseline the guard so the fresh seed doesn't look like an unsaved
    // edit (useReloadGuard doctrine: re-seed wherever a save stays open).
    seedDraft({ trackText: text });
    setEditorError(null);
    showToast(`${moodLabel(editMood)} overrides reset to defaults`);
  }, [editMood, music, campaignName, showToast, seedDraft, moodLabel]);

  // --- Campaign-specific categories (improve 2026-11-07) -------------------
  // Same permission model as track editing (user decision: ambience duty is
  // delegable, so DJs — GM or player — may create/delete custom categories).
  // Built-in moods are permanent; only custom entries get the ×/delete lane.
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState(DEFAULT_CUSTOM_ICON);
  const [categoryError, setCategoryError] = useState(null);

  const submitNewCategory = useCallback(async () => {
    const label = newCategoryLabel.trim();
    const key = makeCategoryKey(label, moods.map(m => m.key));
    if (!key) {
      setCategoryError('Category name must include letters or numbers');
      return;
    }
    // Duplicate-label guard (improve 2026-11-08 backlog): makeCategoryKey used
    // to resolve a twin label SILENTLY to `custom-<slug>-2` — both chips
    // rendered the identical visible label and the DJ could not tell them
    // apart. Block in-form instead, mirroring the custom-magic-items lane's
    // getCustomNameConflict copy style. Trim + case-insensitive, matching
    // buildMoodList's label normalization; built-in mood labels are out of
    // scope (the server already forbids shadowing their keys). Echo the
    // existing entry's CANONICAL label (improve 2026-11-08 EM backlog): a
    // variant query like "  qa jazz  " must read back `QA Jazz`, not the
    // normalized input, so the DJ sees which stored category collided.
    const lower = label.toLowerCase();
    const existing = Object.values(music.customCategories || {}).find(
      entry => entry && typeof entry.label === 'string' && entry.label.trim().toLowerCase() === lower
    );
    if (existing) {
      setCategoryError(`A category named "${existing.label}" already exists.`);
      return;
    }
    const customCategories = { ...music.customCategories, [key]: { label, icon: newCategoryIcon } };
    // PATCH { customCategories } only — a new category starts with an empty
    // track list (no overrides entry), so transport fields are untouched.
    const saved = await saveMusicCategories(campaignName, customCategories);
    if (!saved) {
      showToast(`Failed to create ${label} category`, true);
      return;
    }
    setRuntimeObject('campaign', { music: saved }, campaignName, true);
    setAddingCategory(false);
    setNewCategoryLabel('');
    setNewCategoryIcon(DEFAULT_CUSTOM_ICON);
    setCategoryError(null);
    showToast(`Category ${label} created — add tracks to it`);
    addEntry({
      type: 'music',
      action: 'add_category',
      mood: key,
      message: `Added music category ${label}`
    });
  }, [newCategoryLabel, newCategoryIcon, moods, music.customCategories, campaignName, showToast, addEntry]);

  const cancelNewCategory = useCallback(() => {
    setAddingCategory(false);
    setNewCategoryLabel('');
    setNewCategoryIcon(DEFAULT_CUSTOM_ICON);
    setCategoryError(null);
  }, []);

  // Category-delete confirm (backlog 2026-11-08 EK): the native window.confirm
  // migrated onto the shared DeleteConfirmModal role="dialog" tier. UI-local
  // ephemeral prompt state — the pending mood key, nothing more; a Cancel
  // leaves every byte untouched. Both trigger faces (the sidebar chip × and
  // the editor's "Delete category") funnel through this one request.
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState(null);

  const requestDeleteCategory = useCallback((moodKey) => {
    setPendingDeleteCategory(moodKey);
  }, []);

  // Confirmed body — byte-identical to the retired native lane (stop first,
  // atomic PATCH, log row); the modal has already gated it.
  const executeDeleteCategory = useCallback(async (moodKey) => {
    const label = moodLabel(moodKey);
    // Deleting the ACTIVE mood silences this tab's player first, then the
    // transport un-arms the shared mood (stop button's honest state). Other
    // tabs release theirs via the existing remote-adoption lane.
    if (music.mood === moodKey) {
      youtubePlayer.stop();
      commitMusic({ ...music, mood: null, playing: false });
    }
    const customCategories = { ...music.customCategories };
    delete customCategories[moodKey];
    const overrides = { ...music.overrides };
    delete overrides[moodKey];
    // One PATCH carries both maps so category and tracks go atomically.
    const saved = await saveMusicCategories(campaignName, customCategories, overrides);
    if (!saved) {
      showToast(`Failed to delete ${label} category`, true);
      return;
    }
    setRuntimeObject('campaign', { music: saved }, campaignName, true);
    if (editing && editMood === moodKey) {
      clearDraft();
      setEditing(false);
    }
    showToast(`Category ${label} deleted`);
    addEntry({
      type: 'music',
      action: 'delete_category',
      mood: moodKey,
      message: `Deleted music category ${label}`
    });
  }, [music, moodLabel, commitMusic, campaignName, editing, editMood, clearDraft, showToast, addEntry]);

  const confirmDeleteCategory = useCallback(() => {
    const moodKey = pendingDeleteCategory;
    setPendingDeleteCategory(null);
    if (moodKey) executeDeleteCategory(moodKey);
  }, [pendingDeleteCategory, executeDeleteCategory]);

  const playing = music.playing;

  const panel = (
    <div className="music-player">
      <div className="ct-header">
        <h2 className="ct-title">
          <i className="fa-solid fa-music" /> Music
        </h2>
      </div>
      <div className="music-panel">
        <div className="music-moods">
          {sortedMoods.map((mood) => (
            <MusicMoodChip
              key={mood.key}
              mood={mood}
              active={playing && music.mood === mood.key}
              trackCount={getTracksForMood(mood.key, music.overrides).length}
              onSelect={selectMood}
              onDelete={requestDeleteCategory}
            />
          ))}
          <button
            className="music-btn music-add-category"
            onClick={() => { setAddingCategory((open) => !open); setCategoryError(null); }}
            title="Add music category"
            aria-label="Add music category"
          >
            <i className="fa-solid fa-plus"></i>
          </button>
        </div>
        {addingCategory && (
          <MusicCategoryForm
            label={newCategoryLabel}
            icon={newCategoryIcon}
            error={categoryError}
            onLabelChange={(value) => { setNewCategoryLabel(value); setCategoryError(null); }}
            onIconChange={setNewCategoryIcon}
            onSubmit={submitNewCategory}
            onCancel={cancelNewCategory}
          />
        )}
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
        {/* aria-label (backlog 2026-11-01, a11y parity with the 7c547abdc mood
            select): icon-only button, so expose its name explicitly; title is
            kept for the hover tooltip and existing getByTitle test locators. */}
        <button className="music-btn" onClick={openEditor} title="Edit tracks for this mood" aria-label="Edit tracks for this mood">
          <i className="fa-solid fa-pen"></i>
        </button>
      </div>
      {/* Remote-ownership chip (backlog 2026-10-29-AF): since 576be121d the
          stand-down tab's transport WORKS (its Pause commands the owner via
          adoption), but its UI was indistinguishable from the owner's — same
          active mood + enabled buttons with zero local player. playerMounted
          is the existing owner discriminator; when shared state says playing
          but THIS tab holds no frame, the audio lives in another window.
          Pure derived render state — .travel-panel-hint idiom. */}
      {playing && !playerMounted && (
        <div className="music-remote-note">
          <i className="fa-solid fa-circle-info"></i>
          <span>Playing in another window</span>
        </div>
      )}
      {editing && (
        <div className="music-editor">
          <label htmlFor="music-editor-mood">Mood</label>
          {/* aria-label (backlog 2026-11-01 AV): the visible label is the bare
              word "Mood"; the explicit name makes the chooser discoverable to
              screen readers and tests. */}
          <select id="music-editor-mood" aria-label="Tracks mood" value={editMood} onChange={changeEditMood}>
            {sortedMoods.map((mood) => (
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
          {/* Live feedback while typing (see parsedTracks note above): a
              valid count line, or a warning-style hint when nothing parses.
              The Save-time .music-editor-error lane below stays unchanged. */}
          {parsedTracks.length > 0 ? (
            <div className="music-editor-hint" role="status">
              <i className="fa-solid fa-circle-check"></i>
              <span>{parsedTracks.length} valid track{parsedTracks.length === 1 ? '' : 's'}</span>
            </div>
          ) : (
            <div className="music-editor-hint music-editor-hint-warn" role="status">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>No valid tracks yet — paste YouTube URLs or video ids</span>
            </div>
          )}
          {editorError && <div className="music-editor-error">{editorError}</div>}
          <div className="music-editor-actions">
            <button className="music-btn" onClick={saveTracks}>Save</button>
            {isCustomMood(editMood) ? (
              // Custom categories have no starter defaults to Reset to —
              // the editor offers Delete (category + tracks) instead.
              <button className="music-btn" onClick={() => requestDeleteCategory(editMood)} title={`Delete ${moodLabel(editMood)} category`}>
                Delete category
              </button>
            ) : (
              <button className="music-btn" onClick={resetMood} title="Restore starter tracks">Reset</button>
            )}
            <button className="music-btn" onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      )}
      <MusicToast toast={toast} />
      <MusicDeleteCategoryModal
        moodKey={pendingDeleteCategory}
        moodLabel={moodLabel}
        onCancel={() => setPendingDeleteCategory(null)}
        onConfirm={confirmDeleteCategory}
      />
      <MusicDiscardChangesModal
        pending={pendingDiscard}
        message={`Discard changes to the ${moodLabel(editMood)} track list?`}
        onCancel={() => setPendingDiscard(null)}
        onConfirm={confirmPendingDiscard}
      />
      </div>
    </div>
  );

  // The player frame lives OUTSIDE the view panel: hidden views keep it
  // mounted, so ambience plays continuously wherever the user navigates.
  return (
    <>
      {visible && panel}
      {playerMounted && (
        <div className="yt-music-frame"><div id={YT_FRAME_ID}></div></div>
      )}
    </>
  );
}

export default MusicPlayer;
