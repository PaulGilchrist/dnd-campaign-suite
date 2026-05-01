/* eslint-disable react/prop-types */
import React from 'react'
import HiddenInput from '../../common/hidden-input'
import classRules from '../../../services/class-rules'
import classRules2024 from '../../../services/class-rules-2024'
import storage from '../../../services/storage'

function CharClassDruid({ playerStats }) {
    const [wildShapeUses, setWildShapeUses] = React.useState(0);
    const [showInput, setShowInput] = React.useState(false);
    const is2024 = playerStats.rules === '2024';
    
    React.useEffect(() => {
        let wildShapeUses = storage.getProperty(playerStats.name, 'wildShapeUses');
        const maxUses = is2024 ? classRules2024.getDruidWildShapeUses(playerStats) : 2;
        if(playerStats.level > 1) {
            setWildShapeUses(wildShapeUses ? wildShapeUses : maxUses);
         }
     }, [playerStats, is2024]);
    
    const handleWildShapeUsesToggle = () => {
        setShowInput((showInput) => !showInput);
    };
    const handleWildShapeUsesChange = (wildShapeUses) => {
        storage.setProperty(playerStats.name, 'wildShapeUses', wildShapeUses);
        setWildShapeUses(wildShapeUses);
     };
    
    const classLevel = playerStats.class?.class_levels?.[playerStats.level-1];
    
    let maxWildShapeChallengeRating;
        let maxWildShapeUses;
        let beastKnownForms;
        let canFly;
        let wildShapeLimitations;
    
        if (is2024) {
            maxWildShapeChallengeRating = classRules2024.getDruidMaxWildShapeChallengeRating(playerStats);
            maxWildShapeUses = classRules2024.getDruidWildShapeUses(playerStats);
            beastKnownForms = classRules2024.getDruidBeastKnownForms(playerStats);
            canFly = classRules2024.getDruidBeastFlySpeed(playerStats);
            wildShapeLimitations = canFly ? 'walk, swim, or fly' : 'walk or swim only (no fly)';
           } else {
            const classSpecific = classLevel.class_specific;
            maxWildShapeChallengeRating = classRules.getDruidMaxWildShapeChallengeRating(playerStats);
            maxWildShapeUses = 2;
            wildShapeLimitations = classSpecific.wild_shape_fly ? 'walk, swim, or fly' : classSpecific.wild_shape_swim ? 'walk or swim only (no fly)' : 'walk only (no swim or fly)';
           }
    
        return (<React.Fragment>
               {playerStats.class.name === 'Druid' && playerStats.level >= 2 && <div>
                   <div className="clickable" onClick={handleWildShapeUsesToggle} onKeyDown={handleWildShapeUsesToggle} tabIndex={0}>
                       <b>Wild Shape Uses:</b> {maxWildShapeUses}/<HiddenInput handleInputToggle={handleWildShapeUsesToggle} handleValueChange={(value) => handleWildShapeUsesChange(value)} showInput={showInput} value={wildShapeUses}></HiddenInput> <span className="text-muted">(max/cur)</span>
                   </div>
                   <div><b>Wild Shape Max Challenge Rating: </b>{maxWildShapeChallengeRating}</div>
                   {is2024 && <div><b>Beast Forms Known: </b>{beastKnownForms}</div>}
                   <div><b>Wild Shape Limitations: </b>{wildShapeLimitations}</div>
               </div>}
           </React.Fragment>)
}

export default CharClassDruid
