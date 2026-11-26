/**
 * Ambience playback engine — ONE queue, two arms (offline-ambience backlog
 * Item 3, 2026-11-25; formerly youtubePlayer.js, which this engine keeps
 * byte-faithful for the YouTube lane).
 *
 * A mood's track rows ({ kind: 'youtube' | 'local', src, title }) play in a
 * single looping queue: when a track ends the next row plays, cycling until
 * stopped — exactly one arm ever produces sound on this tab, so a mood mixing
 * YouTube videos with locally-hosted files still never double-voices.
 *
 * YouTube arm: a single hidden <iframe> (mounted by MusicPlayer) driven by the
 * IFrame API. The API rejects commands (PlayerProxy errors) until its internal
 * ready event fires, so YouTube playbacks requested pre-ready buffer behind
 * `ready` and flush in onReady (volume before first load). The API is booted
 * LAZILY: ensurePlayer() only registers the frame element, and the API script
 * is loaded only when a queue actually reaches a 'youtube' row — an
 * offline/LAN-only table playing local files never contacts youtube.com.
 *
 * Local arm: a lazily-created <audio> element playing the campaign's own
 * uploads or the repo-owned bundled CC0 beds under public/audio/ (Item 3b).
 *
 * Unplayable rows are skipped, but a full queue-pass of back-to-back failures
 * (any mix of arms) stops the loop and dispatches the 'music-queue-exhausted'
 * window event (detail { srcs }) so the UI can un-arm the mood honestly — no
 * infinite load → error → skip → wrap loop.
 */

const API_URL = 'https://www.youtube.com/iframe_api';

let player = null;
let elementId = null;      // frame element registered by MusicPlayer's mount effect
let apiLoading = false;
let bootRequested = false; // a youtube row wanted playback before the frame existed
let ready = false;
let generation = 0; // increments on dispose — late events from destroyed players are ignored
let queue = [];     // track rows { kind, src, title }
let queueIndex = 0;
let arm = null;     // 'youtube' | 'local' — which arm owns the current row
let pendingPlay = false; // current youtube row waits on ready
let pendingVolumePct = null;
let lastVolume = null;   // 0..1 last set, applied to newly created audio elements
let audio = null;        // local-arm HTMLAudioElement (lazy)
let campaignName = null;
let intentStopped = true; // true until playTracks/play is invoked
let consecutiveFailures = 0; // unplayable rows hit back-to-back since the last successful PLAYING

// ---- local-arm helpers -----------------------------------------------------

// Two honest src shapes share the 'local' kind (musicConfig.js canonical row):
// a CAMPAIGN-RELATIVE upload path ('audio/amb-….mp3') served under the
// campaign folder, and a root-ABSOLUTE bundled bed ('/audio/town-theme.mp3')
// served straight from public/ (Item 3b — repo-owned CC0 pack, offline on
// first boot). Encode every path segment — campaign names may carry spaces.
function audioUrlFor(src) {
  const tail = src.split('/').map(encodeURIComponent).join('/');
  return src.startsWith('/') ? tail : `/campaigns/${encodeURIComponent(campaignName)}/${tail}`;
}

function ensureAudio() {
  if (audio) return audio;
  const el = new Audio();
  const gen = generation;
  if (lastVolume != null) el.volume = lastVolume;
  el.addEventListener('playing', () => {
    if (gen !== generation || arm !== 'local') return;
    consecutiveFailures = 0; // a row that actually played clears the failure streak
  });
  el.addEventListener('ended', () => {
    if (gen !== generation || arm !== 'local') return;
    if (!intentStopped) advanceQueue();
  });
  el.addEventListener('error', () => {
    if (gen !== generation || arm !== 'local') return;
    reportFailure(`Local audio playback error for ${queue[queueIndex] && queue[queueIndex].src}`);
  });
  audio = el;
  return el;
}

function playAudioRow(row) {
  arm = 'local';
  pendingPlay = false; // nothing waits on the YT ready gate while the audio arm plays
  // Silence the YouTube arm on a youtube→local switch (mood swap or queue
  // advance) — a cued iframe keeps producing sound across arm changes.
  if (player && ready) player.pauseVideo();
  if (!campaignName && !row.src.startsWith('/')) {
    reportFailure(`Local audio requested with no campaign selected (${row.src})`);
    return;
  }
  const el = ensureAudio();
  el.src = audioUrlFor(row.src);
  const played = el.play();
  if (played && typeof played.catch === 'function') {
    // play() rejects when the browser blocks/fails playback (autoplay policy,
    // 404, undecodable bytes) — route it through the same failure ledger.
    played.catch((err) => {
      reportFailure(`Local audio play() rejected for ${row.src}: ${err && err.message ? err.message : err}`);
    });
  }
}

function pauseAudio() {
  if (audio) audio.pause();
}

function stopAudio() {
  if (!audio) return;
  audio.pause();
  audio.removeAttribute('src');
  audio.load(); // releases the fetched resource (HTMLMediaElement doctrine)
}

// ---- youtube-arm helpers ---------------------------------------------------

function handleStateChange(event) {
  const state = event.data;
  if (!window.YT) return;
  const { PLAYING, ENDED } = window.YT.PlayerState;
  if (state === PLAYING) {
    if (arm !== 'youtube') return; // stale-arm event (queue already moved on)
    intentStopped = false;
    consecutiveFailures = 0; // a track that actually played clears the failure streak
  } else if (state === ENDED && !intentStopped) {
    if (arm !== 'youtube') return;
    advanceQueue();
  }
}

