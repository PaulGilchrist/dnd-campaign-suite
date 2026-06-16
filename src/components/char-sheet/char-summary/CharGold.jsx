 
import React from 'react'

import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import HiddenInput from '../../common/HiddenInput.jsx'

function CharGold({ playerStats, campaignName }) {

    const storedGold = useRuntimeValue(playerStats.name, 'gold', campaignName);
    const gold = storedGold ?? playerStats.inventory.gold ?? 0;
    const [showInputGold, setShowInputGold] = React.useState(false);

    const handleInputToggleGold = () => {
        setShowInputGold((showInputGold) => !showInputGold);
    };
    
    const handleValueChangeGold = (value) => {
        setRuntimeValue(playerStats.name, 'gold', value, campaignName);
    };

    return (
        <div className="clickable" onClick={handleInputToggleGold} onKeyDown={handleInputToggleGold} tabIndex={0}>
            <b>Gold:</b> <HiddenInput handleInputToggle={handleInputToggleGold} handleValueChange={(value) => handleValueChangeGold(value)} showInput={showInputGold} value={gold}></HiddenInput>
        </div>
    )
}

export default CharGold
