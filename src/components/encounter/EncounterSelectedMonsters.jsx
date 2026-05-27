import './EncounterBuilder.css';

    function EncounterSelectedMonsters({ selectedMonsters, onRemoveMonster, onViewDetails }) {
   if (!selectedMonsters || selectedMonsters.length === 0) {
     return null;
     }

   const totalMonsters = selectedMonsters.reduce((sum, m) => sum + (m.qty || 1), 0);

   return (
       <div className="encounter-selected">
         <div className="encounter-selected-title">
         Selected Monsters ({totalMonsters})
         </div>
         <div className="selected-list">
           {selectedMonsters.map((monster) => (
             <div key={monster.index} className="selected-item">
               <span className="selected-xp">{(monster.xp * (monster.qty || 1)).toLocaleString()} XP</span>
               <span className="selected-cr">CR {monster.challenge_rating}</span>
               <span className="selected-name">{monster.name}{(monster.qty || 1) > 1 ? ` (${monster.qty})` : ''}</span>
             {onViewDetails && (
               <button
                type="button"
                className="details-btn"
                onClick={() => onViewDetails(monster)}
                aria-label={`View details for ${monster.name}`}
               >
                 <i className="fa-solid fa-info-circle"></i>
               </button>
              )}
             <button
              type="button"
              className="remove-btn"
              onClick={() => onRemoveMonster(monster.index)}
              aria-label={`Remove ${monster.name}`}
             >
               &times;
             </button>
           </div>
          ))}
       </div>
     </div>
    );
}

export default EncounterSelectedMonsters;