function handleError(event) {
  // No arm guard here: every IFrame-API error lands on the current row, and
  // the post-stop undefined-slot quirk stays observable (pinned legacy face).
  const failed = queue[queueIndex];
  reportFailure(`YouTube playback error (code ${event.data}) for video ${failed && failed.src}`);
}

function bootYoutube() {
  if (player) return;
  if (window.YT && window.YT.Player) {
    createPlayer();
    return;
  }
  if (apiLoading) return;
  apiLoading = true;
  const previousReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (typeof previousReady === 'function') previousReady();
    createPlayer();
  };
  const script = document.createElement('script');
  script.src = API_URL;
  document.head.appendChild(script);
}

function createPlayer() {
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

function playYoutubeRow(row) {
  arm = 'youtube';
  stopAudio();
  if (!player) {
    // No player yet: the frame element may not be mounted either (MusicPlayer's
    // mount effect calls ensurePlayer right after the click that armed play).
    // Request the boot; the ready flush plays the CURRENT row.
    pendingPlay = true;
    bootRequested = true;
    if (elementId) {
      bootRequested = false;
      bootYoutube();
    }
    return;
  }
  if (!ready) {
    pendingPlay = true;
    return;
  }
  player.loadVideoById(row.src);
}

// ---- shared queue law --------------------------------------------------------

function playAt(index) {
  if (queue.length === 0) return;
  queueIndex = ((index % queue.length) + queue.length) % queue.length;
  playCurrent();
}

function playCurrent() {
  if (queue.length === 0) return;
  const row = queue[queueIndex];
  if (row.kind === 'local') playAudioRow(row);
  else playYoutubeRow(row);
}

function advanceQueue() {
  if (queue.length === 0) return;
  playAt(queueIndex + 1);
}

function reportFailure(reason) {
  if (intentStopped) {
    console.error(`${reason}. Skipping to next track.`);
    return;
  }
  consecutiveFailures += 1;
  if (consecutiveFailures >= queue.length) {
    // One full pass of the queue has failed back-to-back — advancing again
    // would modulo-wrap onto the same dead rows forever (error 150 loop).
    // Arm the stop intent, halt the transport, and tell the UI via the
    // repo-standard window CustomEvent so the mood can un-arm itself.
    console.error(`${reason}. No playable tracks left — stopping.`);
    const failedSrcs = queue.map(row => row.src);
    stop();
    window.dispatchEvent(new CustomEvent('music-queue-exhausted', { detail: { srcs: failedSrcs } }));
  } else {
    console.error(`${reason}. Skipping to next track.`);
    advanceQueue();
  }
}

function flushPending() {
  if (pendingVolumePct != null) {
    const pct = pendingVolumePct;
    pendingVolumePct = null;
    player.setVolume(pct);
  }
  if (pendingPlay) {
    pendingPlay = false;
    playCurrent();
  }
}

/**
 * Register the hidden frame element that hosts the YouTube arm (the mount
 * effect lane MusicPlayer runs whenever a player is armed). Booting the IFrame
 * API is LAZY: nothing contacts youtube.com until the queue actually reaches a
 * 'youtube' row, so a local-files-only (offline) mood never loads the SDK.
 */
export function ensurePlayer(id) {
  elementId = id;
  if (bootRequested) {
    bootRequested = false;
    bootYoutube();
  }
}

/**
 * Replace the queue with these track rows and start playing immediately.
 * Rows: [{ kind: 'youtube'|'local', src, title }] — the canonical music track
 * shape (musicConfig.js). campaignName names the campaign whose audio/ folder
 * serves the 'local' rows.
 */
export function playTracks(tracks, campaign) {
  if (!tracks || tracks.length === 0) {
    console.error('playTracks called with no tracks');
    return;
  }
  campaignName = campaign ?? campaignName;
  intentStopped = false;
  consecutiveFailures = 0;
  queue = [...tracks];
  queueIndex = 0;
  playCurrent();
}

export function pause() {
  if (arm === 'local') pauseAudio();
  else if (player && ready) player.pauseVideo();
}

export function resume() {
  if (arm === 'local') {
    const row = queue[queueIndex];
    if (audio && row && row.kind === 'local') {
      const played = audio.play();
      if (played && typeof played.catch === 'function') played.catch(() => {});
    }
    return;
  }
  if (player && ready) player.playVideo();
}

export function stop() {
  intentStopped = true;
  consecutiveFailures = 0;
  queue = [];
  queueIndex = 0;
  arm = null;
  pendingPlay = false;
  stopAudio();
  if (player && ready) player.stopVideo();
}

export function setVolume(volume) {
  const clamped = Math.max(0, Math.min(1, volume));
  lastVolume = clamped;
  if (audio) audio.volume = clamped;
  const pct = Math.round(clamped * 100);
  if (!player || !ready) {
    pendingVolumePct = pct;
    return;
  }
  player.setVolume(pct);
}

function resetModuleState() {
  queue = [];
  queueIndex = 0;
  arm = null;
  consecutiveFailures = 0;
  pendingPlay = false;
  pendingVolumePct = null;
  intentStopped = true;
  ready = false;
  bootRequested = false;
  generation += 1;
}

export function dispose() {
  if (player && ready && typeof player.destroy === 'function') {
    player.destroy();
  }
  player = null;
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  audio = null;
  elementId = null;
  resetModuleState();
}

// Test helper — reset module state without touching a live player.
export function _resetForTests() {
  player = null;
  apiLoading = false;
  elementId = null;
  audio = null;
  campaignName = null;
  lastVolume = null;
  resetModuleState();
}
