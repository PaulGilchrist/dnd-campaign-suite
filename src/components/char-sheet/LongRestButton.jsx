
import storage from '../../services/storage.js'

function LongRestButton({ playerStats, campaignName, onLongRest }) {
  const handleLongRest = () => {
    const name = playerStats.name;

    storage.setProperty(name, 'currentHitPoints', playerStats.hitPoints, campaignName);

    if (playerStats.spellAbilities) {
      for (let level = 1; level <= 9; level++) {
        const key = `spell_slots_level_${level}`;
        const max = playerStats.spellAbilities[key];
        if (max != null) {
          storage.setProperty(name, key, max, campaignName);
        }
      }
    }

    storage.setProperty(name, 'shortRestHitDice', playerStats.level, campaignName);

    const classResources = [
      'ragePoints',
      'bardicInspirationUses',
      'channelDivinityCharges',
      'wildShapeUses',
      'secondWindUses',
      'psionicEnergy',
      'focusPoints',
      'sorceryPoints',
      'arcaneRecoveryLevels',
    ];
    classResources.forEach((key) => {
      storage.setProperty(name, key, null, campaignName);
    });

    onLongRest && onLongRest();
  };

  return (
    <button className="char-btn" onClick={handleLongRest} title="Long Rest: restore all HP, spell slots, hit dice, and class resources">
      <i className="fas fa-bed"></i> Long Rest
    </button>
  );
}

export default LongRestButton;
