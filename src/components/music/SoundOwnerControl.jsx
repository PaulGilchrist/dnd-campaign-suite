import { useSyncedState } from '../../hooks/runtime/useSyncedState.js';
import {
  SOUND_OWNER_KEY,
  claimSoundScreen,
  isSoundOwnerHere,
  soundScreenLabel,
} from '../../services/ui/soundOwner.js';
import './SoundOwnerControl.css';

/**
 * Sound-screen control (learnability/engagement plan Phase 5) on the Music
 * view's audio row. One button moves the ONE-SPEAKER role between the GM
 * machine and the TV screen (server-first `soundOwner` key, synced everywhere);
 * non-owner tabs show the same idiom as the ambience "playing in another
 * window" chip, so every screen knows which device is talking.
 */
function SoundOwnerControl({ campaignName }) {
  const [owner] = useSyncedState('campaign', SOUND_OWNER_KEY, null, campaignName);
  const screen = owner?.screen === 'tv' ? 'tv' : 'gm';
  const other = screen === 'gm' ? 'tv' : 'gm';
  const here = isSoundOwnerHere();

  return (
    <>
      <button
        className="music-btn"
        onClick={() => claimSoundScreen(campaignName, other)}
        aria-label={`Sound screen: ${soundScreenLabel(screen)} — move to ${soundScreenLabel(other)}`}
        title={`Combat sound plays on ${soundScreenLabel(screen)} — click to move it to ${soundScreenLabel(other)}`}
      >
        <i className={`fa-solid ${screen === 'tv' ? 'fa-tv' : 'fa-desktop'}`}></i>
      </button>
      {!here && (
        <span className="music-remote-note sound-owner-note">
          <i className="fa-solid fa-volume-high" aria-hidden="true"></i>
          <span>{`Sound plays on ${soundScreenLabel(screen)}`}</span>
        </span>
      )}
    </>
  );
}

export default SoundOwnerControl;
