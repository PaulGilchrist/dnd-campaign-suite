import Popup from '../common/popup.jsx'
import MetamagicPopup from './popups/MetamagicPopup.jsx'
import MultiTargetCountPopup from './popups/MultiTargetCountPopup.jsx'
import TargetWithCheckboxesPopup from './popups/TargetWithCheckboxesPopup.jsx'
import MagicMissileTargetPopup from './popups/MagicMissileTargetPopup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js'
import { getCombatSummary } from '../../services/encounters/combatData.js'

export default function CharActionSpellPopups({
    playerStats,
    campaignName,
    selectedActionSpell,
    setSelectedActionSpell,
    buildUpcastLevels,
    handleActionSpellCast,
    actionPendingMetamagic,
    actionHandleConfirm,
    actionHandleSkip,
    actionPendingAid,
    actionHandleAidConfirm,
    actionHandleAidSkip,
    actionPendingGreaterRestoration,
    actionHandleGreaterRestorationConfirm,
    actionHandleGreaterRestorationSkip,
    actionPendingRemoveCurse,
    actionHandleRemoveCurseConfirm,
    actionHandleRemoveCurseSkip,
    actionPendingMagicMissile,
    actionHandleMagicMissileConfirm,
    actionHandleMagicMissileSkip,
    pendingActionMetamagic,
    handleActionMetamagicConfirm,
    handleActionMetamagicSkip,
}) {
    return (
        <>
            {selectedActionSpell && (
                <Popup onClickOrKeyDown={() => setSelectedActionSpell(null)}>
                    <SpellDetailPopup
                        spell={selectedActionSpell}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        playerLevel={playerStats.level}
                        upcastLevels={buildUpcastLevels(selectedActionSpell)}
                        onClose={() => setSelectedActionSpell(null)}
                        onCast={handleActionSpellCast}
                    />
                </Popup>
            )}
            {actionPendingMetamagic && (
                <MetamagicPopup
                    spell={{ name: actionPendingMetamagic.spellName, level: actionPendingMetamagic.spellLevel || 0 }}
                    playerStats={{ ...playerStats, _metamagicCurrentSP: actionPendingMetamagic._currentSP }}
                    campaignName={campaignName}
                    onConfirm={actionHandleConfirm}
                    onSkip={actionHandleSkip}
                />
            )}
            {actionPendingAid && (
                <MultiTargetCountPopup
                    spell={{ name: actionPendingAid.spellName, level: actionPendingAid.spellLevel || 0 }}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    range={actionPendingAid.range}
                    rangeFt={actionPendingAid.rangeFt}
                    creatureTargets={actionPendingAid.creatureTargets}
                    maxTargets={actionPendingAid.maxTargets}
                    attackerPos={actionPendingAid.attackerPos}
                    onConfirm={actionHandleAidConfirm}
                    onSkip={actionHandleAidSkip}
                />
            )}
            {actionPendingGreaterRestoration && (
                <TargetWithCheckboxesPopup
                    spell={{ name: actionPendingGreaterRestoration.spellName, level: actionPendingGreaterRestoration.spellLevel || 0 }}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    creatureTargets={actionPendingGreaterRestoration.creatureTargets}
                    range={actionPendingGreaterRestoration.range}
                    onConfirm={actionHandleGreaterRestorationConfirm}
                    onSkip={actionHandleGreaterRestorationSkip}
                />
            )}
            {actionPendingRemoveCurse && (
                <TargetWithCheckboxesPopup
                    spell={{ name: actionPendingRemoveCurse.spellName, level: actionPendingRemoveCurse.spellLevel || 0 }}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    creatureTargets={actionPendingRemoveCurse.creatureTargets}
                    range={actionPendingRemoveCurse.range}
                    onConfirm={actionHandleRemoveCurseConfirm}
                    onSkip={actionHandleRemoveCurseSkip}
                />
            )}
            {actionPendingMagicMissile && (() => {
              const { spell, totalMissiles, missileDamage, creatureTargets } = actionPendingMagicMissile;
              const currentTargetName = getTargetFromAttacker(getCombatSummary(campaignName), playerStats.name)?.name;
              return (
                <MagicMissileTargetPopup
                  spell={{ name: spell.name, level: spell.level || 0 }}
                  playerStats={playerStats}
                  campaignName={campaignName}
                  totalMissiles={totalMissiles}
                  missileDamage={missileDamage}
                  creatureTargets={creatureTargets}
                  currentTargetName={currentTargetName}
                  onConfirm={actionHandleMagicMissileConfirm}
                  onSkip={actionHandleMagicMissileSkip}
                />
              );
            })()}
            {pendingActionMetamagic && (
                <MetamagicPopup
                    spell={{ name: pendingActionMetamagic.spellName, level: pendingActionMetamagic.spellLevel || 0 }}
                    playerStats={{ ...playerStats, _metamagicCurrentSP: pendingActionMetamagic._currentSP }}
                    campaignName={campaignName}
                    onConfirm={handleActionMetamagicConfirm}
                    onSkip={handleActionMetamagicSkip}
                />
            )}
        </>
    )
}
