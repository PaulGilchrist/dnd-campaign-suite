import React from 'react';
import TrackedResourceInput from './TrackedResourceInput.jsx';

function CharRaceFeatures({ playerStats, campaignName }) {
    const breathWeaponTrait = playerStats.race?.traits?.find(t => t.name === 'Breath Weapon');
    
    if (!breathWeaponTrait) return null;
    
    const maxUses = breathWeaponTrait.automation?.uses || 1;
    
    return (
        <div className="race-features">
            <TrackedResourceInput 
                label="Breath Weapon" 
                resourceKey="breathweaponUses" 
                playerName={playerStats.name}
                getMax={() => maxUses}
                deps={[playerStats.level]}
                campaignName={campaignName}
                playerStats={playerStats}
            />
        </div>
    );
}

export default CharRaceFeatures;
