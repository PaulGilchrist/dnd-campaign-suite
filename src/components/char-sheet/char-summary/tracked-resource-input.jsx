
import React from 'react'
import useTrackedResource from '../../../hooks/use-tracked-resource.js'
import HiddenInput from '../../common/hidden-input.jsx'

function TrackedResourceInput({ label, resourceKey, playerName, getMax, deps, displayFormat = 'max-cur' }) {
    const [showInput, setShowInput] = React.useState(false);
    const handleToggle = () => setShowInput((s) => !s);
    const { current, max, update: handleChange } = useTrackedResource(resourceKey, playerName, getMax, deps);

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
