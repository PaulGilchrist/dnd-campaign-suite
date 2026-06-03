
import React from 'react'
import useTrackedResource from '../../../hooks/useTrackedResource.js'
import HiddenInput from '../../common/HiddenInput.jsx'

function TrackedResourceInput({ label, resourceKey, playerName, getMax, deps, displayFormat = 'max-cur', campaignName }) {
    const [showInput, setShowInput] = React.useState(false);
    const handleToggle = () => setShowInput((s) => !s);
    const { current, max, update: handleChange } = useTrackedResource(resourceKey, playerName, getMax, deps, campaignName);

    if (displayFormat === 'cur-max') {
        return (
            <div className="clickable" onClick={handleToggle} onKeyDown={handleToggle} tabIndex={0}>
                <b>{label}:</b> {current}/{max}<HiddenInput handleInputToggle={handleToggle} handleValueChange={handleChange} showInput={showInput} value={current} displayValue={false}></HiddenInput> <span className="text-muted">(cur/max)</span>
            </div>
        );
    }

    return (
        <div className="clickable" onClick={handleToggle} onKeyDown={handleToggle} tabIndex={0}>
            <b>{label}:</b> {max}/<HiddenInput handleInputToggle={handleToggle} handleValueChange={handleChange} showInput={showInput} value={current}></HiddenInput> <span className="text-muted">(max/cur)</span>
        </div>
    );
}

export default TrackedResourceInput;
