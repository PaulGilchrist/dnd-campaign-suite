/* eslint-disable react/prop-types */
import React from 'react'
import classRules from '../../../services/class-rules'
import storage from '../../../services/storage'
import HiddenInput from '../../common/hidden-input'

function CharClassBard({ playerStats }) {
    const [bardicInspirationUses, setBardicInspirationUses] = React.useState(0);
    const [showInput, setShowInput] = React.useState(false);
    React.useEffect(() => {
        let bardicInspirationUses = storage.getProperty(playerStats.name, 'bardicInspirationUses');
        setBardicInspirationUses(bardicInspirationUses ? bardicInspirationUses : charisma.bonus);
    }, [playerStats]);
    let extraAttacks = 0;
    if(playerStats.level > 5) { // "Extra Attack" class feature at level 6
        extraAttacks = 1;
    }
    const handleBardicInspirationUsesToggle = () => {
        setShowInput((showInput) => !showInput);
    };
    const handleBardicInspirationUsesChange = (bardicInspirationUses) => {
        storage.setProperty(playerStats.name, 'bardicInspirationUses', bardicInspirationUses);
        setBardicInspirationUses(bardicInspirationUses);
    };
    const classLevel = playerStats.class?.class_levels?.[playerStats.level-1];
    	const is2024 = playerStats.rules === '2024';
	
    	// 2024 uses top-level bardic_die, 5e uses class_specific.bardic_inspiration_die
    	const bardicDie = is2024
    			? classLevel?.bardic_die || 0
    			: classLevel?.class_specific?.bardic_inspiration_die || 0;
	
    	// 5e-only features
    	const songOfRestDie = is2024 ? null : classLevel?.class_specific?.song_of_rest_die;
    	const magicalSecrets = is2024 ? null : classLevel?.class_specific?.magical_secrets_max_5 || 0;
	
    	// 5e-only subclass magical secrets (Lore)
    	let subclassMagicalSecrets = 0;
    	if(!is2024 && playerStats.class.subclass && playerStats.class.subclass.name === 'Lore' && playerStats.level > 2) {       
    		subclassMagicalSecrets = classRules.getHighestSubclassLevel(playerStats)?.subclass_specific?.additional_magical_secrets_max_lvl || 0;
    	}
	
    	const charisma = playerStats.abilities.find((ability) => ability.name === 'Charisma');
    	return (<React.Fragment>
    		{playerStats.class.name === 'Bard' && <div>
    			{/* 5e only: Extra Attacks */}
    			{!is2024 && extraAttacks > 0 && <div><b>Extra Attacks: </b>{extraAttacks}</div>}
    			<div>
    				<b>Bardic Inspiration Die: </b>d{bardicDie}
    			<span className="clickable" onClick={handleBardicInspirationUsesToggle} onKeyDown={handleBardicInspirationUsesToggle} tabIndex={0}>
    				&nbsp;&nbsp;<b>Uses:</b> {charisma.bonus}/<HiddenInput handleInputToggle={handleBardicInspirationUsesToggle} handleValueChange={(value) => handleBardicInspirationUsesChange(value)} showInput={showInput} value={bardicInspirationUses}></HiddenInput> <span className="text-muted">(max/cur)</span>
    			</span>
    		</div>
    			{/* 5e only: Song of Rest */}
    			{!is2024 && songOfRestDie && <div><b>Song of Rest Die: </b>d{songOfRestDie}</div>}
    			{/* 5e only: Magical Secrets count */}
    			{!is2024 && magicalSecrets !== null && <div><b>Magical Secrets: </b>{magicalSecrets + subclassMagicalSecrets}</div>}
    		{playerStats.level > 2 && playerStats.class.expertise && <div><b>Expertise: </b>{playerStats.class.expertise.join(', ')}</div>}
    	</div>}
    	</React.Fragment>)
}

export default CharClassBard

