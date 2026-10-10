/**
 * YouTube IFrame API player singleton for GM background music.
 *
 * A single hidden <iframe> is mounted (by MusicPlayer) and reused across
 * mood changes. Tracks play in a looping queue: when a video ends the next
 * track in the current mood plays, cycling forever until stopped.
 *
 * The IFrame API rejects commands (PlayerProxy errors) until its internal
 * ready event fires, so all commands are gated behind `ready` and buffered
 * commands (volume, tracks) are flushed in onReady. Tracks are cued one at
 * a time with loadVideoById — no loadPlaylist/playVideoAt race.
 *
 * Playback is GM-only (localhost) and always triggered by a user click, so
 * browser autoplay policies are satisfied.
 */

const API_URL = 'https://www.youtube.com/iframe_api';

let player = null;
let apiLoading = false;
let ready = false;
let generation = 0; // increments on dispose — late events from destroyed players are ignored
let queue = [];
let queueIndex = 0;
let pendingTrackIds = null;
let pendingVolumePct = null;
let isPlaying = false;
let intentStopped = true; // true until playTracks/play is invoked

const listeners = new Set();

function notify() {
  for (const fn of listeners) fn({ playing: isPlaying });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function handleStateChange(event) {
  const state = event.data;
  if (!window.YT) return;
  const { PLAYING, PAUSED, ENDED } = window.YT.PlayerState;
  if (state === PLAYING) {
    isPlaying = true;
    intentStopped = false;
    notify();
  } else if (state === PAUSED) {
    isPlaying = false;
    notify();
  } else if (state === ENDED && !intentStopped) {
    advanceQueue();
  }
}

function handleError(event) {
  const failed = queue[queueIndex];
  console.error(`YouTube playback error (code ${event.data}) for video ${failed}. Skipping to next track.`);
  if (!intentStopped) advanceQueue();
}

function playAt(index) {
  if (!player || queue.length === 0) return;
  queueIndex = ((index % queue.length) + queue.length) % queue.length;
  if (!ready) return;
  player.loadVideoById(queue[queueIndex]);
}

function advanceQueue() {
  if (!player || queue.length === 0) return;
  playAt(queueIndex + 1);
}

function flushPending() {
  if (pendingVolumePct != null) {
    const pct = pendingVolumePct;
    pendingVolumePct = null;
    player.setVolume(pct);
  }
  if (pendingTrackIds && pendingTrackIds.length > 0) {
    queue = [...pendingTrackIds];
    pendingTrackIds = null;
    playAt(0);
  }
}

function createPlayer(elementId) {
  const gen = ++generation;
  player = new window.YT.Player(elementId, {
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1 },
    events: {
      onReady: () => {
        if (gen !== generation) return;
        ready = true;
        flushPending();
      },
      onStateChange: (event) => {
        if (gen !== generation) return;
        handleStateChange(event);
      },
      onError: (event) => {
        if (gen !== generation) return;
        handleError(event);
      }
    }
  });
}

/**
 * Load the YouTube IFrame API (once) and create the singleton player inside
 * the container element with the given id.
 */
export function ensurePlayer(elementId) {
  if (player) return;
  if (window.YT && window.YT.Player) {
    createPlayer(elementId);
    return;
  }
  if (apiLoading) return;
  apiLoading = true;
  const previousReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (typeof previousReady === 'function') previousReady();
    createPlayer(elementId);
  };
  const script = document.createElement('script');
  script.src = API_URL;
  document.head.appendChild(script);
}

/** Replace the queue with these video ids and start playing immediately. */
export function playTracks(videoIds) {
  if (!videoIds || videoIds.length === 0) {
    console.error('playTracks called with no video ids');
    return;
  }
  intentStopped = false;
  queue = [...videoIds];
  queueIndex = 0;
  if (!player) {
    pendingTrackIds = [...videoIds];
    return;
  }
  if (!ready) {
    pendingTrackIds = [...videoIds];
    return;
  }
  playAt(0);
}

export function pause() {
  if (player && ready) player.pauseVideo();
}

export function resume() {
  if (player && ready) player.playVideo();
}

export function stop() {
  intentStopped = true;
  queue = [];
  queueIndex = 0;
  pendingTrackIds = null;
  isPlaying = false;
  if (player && ready) player.stopVideo();
  notify();
}

export function setVolume(volume) {
  const pct = Math.max(0, Math.min(100, Math.round(volume * 100)));
  if (!player || !ready) {
    pendingVolumePct = pct;
    return;
  }
  player.setVolume(pct);
}

export function isPlayingNow() {
  return isPlaying;
}

function resetModuleState() {
  queue = [];
  queueIndex = 0;
  pendingTrackIds = null;
  pendingVolumePct = null;
  isPlaying = false;
  intentStopped = true;
  ready = false;
  generation += 1;
}

export function dispose() {
  if (player && ready && typeof player.destroy === 'function') {
    player.destroy();
  }
  player = null;
  resetModuleState();
}

// Test helper — reset module state without touching a live player.
export function _resetForTests() {
  player = null;
  apiLoading = false;
  resetModuleState();
  listeners.clear();
}
