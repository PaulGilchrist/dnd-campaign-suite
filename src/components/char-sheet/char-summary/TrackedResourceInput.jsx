
import React from 'react'
import useTrackedResource from '../../../hooks/runtime/useTrackedResource.js'
import HiddenInput from '../../common/HiddenInput.jsx'

function TrackedResourceInput({ label, resourceKey, playerName, getMax, deps, campaignName, playerStats }) {
    const [showInput, setShowInput] = React.useState(false);
    const handleToggle = () => setShowInput((s) => !s);
    const { current, max, update: handleChange } = useTrackedResource(resourceKey, playerName, getMax, deps, campaignName, playerStats);

    return (
          <div className="clickable" onClick={handleToggle} onKeyDown={handleToggle} tabIndex={0}>
              <b>{label}:</b> <HiddenInput handleInputToggle={handleToggle} handleValueChange={handleChange} showInput={showInput} value={current}></HiddenInput>/{max} <span className="text-muted">(cur/max)</span>
          </div>
      );
}

export default TrackedResourceInput;
