/* eslint-disable react/prop-types */
import React from 'react'
import storage from '../../../services/storage'
import HiddenInput from '../../common/hidden-input'

function CharClassCleric({ playerStats }) {
        const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
     // 2024 uses top-level channel_divinity, 5e uses class_specific.channel_divinity_charges
    const maxChannelDivinity = playerStats.rules === '2024'
          ? classLevel?.channel_divinity || 0
          : classLevel?.class_specific?.channel_divinity_charges || 0;
     // Destroy Undead was removed in 2024 rules, so only show for 5e
        const destroyUndeadCR = playerStats.rules === '2024'
              ? null
              : classLevel?.class_specific?.destroy_undead_cr;
    const [channelDivinityCharges, setChannelDivinityCharges] = React.useState(0);
    const [showInput, setShowInput] = React.useState(false);
    React.useEffect(() => {
        let channelDivinityCharges = storage.getProperty(playerStats.name, 'channelDivinityCharges');
        setChannelDivinityCharges(channelDivinityCharges ? channelDivinityCharges : maxChannelDivinity);
      }, [playerStats, maxChannelDivinity]);
    const handleChannelDivinityChargesToggle = () => {
        setShowInput((showInput) => !showInput);
    };
    const handleChannelDivinityChargesChange = (channelDivinityCharges) => {
        storage.setProperty(playerStats.name, 'channelDivinityCharges', channelDivinityCharges);
        setChannelDivinityCharges(channelDivinityCharges);
     };
    return (<React.Fragment>
          {playerStats.class.name === 'Cleric' && <div>
              <div className="clickable" onClick={handleChannelDivinityChargesToggle} onKeyDown={handleChannelDivinityChargesToggle} tabIndex={0}>
                  <b>Channel Divinity Charges:</b> {maxChannelDivinity}/<HiddenInput handleInputToggle={handleChannelDivinityChargesToggle} handleValueChange={(value) => handleChannelDivinityChargesChange(value)} showInput={showInput} value={channelDivinityCharges}></HiddenInput> <span className="text-muted">(max/cur)</span>
              </div>
              {destroyUndeadCR !== null && <div><b>Destroy Undead Challenge Rating: </b>{destroyUndeadCR}</div>}
          </div>}
      </React.Fragment>)
}

export default CharClassCleric
