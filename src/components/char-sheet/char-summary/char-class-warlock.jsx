/* eslint-disable react/prop-types */
import React from 'react'
import classRules2024 from '../../../services/class-rules-2024'

function CharClassWarlock({ playerStats }) {
    const is2024 = playerStats.rules === '2024';
    let invocationsKnown = 0;

    if (is2024) {
        invocationsKnown = classRules2024.getEldritchInvocations(playerStats);
     } else {
        const classLevel = playerStats.class?.class_levels?.[playerStats.level-1];
        const classSpecific = classLevel?.class_specific;
        invocationsKnown = classSpecific?.invocations_known || 0;
    }

    return (<React.Fragment>
         {playerStats.class.name === 'Warlock' && <div>
             {playerStats.level > 10 && !is2024 && <React.Fragment>
                 {(() => {
                     const classLevel = playerStats.class?.class_levels?.[playerStats.level-1];
                     const classSpecific = classLevel?.class_specific;
                     return (
                         <div><b>Arcanums Known (levels 6-9): </b>{classSpecific?.mystic_arcanum_level_6 || 0}, {classSpecific?.mystic_arcanum_level_7 || 0}, {classSpecific?.mystic_arcanum_level_8 || 0}, {classSpecific?.mystic_arcanum_level_9 || 0}</div>
                     );
                 })()}
                 {playerStats.class.arcanums && <div>
                     <b>Arcanums: </b>{playerStats.class.arcanums.sort().join(', ')}
                 </div>}
             </React.Fragment>}
             <div><b>{is2024 ? 'Eldritch Invocations' : 'Invocations Known'}: </b>{invocationsKnown}</div>
             {playerStats.class.invocations && <div>
                 <b>Invocations: </b>{playerStats.class.invocations.sort().join(', ')}
             </div>}
             {playerStats.class.pactBoon && <div><b>Pact Boon: </b>{playerStats.class.pactBoon}</div>}
             {playerStats.class.eldritchInvocations && playerStats.class.eldritchInvocations.length > 0 && <div><b>Eldritch Invocations List: </b>{playerStats.class.eldritchInvocations.join(', ')}</div>}
         </div>}
     </React.Fragment>)
}

export default CharClassWarlock
