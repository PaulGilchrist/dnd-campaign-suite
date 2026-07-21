
import { applyLongRest } from '../../services/rules/effects/restRules.js'
import { hasTranceTrait } from '../../services/rules/effects/tranceRules.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../services/ui/logService.js'
import CreatureSelectionModal from './modals/shared/CreatureSelectionModal.jsx'
import React from 'react'

function LongRestButton({ playerStats, campaignName, onLongRest }) {
  const hasTrance = hasTranceTrait(playerStats)
  const [celestialResilienceModal, setCelestialResilienceModal] = React.useState(null)

  const handleCelestialResilienceConfirm = async (selectedAllies) => {
    if (!celestialResilienceModal) return;
    const { allyTempHp } = celestialResilienceModal;
    for (const ally of selectedAllies) {
      const existingTempHp = Number(getRuntimeValue(ally.name, 'tempHp', campaignName) || 0);
      setRuntimeValue(ally.name, 'tempHp', Math.max(existingTempHp, allyTempHp), campaignName);
    }
    addEntry(campaignName, {
      type: 'ability_use',
      characterName: playerStats.name,
      abilityName: 'Celestial Resilience',
      description: `${playerStats.name} grants ${allyTempHp} temporary hit points to ${selectedAllies.length} ally(ies) from Celestial Resilience (long rest).`,
      timestamp: Date.now(),
    }).catch((e) => { console.error('[celestialResilience] Error logging:', e); });
    setCelestialResilienceModal(null);
    onLongRest && onLongRest();
  };

  const handleCelestialResilienceSkip = () => {
    addEntry(campaignName, {
      type: 'ability_use',
      characterName: playerStats.name,
      abilityName: 'Celestial Resilience',
      description: `${playerStats.name} skipped ally selection for Celestial Resilience (long rest).`,
      timestamp: Date.now(),
    }).catch((e) => { console.error('[celestialResilience] Error logging:', e); });
    setCelestialResilienceModal(null);
    onLongRest && onLongRest();
  };

  const handleLongRest = async () => {
    const result = await applyLongRest(playerStats, campaignName)
    if (result?.celestialResilienceAllies) {
      setCelestialResilienceModal({
        ...result.celestialResilienceAllies,
        playerStats,
        campaignName
      });
      return;
    }
    onLongRest && onLongRest();
   };

  return (
    <>
      <button className="char-btn" onClick={handleLongRest} title={hasTrance ? "Long Rest (4 hours): restore all HP, spell slots, hit dice, and class resources" : "Long Rest: restore all HP, spell slots, hit dice, and class resources"}>
        <i className="fas fa-bed"></i> Long Rest{hasTrance ? ' (4 hours)' : ''}
      </button>
      {celestialResilienceModal && (
        <CreatureSelectionModal
          title="Celestial Resilience"
          icon="fa-shield-hart"
          targets={celestialResilienceModal.creatureTargets}
          maxTargets={celestialResilienceModal.maxTargets}
          description="Choose up to 5 allies to gain temporary hit points from your Celestial Resilience."
          note={`You gain ${celestialResilienceModal.selfTempHp} temporary hit points. Each selected ally gains ${celestialResilienceModal.allyTempHp} temporary hit points.`}
          confirmLabel="Grant Resilience"
          confirmIcon="fa-shield-hart"
          onConfirm={handleCelestialResilienceConfirm}
          onSkip={handleCelestialResilienceSkip}
        />
      )}
    </>
  );
}

export default LongRestButton;
