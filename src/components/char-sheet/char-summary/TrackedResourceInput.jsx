
import React from 'react'
import useTrackedResource from '../../../hooks/runtime/useTrackedResource.js'
import HiddenInput from '../../common/HiddenInput.jsx'

function TrackedResourceInput({ label, resourceKey, playerName, getMax, deps, campaignName, playerStats }) {
    const [showInput, setShowInput] = React.useState(false);
    const handleToggle = () => setShowInput((s) => !s);
    const { current, max, update: handleChange } = useTrackedResource({ storageKey: resourceKey, playerName, maxGetter: getMax, deps, campaignName, playerStats });

    // Display-layer guard (belt-and-braces over useTrackedResource's clampToMax,
    // which only covers the runtime-bucket read — the _trackedResources producer
    // path can still hand back current > max): no badge ever renders an inverted
    // fraction (95/65). Render-only — never writes back. The finite-number gate
    // mirrors clampToMax's shape so boolean latches, null-as-armed and any other
    // non-numeric consumer ride their value through untouched.
    const displayCurrent = Number.isFinite(current) && Number.isFinite(max) ? Math.min(current, max) : current;

    return (
          <div className="clickable" onClick={handleToggle} onKeyDown={handleToggle} tabIndex={0}>
              <b>{label}:</b> <HiddenInput handleInputToggle={handleToggle} handleValueChange={handleChange} showInput={showInput} value={displayCurrent} max={max}></HiddenInput>/{max} <span className="text-muted">(cur/max)</span>
          </div>
      );
}

export default TrackedResourceInput;
