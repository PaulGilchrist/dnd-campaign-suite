import React, { useState, useMemo } from 'react';
import { sanitizeHtml } from '../../../services/ui/sanitize.js';
import { getRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { getOverchannelNecroticDamage } from '../../../services/automation/handlers/class-wizard/overchannelHandler.js';
import { isPsionicSpell, hasPsionicSorcery } from '../../../services/rules/spells/metamagicRules.js';
import { isFreeCastAuthorized } from '../../../services/rules/spells/spellPreparationService.js';
import { getConsumedMaterial } from '../../../services/rules/spells/materialComponents.js';
import { hasMaterial } from '../../../services/rules/spells/materialComponents.js';
import { isSpellBreakerBonusActionSpell } from '../../../services/ui/spellSectionUtils.js';

function computeCanCast({ isRaging, isCantrip, quickRitualActive, isUpcastable, hasAnySlots, freeCastAuthorized, spell, playerStats, isWarlock, warlockSlotLevel, psionicSorceryAvailable }) {
  if (!isRaging) {
    if (isCantrip || quickRitualActive) return true;
    if (isUpcastable) return hasAnySlots;
    return freeCastAuthorized || (() => {
      const baseKey = `spell_slots_level_${spell.level}`;
      const stored = getRuntimeValue(playerStats.name, baseKey);
      const max = (playerStats.spellAbilities && playerStats.spellAbilities[baseKey]) || 0;
      return (stored != null ? stored : max) > 0;
    })() || (isWarlock && warlockSlotLevel !== null) || (psionicSorceryAvailable >= spell.level);
  }
  return false;
}

function SlotsRemainingText({ isWarlock, warlockSlotLevel, spell, playerStats, psionicSorceryAvailable }) {
  const displayKey = isWarlock && warlockSlotLevel ? `spell_slots_level_${warlockSlotLevel}` : `spell_slots_level_${spell.level}`;
  const stored = getRuntimeValue(playerStats.name, displayKey);
  const max = (playerStats.spellAbilities && playerStats.spellAbilities[displayKey]) || 0;
  const slots = stored != null ? stored : max;
  let psionicSuffix = null;
  if (psionicSorceryAvailable > 0) {
    const baseKey = `spell_slots_level_${spell.level}`;
    const baseStored = getRuntimeValue(playerStats.name, baseKey);
    const baseMax = (playerStats.spellAbilities && playerStats.spellAbilities[baseKey]) || 0;
    const baseSlots = baseStored != null ? baseStored : baseMax;
    psionicSuffix = baseSlots > 0 ? ` or ${psionicSorceryAvailable} SP` : `${psionicSorceryAvailable} SP`;
  }
  return <>{slots > 0 ? `${slots} slot${slots !== 1 ? 's' : ''}` : slots}{psionicSuffix}</>;
}

function FreeCastNotices({ freeCastAuthorized, isShadowArtsFreeCast, isPhantasmalFreeCast, shadowArtsFreeCastCount, spell, canCast, isCantrip }) {
  return (
    <>
      {freeCastAuthorized && spell._ritualOnly && (
        <p className="spell-detail-free-cast"><i className="fa-solid fa-scroll"></i> Ritual Cast — cast as a Ritual, no spell slot consumed</p>
      )}
      {freeCastAuthorized && !spell._ritualOnly && !isShadowArtsFreeCast && (
        <p className="spell-detail-free-cast"><i className="fa-solid fa-bolt"></i> Free Cast — no spell slot consumed</p>
      )}
      {freeCastAuthorized && isShadowArtsFreeCast && (
        <p className="spell-detail-free-cast"><i className="fa-solid fa-moon"></i> Shadow Arts free cast — no spell slot consumed ({shadowArtsFreeCastCount} use{shadowArtsFreeCastCount === 1 ? '' : 's'} of {spell.name} left until your next Long Rest)</p>
      )}
      {isPhantasmalFreeCast && (
        <p className="spell-detail-free-cast"><i className="fa-solid fa-ghost"></i> Phantasmal Creatures free cast — spectral Illusion version, half HP</p>
      )}
      {!canCast && !isCantrip && !freeCastAuthorized && isShadowArtsFreeCast && (
        <p className="spell-detail-no-slots"><i className="fa-solid fa-moon"></i> Shadow Arts: {spell.name} already cast — finish a Long Rest to regain it.</p>
      )}
      {!canCast && !isCantrip && !freeCastAuthorized && !isShadowArtsFreeCast && (
        <p className="spell-detail-no-slots">No spell slots available for this level.</p>
      )}
    </>
  );
}

function computeIsUpcastable(spell, isCantrip) {
  const slotDmg = spell.damage?.damage_at_slot_level;
  const healAtSlotLevel = spell.heal_at_slot_level;
  const upcastAtSlot = spell.upcast_at_slot_level;
  return !isCantrip && ((slotDmg && Object.keys(slotDmg).length > 1) || (healAtSlotLevel && Object.keys(healAtSlotLevel).length > 1) || (upcastAtSlot && Object.keys(upcastAtSlot).length > 1));
}

function SpellMeta({ isCantrip, spell, isPhantasmalFreeCast, isDispelMagicAsBonusAction, isWarlock, warlockSlotLevel, playerStats, showUpcastSelector, psionicSorceryAvailable }) {
  return (
    <div className="spell-detail-meta">
      <span><b>Level:</b> {isCantrip ? 'Cantrip' : spell.level}</span>
      {/* CLA-322: Spell Breaker converts its bonusActionSpells to Bonus Action display */}
      <span><b>Casting Time:</b> {isDispelMagicAsBonusAction ? 'Bonus Action' : (spell.casting_time || '—')}</span>
      <span><b>Range:</b> {spell.range || '—'}</span>
      <span><b>Duration:</b> {spell.duration || '—'}</span>
      {spell.school && <span><b>School:</b> {isPhantasmalFreeCast ? 'Illusion (spectral)' : spell.school}</span>}
      {/* CLA-234: per-spell casting-ability override (e.g. Nature Speaker — Wisdom) */}
      {spell.spellCastingAbility && <span><b>Casting Ability:</b> {spell.spellCastingAbility}</span>}
      {spell.area_of_effect && <span><b>Area:</b> {spell.area_of_effect.type || spell.area_of_effect.shape}{spell.area_of_effect.size ? ` - ${spell.area_of_effect.size}` : ''}</span>}
      {!isCantrip && !showUpcastSelector && (
        <span><b>Slots Remaining:</b> <SlotsRemainingText isWarlock={isWarlock} warlockSlotLevel={warlockSlotLevel} spell={spell} playerStats={playerStats} psionicSorceryAvailable={psionicSorceryAvailable} /></span>
      )}
    </div>
  );
}

function computeSpellDetailPassiveFlags(playerStats, spell, isWarlock) {
  const hasPsychicSpells = playerStats.automation?.passives?.some(p => p.type === 'psychic_spells');
  const hasImprovedIllusions = playerStats.automation?.passives?.some(p => p.type === 'improved_illusions');
  const hasOverchannelPassive = playerStats?.automation?.passives?.some(p => p.type === 'overchannel');
  const hasDamage = !!spell.damage;
  const isEnchantmentOrIllusion = () => {
    const school = (spell.school || '').toLowerCase();
    return school === 'enchantment' || school === 'illusion';
  };
  const isIllusionSpell = () => {
    const school = (spell.school || '').toLowerCase();
    return school === 'illusion';
  };
  return {
    canChangeDamageType: isWarlock && hasPsychicSpells && hasDamage,
    noVSComponents: isWarlock && hasPsychicSpells && isEnchantmentOrIllusion(),
    noVComponents: hasImprovedIllusions && isIllusionSpell(),
    isOverchannelApplicable: hasOverchannelPassive && hasDamage && spell.level >= 1 && spell.level <= 5,
  };
}

function OverchannelSection({ isOverchannelApplicable, useOverchannel, onToggleOverchannel, overchannelDamage, nextOverchannelUse }) {
  if (!isOverchannelApplicable) return null;
  return (
    <div className="spell-detail-upcast">
      <label>
        <input
          type="checkbox"
          checked={useOverchannel}
          onChange={onToggleOverchannel}
        />
        <span>Overchannel (Maximize Damage)&nbsp;</span>
      </label>
      {overchannelDamage && overchannelDamage.expression && (
        <div className="spell-detail-overchannel-warning">
          <i className="fa-solid fa-skull"></i> Warning: Using Overchannel this time (use #{nextOverchannelUse}) will deal <strong>{overchannelDamage.expression}</strong> Necrotic damage to you (ignores resistance/immunity). First use deals no damage.
        </div>
      )}
      {overchannelDamage === 0 && useOverchannel && (
        <div className="spell-detail-overchannel-info">
          <i className="fa-solid fa-shield-halved"></i> First use: no necrotic damage
        </div>
      )}
    </div>
  );
}

function QuickRitualSection({ isRitualMasterSpell, quickRitualActive, quickRitualUsed, onToggleQuickRitual }) {
  if (!isRitualMasterSpell) return null;
  return (
    <div className="spell-detail-upcast">
      <label>
        <input
          type="checkbox"
          checked={quickRitualActive}
          disabled={quickRitualUsed}
          onChange={onToggleQuickRitual}
        />
        <span><i className="fa-solid fa-bolt"></i> Quick Ritual — regular casting time, no spell slot (once per Long Rest)</span>
      </label>
      {quickRitualUsed && (
        <p className="spell-detail-no-slots"><i className="fa-solid fa-moon"></i> Quick Ritual already used — finish a Long Rest to regain it.</p>
      )}
    </div>
  );
}

function PsychicDamageCheckbox({ usePsychicDamage, onTogglePsychicDamage }) {
  return (
    <div className="spell-detail-upcast">
      <label>
        <input
          type="checkbox"
          checked={usePsychicDamage}
          onChange={onTogglePsychicDamage}
        />
        <span>Change damage type to Psychic</span>
      </label>
    </div>
  );
}

function computeHasAnySlots({ isCantrip, freeCastAuthorized, upcastLevels, isWarlock, warlockSlotLevel, psionicSorceryAvailable }) {
  return isCantrip || freeCastAuthorized || upcastLevels.some(l => l.availableSlots > 0) || (isWarlock && warlockSlotLevel !== null) || psionicSorceryAvailable > 0;
}

// CLA-252: Phantasmal Creatures free cast — spectral Illusion version, halved HP.
function computeIsPhantasmalFreeCast(playerStats, spell, freeCastAuthorized) {
  if (!freeCastAuthorized) return false;
  const phantasmalPassive = playerStats?.automation?.passives?.find(p => p.type === 'phantasmal_creatures');
  return !!phantasmalPassive && (phantasmalPassive.freeCastSpells || []).includes(spell.name);
}

function SpellDetailPopup({ spell, playerStats, campaignName, onClose, onCast, upcastLevels = [], playerLevel = 1 }) {
  const isCantrip = spell.level === 0;
  const slotDmg = spell.damage?.damage_at_slot_level;
  const charDmg = spell.damage?.damage_at_character_level;
  const isUpcastable = computeIsUpcastable(spell, isCantrip);

  // CLA-312: free-cast authorization is gated on the EFFECTIVE cast level —
  // selecting a higher upcast level here must revoke the free-cast affordance
  // (Signature Spells / Spell Mastery free casts are fixed to their base level).
  const [selectedUpcastLvl, setSelectedUpcastLvl] = useState(() => {
    const firstAvailable = upcastLevels.find(l => l.availableSlots > 0);
    return firstAvailable ? String(firstAvailable.level) : String(upcastLevels[0]?.level || spell.level);
  });
  const gateSpellLevel = isUpcastable ? (Number(selectedUpcastLvl) || spell.level) : spell.level;
  const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, spell.name, gateSpellLevel, playerStats, campaignName);

  // CLA-252: Phantasmal Creatures free cast — spectral Illusion version, halved HP.
  const isPhantasmalFreeCast = computeIsPhantasmalFreeCast(playerStats, spell, freeCastAuthorized);

  // CLA-308: Shadow Arts — per-spell once-per-Long-Rest slotless free cast counter
  // (null = fresh) for the remaining-uses note on the popup.
  const isShadowArtsFreeCast = spell._shadowArtsFreeCast === true;
  const shadowArtsFreeCastCount = useMemo(() => {
    if (!isShadowArtsFreeCast) return null;
    const stored = getRuntimeValue(playerStats.name, `_Shadow_Arts_${spell.name.replace(/\s+/g, '_')}_freeCastCount`, campaignName);
    return stored != null ? Number(stored) : 1;
  }, [isShadowArtsFreeCast, playerStats.name, spell.name, campaignName]);

  // FT-068: Ritual Master Quick Ritual — a prepared granted ritual spell castable at
  // its regular casting time without a spell slot, once per Long Rest
  // (_Ritual_Master_quickRitualUsed, reset by restRules-longRest).
  const isRitualMasterSpell = spell._ritualMasterRitual === true && !!spell.ritual;
  const quickRitualUsedTrigger = useRuntimeValue(playerStats.name, '_Ritual_Master_quickRitualUsed', campaignName);
  const quickRitualUsed = useMemo(() => !!quickRitualUsedTrigger, [quickRitualUsedTrigger]);
  const [useQuickRitual, setUseQuickRitual] = useState(false);
  const quickRitualActive = isRitualMasterSpell && useQuickRitual && !quickRitualUsed;

  const _psionicSorceryAvailable = (() => {
    const isSorcerer = playerStats.class?.name === 'Sorcerer';
    if (!isSorcerer) return 0;
    if (!isPsionicSpell(playerStats, spell.name)) return 0;
    if (!hasPsionicSorcery(playerStats)) return 0;
    if (isCantrip) return 0;
    const currentSP = Number(getRuntimeValue(playerStats.name, 'sorceryPoints') ?? 0);
    return currentSP;
  })();

  const isWarlock = playerStats.class?.name === 'Warlock';
  const getWarlockSlotLevel = (minLevel) => {
    if (!isWarlock) return null;
    for (let lv = minLevel; lv <= 9; lv++) {
      const key = `spell_slots_level_${lv}`;
      const max = (playerStats.spellAbilities && playerStats.spellAbilities[key]) || 0;
      const current = getRuntimeValue(playerStats.name, key);
      const available = current != null ? current : max;
      if (available > 0) return lv;
    }
    return null;
  };
  const warlockSlotLevel = getWarlockSlotLevel(spell.level);
  const hasAnySlots = computeHasAnySlots({ isCantrip, freeCastAuthorized, upcastLevels, isWarlock, warlockSlotLevel, psionicSorceryAvailable: _psionicSorceryAvailable });

  // CLA-322: Spell Breaker bonus-action conversion is registry-driven (bonusActionSpells)
  const isDispelMagicAsBonusAction = isSpellBreakerBonusActionSpell(playerStats, spell.name);
  const passiveFlags = computeSpellDetailPassiveFlags(playerStats, spell, isWarlock);
  const { canChangeDamageType, isOverchannelApplicable } = passiveFlags;
  const [usePsychicDamage, setUsePsychicDamage] = useState(false);
  const [noVSComponents] = useState(passiveFlags.noVSComponents);
  const [noVComponents] = useState(passiveFlags.noVComponents);

  const [usePsionicPayment, setUsePsionicPayment] = useState(false);
   const [useOverchannel, setUseOverchannel] = useState(false);
    const overchannelUseTrigger = useRuntimeValue(playerStats.name, 'Overchannel_useCount', campaignName);
    const overchannelUseCount = useMemo(() => {
      if (!isOverchannelApplicable) return 0;
      const value = overchannelUseTrigger ?? 0;
      return value;
   }, [isOverchannelApplicable, playerStats.name, campaignName, overchannelUseTrigger]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextOverchannelUse = overchannelUseCount + 1;
  const overchannelDamage = useMemo(() => {
    if (!isOverchannelApplicable || !useOverchannel) return null;
    const damage = getOverchannelNecroticDamage(spell.level, nextOverchannelUse);
    return damage;
  }, [isOverchannelApplicable, useOverchannel, spell.level, nextOverchannelUse]);

  const cantripAutoLevel = useMemo(() => {
    if (!isCantrip) return null;
    const dmgObj = (charDmg && Object.keys(charDmg).length) ? charDmg : (slotDmg && Object.keys(slotDmg).length ? slotDmg : null);
    if (!dmgObj) return null;
    const levels = Object.keys(dmgObj).map(Number).sort((a, b) => a - b);
    const applicable = levels.filter(l => l <= playerLevel);
    return applicable.length > 0 ? Math.max(...applicable) : null;
  }, [isCantrip, charDmg, slotDmg, playerLevel]);

  const handleCast = () => {
    if (!canCast) return;
    const metaCtx = { overchannel: useOverchannel };
    if (isDispelMagicAsBonusAction) {
      const profBonus = Math.floor((playerStats.level - 1) / 4 + 2);
      metaCtx.dispelAbilityCheckBonus = profBonus;
    }

    const isUpcast = isUpcastable && Number(selectedUpcastLvl) !== spell.level;
    const upcastLevel = isUpcast ? Number(selectedUpcastLvl) : undefined;
    const modifiedSpell = isCantrip && cantripAutoLevel ? { ...spell, level: cantripAutoLevel, baseLevel: 0 } : { ...spell, baseLevel: isCantrip ? 0 : undefined };

    if (isCantrip) {
      // Carry the Psychic damage opt-in flag through the cantrip path so the
      // execution resolver can honor the checkbox (CLA-268).
      onCast({ ...modifiedSpell, usePsychicDamage }, metaCtx);
      return;
    }

    onCast({ ...spell, isUpcast, upcastLevel, freeCastAuthorized, usePsionicPayment, usePsychicDamage, overchannel: useOverchannel, quickRitual: quickRitualActive }, metaCtx);
  };

  const isRaging = getActiveBuffs(playerStats.name, campaignName).some(b => b.name === 'Rage');
  const canCast = computeCanCast({ isRaging, isCantrip, quickRitualActive, isUpcastable, hasAnySlots, freeCastAuthorized, spell, playerStats, isWarlock, warlockSlotLevel, psionicSorceryAvailable: _psionicSorceryAvailable });

  const showUpcastSelector = isUpcastable && upcastLevels.length > 1;

  return (
    <div className="spell-detail-popup">
      <div className="spell-detail-content">
        <h3 dangerouslySetInnerHTML={{ __html: sanitizeHtml(spell.name) }} />
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(Array.isArray(spell.description) ? spell.description.join('') : spell.description || '') }} />
        <SpellMeta isCantrip={isCantrip} spell={spell} isPhantasmalFreeCast={isPhantasmalFreeCast} isDispelMagicAsBonusAction={isDispelMagicAsBonusAction} isWarlock={isWarlock} warlockSlotLevel={warlockSlotLevel} playerStats={playerStats} showUpcastSelector={showUpcastSelector} psionicSorceryAvailable={_psionicSorceryAvailable} />
        {showUpcastSelector && (
          <div className="spell-detail-upcast">
            <p className="spell-detail-upcast-label"><i className="fa-solid fa-arrow-up"></i> Cast at Level:</p>
            {upcastLevels.map(({ level, formula, availableSlots }) => {
              const isSelected = selectedUpcastLvl === String(level);
              const resolvedFormula = formula.replace(/\bMOD\b/g, String(playerStats.spellAbilities?.modifier || 0));
              const spCanCover = _psionicSorceryAvailable >= level;
              return (
                <label
                  key={level}
                  className={`spell-detail-upcast-level ${isSelected ? 'spell-detail-upcast-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="spellDetailUpcastLevel"
                    value={level}
                    checked={isSelected}
                    onChange={() => setSelectedUpcastLvl(String(level))}
                    disabled={availableSlots <= 0 && !spCanCover}
                  />
                  <span className="spell-detail-upcast-level-number">Level {level}</span>
                  <span className="spell-detail-upcast-formula">{resolvedFormula}</span>
                  <span className="spell-detail-upcast-slots">{availableSlots > 0 ? `${availableSlots} slot${availableSlots !== 1 ? 's' : ''}` : ''}{availableSlots > 0 && spCanCover ? ' or ' : ''}{spCanCover ? `${_psionicSorceryAvailable} SP` : ''}</span>
                </label>
              );
            })}
          </div>
        )}
        {(() => {
          const upcastLevel = isUpcastable ? (Number(selectedUpcastLvl) || spell.level) : spell.level;
          const slotKey = `spell_slots_level_${upcastLevel}`;
          const currentSlots = getRuntimeValue(playerStats.name, slotKey);
          const maxSlots = (playerStats.spellAbilities && playerStats.spellAbilities[slotKey]) || 0;
          const availableSlots = currentSlots != null ? currentSlots : maxSlots;
          const showBoth = _psionicSorceryAvailable > 0 && availableSlots > 0;
          const isPsionic = isPsionicSpell(playerStats, spell.name);
          const hasPsionic = hasPsionicSorcery(playerStats);
          if (!isPsionic || !hasPsionic || isCantrip || freeCastAuthorized || !showBoth) return null;
          return (
            <div className="spell-detail-upcast">
              <label>
                <input
                  type="checkbox"
                  checked={usePsionicPayment}
                  onChange={() => setUsePsionicPayment(!usePsionicPayment)}
                />
                <span>Use Sorcery Points ({upcastLevel} SP) instead of spell slot</span>
              </label>
            </div>
          );
        })()}
        {canChangeDamageType && (
          <PsychicDamageCheckbox usePsychicDamage={usePsychicDamage} onTogglePsychicDamage={() => setUsePsychicDamage(!usePsychicDamage)} />
        )}
        <OverchannelSection isOverchannelApplicable={isOverchannelApplicable} useOverchannel={useOverchannel} onToggleOverchannel={() => setUseOverchannel(!useOverchannel)} overchannelDamage={overchannelDamage} nextOverchannelUse={nextOverchannelUse} />
        <QuickRitualSection isRitualMasterSpell={isRitualMasterSpell} quickRitualActive={quickRitualActive} quickRitualUsed={quickRitualUsed} onToggleQuickRitual={() => setUseQuickRitual(!useQuickRitual)} />
        {noVSComponents && (
          <div className="spell-detail-free-cast">
            <i className="fa-solid fa-ghost"></i> No Verbal or Somatic components (Psychic Spells)
          </div>
        )}
        {noVComponents && (
          <div className="spell-detail-free-cast">
            <i className="fa-solid fa-ghost"></i> No Verbal components (Improved Illusions)
          </div>
        )}
        {(() => {
          const consumedMaterial = getConsumedMaterial(spell);
          if (!consumedMaterial) return null;
          const hasIt = hasMaterial(playerStats, consumedMaterial.itemName);
          return (
            <div className="spell-detail-material">
              <i className="fa-solid fa-flask"></i> <b>Material:</b> {consumedMaterial.itemName} — <strong>{consumedMaterial.required}</strong>
              {!hasIt && <span className="spell-detail-material-missing"> (not found in backpack)</span>}
            </div>
          );
        })()}
        <div className="spell-detail-actions">
          <button
            className="char-btn"
            onClick={handleCast}
            disabled={!canCast}
          >
            <i className="fa-solid fa-wand-magic"></i> Cast Spell
          </button>
          <button className="char-btn char-btn-secondary" onClick={onClose}>
            <i className="fa-solid fa-times"></i> Close
          </button>
        </div>
          <FreeCastNotices freeCastAuthorized={freeCastAuthorized} isShadowArtsFreeCast={isShadowArtsFreeCast} isPhantasmalFreeCast={isPhantasmalFreeCast} shadowArtsFreeCastCount={shadowArtsFreeCastCount} spell={spell} canCast={canCast} isCantrip={isCantrip} />
      </div>
    </div>
  );
}

export default SpellDetailPopup;
