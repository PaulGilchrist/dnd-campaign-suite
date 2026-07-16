import { useState, useRef } from 'react';
import useLog from '../../hooks/runtime/useLog.js';
import './Log.css';

function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getRollIconType(rollType) {
  switch (rollType) {
    case 'attack': return 'fa-crosshairs';
    case 'spell_attack': return 'fa-wand-magic-sparkles';
    case 'save': return 'fa-shield-halved';
    case 'condition-save': return 'fa-shield-halved';
    case 'save-damage': return 'fa-shield-halved';
    case 'aoe-damage': return 'fa-wand-magic-sparkles';
    case 'initiative': return 'fa-bolt';
    case 'damage': return 'fa-skull';
    default: return 'fa-dice-d20';
   }
}

function RollEntry({ entry }) {
  const isDamage = entry.rollType === 'damage';
  const isSave = entry.rollType === 'save';
  const isSaveDamage = entry.rollType === 'save-damage';
  const isAoeDamage = entry.rollType === 'aoe-damage';
  const isOverchannelDamage = entry.rollType === 'overchannel-damage';
  const isGrazeDamage = entry.rollType === 'graze-damage';
  const hasSecondary = entry.secondaryFormula != null;
  const showBothDice = !isDamage && !isSaveDamage && !isAoeDamage && entry.rolls?.length === 2 && entry.mode && entry.mode !== 'normal';

  return (
    <div className={`log-entry log-roll${entry.isNatural20 ? ' log-nat20' : ''}${entry.isNatural1 ? ' log-nat1' : ''}`}>
      <div className="log-entry-header">
        <span className="log-icon"><i className={`fas ${getRollIconType(entry.rollType)}`}></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">{entry.name}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-roll-details">
        {entry.targetName && !isSaveDamage && !isAoeDamage && (
          <span className="log-target">→ {entry.targetName}</span>
        )}
        {entry.targetName && isSaveDamage && (
          <span className="log-target">{entry.targetName}</span>
        )}
        {entry.hit !== undefined && entry.rollType === 'attack' && (
          <span className={`log-hit-miss ${entry.hit ? 'log-hit' : 'log-miss'}`}>
            {entry.isAutoMiss ? 'AUTO-MISS' : (entry.hit ? 'HIT' : 'MISS')} {entry.targetAc != null ? `(AC ${entry.targetAc})` : ''}
          </span>
        )}
        {entry.rollType === 'attack' && entry.isCrit && !entry.isNatural1 && (
          <span className="log-critical-hit">Critical Hit!</span>
        )}
        {entry.rollType === 'attack' && entry.isNatural1 && (
          <span className="log-critical-miss">Critical Miss!</span>
        )}
        {entry.coverAcBonus > 0 && (
          <span className="log-cover">
            {entry.coverLevel === 'threeQuarter' ? '3/4' : '1/2'} Cover (+{entry.coverAcBonus} AC)
          </span>
        )}
        {entry.coverReason && (
          <span className="log-range-reason">{entry.coverReason}</span>
        )}
        {entry.rangeReason && (
          <span className="log-range-reason">{entry.rangeReason}</span>
        )}
        {showBothDice && (
          <span className={`log-mode-badge ${entry.mode || 'normal'}`}>
            {(entry.mode || 'normal').toUpperCase()}
          </span>
        )}
        {entry.isNatural20 && <span className="log-nat-badge log-nat20">NAT 20</span>}
        {entry.isNatural1 && <span className="log-nat-badge log-nat1">FUMBLE</span>}
        {entry.damageType && (isDamage || isSaveDamage || isAoeDamage || isOverchannelDamage || isGrazeDamage) && (
          <span className="log-damage-type">{entry.damageType}</span>
        )}
        {(isSave || isSaveDamage || isAoeDamage) && entry.saveType && entry.saveDc && (
          <span className="log-save-info">
            {entry.saveType.toUpperCase()} save DC {entry.saveDc}&nbsp;
            {entry.mode === 'disadvantage' && (
              <span className="log-mode-badge disadvantage">DISADVANTAGE</span>
            )}
          </span>
        )}
        {(isSave || isSaveDamage) && entry.saveResult && (
          <span className={`log-save-result ${entry.saveResult === 'success' ? 'log-condition-success' : 'log-condition-failure'}`}>
            {entry.saveResult === 'success' ? 'SAVE SUCCESS' : 'SAVE FAILURE'}
            {entry.saveRoll != null && ` (d20 ${entry.saveRoll}${entry.saveBonus != null ? `+${entry.saveBonus}` : ''})`}
          </span>
        )}
        {isSaveDamage && !entry.saveResult && entry.saveSuccess != null && (
          <span className={`log-save-result ${entry.saveSuccess ? 'log-condition-success' : 'log-condition-failure'}`}>
            {entry.saveSuccess ? 'SAVE SUCCESS' : 'SAVE FAILURE'}
          </span>
        )}
        {isSave && entry.targetName && entry.attackerName && (
          <span className="log-target">{entry.targetName} vs {entry.attackerName}</span>
        )}
        {isSaveDamage && entry.targetName && (
          <span className="log-target">vs {entry.targetName}</span>
        )}
        <div className="log-dice-values">
          {!isDamage && !isSaveDamage && !isAoeDamage && entry.rolls?.length === 2 && (
            showBothDice ? (
              <>
                {entry.mode === 'advantage' ? (
                  <>
                    <span className={`log-die${entry.rolls[0] >= entry.rolls[1] ? ' log-die-selected' : ''}`}>({entry.rolls[0]} {entry.rolls[0] >= entry.rolls[1] ? 'selected' : 'discarded'})</span>
                    <span className={`log-die${entry.rolls[1] > entry.rolls[0] ? ' log-die-selected' : ''}`}>({entry.rolls[1]} {entry.rolls[1] > entry.rolls[0] ? 'selected' : 'discarded'})</span>
                  </>
                ) : entry.mode === 'disadvantage' ? (
                  <>
                    <span className={`log-die${entry.rolls[0] <= entry.rolls[1] ? ' log-die-selected' : ''}`}>({entry.rolls[0]} {entry.rolls[0] <= entry.rolls[1] ? 'selected' : 'discarded'})</span>
                    <span className={`log-die${entry.rolls[1] < entry.rolls[0] ? ' log-die-selected' : ''}`}>({entry.rolls[1]} {entry.rolls[1] < entry.rolls[0] ? 'selected' : 'discarded'})</span>
                  </>
                ) : (
                  <span className="log-die log-die-selected">({entry.total})</span>
                )}
              </>
            ) : (
              <span className="log-die log-die-selected">({entry.total})</span>
            )
          )}
          {(isDamage || isSaveDamage || isAoeDamage || isOverchannelDamage || isGrazeDamage) && entry.formula && (
            <span className="log-dice-formula">{entry.formula}</span>
          )}
          {!isSave && (isDamage || isSaveDamage || isAoeDamage || isOverchannelDamage || isGrazeDamage) && entry.rolls && entry.rolls.length > 0 && (
            <span className="log-dice-values-inline">
              ({entry.rolls.join(', ')})
            </span>
          )}
          <span className="log-total"><b>{entry.total}{(isDamage || isSaveDamage || isAoeDamage || isOverchannelDamage || isGrazeDamage) ? '' : (entry.bonus != null && entry.bonus >= 0 ? `+${entry.bonus}` : (entry.bonus != null ? `${entry.bonus}` : ''))}{entry.bonusDetail ? ' ' + entry.bonusDetail : ''}</b></span>
          {entry.gwfApplied && entry.gwfOriginalRolls && (
            <span className="log-gwf">
              <i className="fa-solid fa-shield-halved"></i> GWF: {entry.gwfOriginalRolls.join(', ')} → {entry.gwfDisplayRolls?.join(', ') || entry.rolls.join(', ')}
            </span>
          )}
        </div>
        {(isSaveDamage || isOverchannelDamage) && entry.finalDamage != null && entry.damageType && (
          <span className="log-final-damage">→ {entry.finalDamage} {entry.damageType} damage</span>
        )}
        {hasSecondary && (
          <div className="log-secondary-damage">
            <span className="log-secondary-label">Secondary:</span>
            {entry.secondaryFormula && <span className="log-dice-formula">{entry.secondaryFormula}</span>}
            <span className="log-total"><b>{entry.secondaryTotal}</b></span>
            {entry.secondaryDamageType && <span className="log-damage-type">{entry.secondaryDamageType}</span>}
            {entry.secondarySaveResult && (
              <span className={`log-save-result ${entry.secondarySaveResult === 'success' ? 'log-condition-success' : 'log-condition-failure'}`}>
                {entry.secondarySaveResult === 'success' ? 'SAVE SUCCESS' : 'SAVE FAILURE'}
                {entry.secondarySaveRoll != null && ` (d20 ${entry.secondarySaveRoll}${entry.secondarySaveBonus != null ? `+${entry.secondarySaveBonus}` : ''})`}
              </span>
            )}
          </div>
        )}
        {(isDamage || isSaveDamage) && entry.resistanceDetails && entry.resistanceDetails.length > 0 && (
          <span className="log-resistance-details">
            {entry.resistanceDetails.map((rd, i) => (
              <span key={i} className={rd.status === 'immune' ? 'log-immune' : 'log-resistant'}>
                {rd.status === 'immune' ? 'Immune' : 'Resistant'} to {rd.damageType}
              </span>
            ))}
          </span>
        )}
        {isAoeDamage && entry.affectedCount != null && entry.affectedCount > 0 && (
          <span className="log-aoe-affect">{entry.affectedCount} creature{entry.affectedCount !== 1 ? 's' : ''} affected</span>
        )}
        {entry.condition && entry.dc !== undefined && (
          <span className={`log-condition-save ${entry.success ? 'log-condition-success' : 'log-condition-failure'}`}>
            vs {entry.condition} (DC {entry.dc}): {entry.success ? 'SUCCESS' : 'FAILURE'}
          </span>
        )}
        {entry.resistanceNotice && (
          <div className="log-resistance-notice">{entry.resistanceNotice}</div>
        )}
        {entry.hunterLoreNotice && (
          <div className="log-hunter-lore-notice">
            <i className="fa-solid fa-eye"></i> {entry.hunterLoreNotice}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteEntry({ entry }) {
   return (
      <div className="log-entry log-note">
        <div className="log-entry-header">
          <span className="log-icon"><i className="fas fa-comment-dots"></i></span>
          <span className="log-character">{entry.characterName}</span>
          <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
        </div>
        <div className="log-note-text">{entry.noteText}</div>
      </div>
   );
}

 function LootEntry({ entry }) {
   return (
      <div className="log-entry log-loot">
        <div className="log-entry-header">
          <span className="log-icon"><i className="fas fa-coins"></i></span>
          <span className="log-name">Loot &amp; XP Awarded</span>
          <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
        </div>
        <div className="log-loot-details">
           {entry.xpPerChar && entry.xpPerChar > 0 && (
             <span className="log-loot-xp">
               <i className="fas fa-star"></i>&nbsp;{entry.xpPerChar.toLocaleString()} XP per character
             </span>
            )}
          {entry.lootItems && entry.lootItems.length > 0 && (
            <ul className="log-loot-items">
              {entry.lootItems.map((item, i) => (
                <li key={i} className="log-loot-item">{item}</li>
                 ))}
             </ul>
            )}
        </div>
      </div>
     );
    }

 const TRAVEL_ACTION_CONFIG = {
  advance:           { icon: 'fa-person-walking',     label: 'Advanced to',        color: '#4a90d9' },
  advance_with_event:{ icon: 'fa-bolt',               label: 'Event triggered at', color: '#e87040' },
  arrived:           { icon: 'fa-flag-checkered',     label: 'Arrived at',         color: '#4CAF50' },
  camp:              { icon: 'fa-campground',          label: 'Camped at',          color: '#8ab' },
  forced_march:      { icon: 'fa-person-running',     label: 'Forced march at',    color: '#e87040' },
  event_accept:      { icon: 'fa-check',              label: 'Accepted event at',  color: '#4CAF50' },
  event_skip:        { icon: 'fa-xmark',              label: 'Skipped event at',   color: '#888' },
  event_reroll:      { icon: 'fa-dice',               label: 'Re-rolled event at', color: '#b99' },
  extreme_weather:   { icon: 'fa-triangle-exclamation', label: 'Weather halted travel at', color: '#f44336' },
  day_exhausted:     { icon: 'fa-tent',               label: 'Budget exhausted at', color: '#e87040' },
  cancel:            { icon: 'fa-ban',                label: 'Travel cancelled at', color: '#888' },
};

function TravelEntry({ entry }) {
  const config = TRAVEL_ACTION_CONFIG[entry.action] || TRAVEL_ACTION_CONFIG.advance;
  const hexStr = entry.hex ? `(${entry.hex.q}, ${entry.hex.r})` : '';

  return (
    <div className="log-entry log-travel" style={{ borderLeftColor: config.color }}>
      <div className="log-entry-header">
        <span className="log-icon" style={{ color: config.color }}>
          <i className={`fas ${config.icon}`}></i>
        </span>
        <span className="log-travel-action" style={{ color: config.color }}>
          {config.label}
        </span>
        {hexStr && <span className="log-travel-coords">{hexStr}</span>}
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-travel-details">
        {entry.terrain && (
          <span className="log-travel-terrain">
            <i className="fas fa-mountain"></i> {entry.terrain}
          </span>
        )}
        {entry.weather && (
          <span className="log-travel-weather">
            <i className={`fas fa-${entry.weatherIcon || 'sun'}`}></i> {entry.weather}
          </span>
        )}
      </div>
      {entry.eventTitle && (
        <div className="log-travel-event">
          <span className="log-travel-event-type">{entry.eventType}</span>
          <span className="log-travel-event-title">{entry.eventTitle}</span>
        </div>
      )}
    </div>
  );
}

function ConditionEntry({ entry }) {
   const isApplied = entry.action === 'applied';
   return (
      <div className={`log-entry log-condition ${isApplied ? 'log-condition-applied' : 'log-condition-broken'}`}>
        <div className="log-entry-header">
          <span className="log-icon">
            <i className={`fas ${isApplied ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i>
          </span>
          <span className="log-character">{entry.characterName}</span>
          <span className="log-name">{isApplied ? 'Condition Applied' : 'Condition Broken'}</span>
          <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
        </div>
        <div className="log-condition-details">
          <span className="log-condition-name">{entry.condition}</span>
          {isApplied && entry.dc && (
            <span className="log-condition-dc">DC {entry.dc}</span>
          )}
          {isApplied && entry.ability && (
            <span className="log-condition-ability">{entry.ability.toUpperCase()} save</span>
          )}
          {!isApplied && entry.sourceName && (
            <span className="log-condition-source">by {entry.sourceName}</span>
          )}
        </div>
      </div>
    );
 }

function EncounterEntry({ entry }) {
  const isStart = entry.action === 'started';
  return (
    <div className={`log-entry log-encounter ${isStart ? 'log-encounter-start' : 'log-encounter-end'}`}>
      <div className="log-entry-header">
        <span className="log-icon">
          <i className={`fas ${isStart ? 'fa-skull' : 'fa-trophy'}`}></i>
        </span>
        <span className="log-name">{isStart ? 'Encounter Started' : 'Encounter Completed'}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-encounter-details">
        <span className="log-encounter-name">{entry.encounterName}</span>
        {isStart && entry.monsters && entry.monsters.length > 0 && (
          <div className="log-encounter-monsters">
            {entry.monsters.map((m, i) => (
              <span key={i} className="log-encounter-monster">{m}{i < entry.monsters.length-1 ? ',' : ''}&nbsp;</span>
            ))}
          </div>
        )}
        {!isStart && entry.xpPerChar > 0 && (
          <span className="log-encounter-xp">
            <i className="fas fa-star"></i>&nbsp;{entry.xpPerChar.toLocaleString()} XP per character
          </span>
        )}
        {!isStart && entry.lootItems && entry.lootItems.length > 0 && (
          <ul className="log-encounter-loot">
            {entry.lootItems.map((item, i) => (
              <li key={i} className="log-encounter-loot-item">{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HpChangeEntry({ entry }) {
  const isDamage = entry.delta < 0;
  const isNpc = !!entry.threshold;
  return (
    <div className={`log-entry log-hp-change ${isDamage ? 'log-hp-damage' : 'log-healing'}`}>
      <div className="log-entry-header">
        <span className="log-icon">
          <i className={`fas ${isDamage ? 'fa-heart-crack' : 'fa-heart'}`}></i>
        </span>
        <span className="log-character">{entry.targetName}</span>
        <span className="log-name">
          {isNpc ? (
            <>
              {entry.threshold === 'dead' && 'Defeated'}
              {entry.threshold === 'bloodied' && 'Bloodied'}
              {entry.threshold === 'recovering' && 'Recovering'}
              {entry.delta !== 0 && ` (${entry.delta > 0 ? '+' : ''}${entry.delta})`}
            </>
             ) : (
                <>
                  {entry.isUnconscious && 'Knocked Unconscious — '}
                  {isDamage ? 'Takes Damage' : (entry.sourceName ? `Healed (${entry.sourceName})` : 'Healed')}
                  {entry.note && !isDamage && <span className="log-dice-formula">{entry.note}</span>}
                  {entry.maximizeHealingDice && !isDamage && ' — Dice maximized by Supreme Healing'}
                </>
              )}
        </span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-hp-details">
        {isNpc ? (
          <span className="log-hp-delta">{entry.delta > 0 ? '+' : ''}{entry.delta} HP</span>
        ) : (
          <>
            {entry.damageBreakdown && entry.damageBreakdown.length > 0 ? (
              <span className="log-hp-delta">
                {entry.delta > 0 ? '+' : ''}{entry.delta} HP
                {' ('}{entry.damageBreakdown.map((db, i) => (
                  <span key={i} className="log-damage-breakdown-item">
                    {i > 0 && <span className="log-damage-breakdown-sep">, </span>}
                    {db.amount} {db.damageType}
                    {db.status === 'resistant' && <span className="log-resistance-note"> (Resistance)</span>}
                    {db.status === 'immune' && <span className="log-immunity-note"> (Immune)</span>}
                  </span>
                ))}{')'}
              </span>
            ) : (
              <span className="log-hp-delta">{entry.delta > 0 ? '+' : ''}{entry.delta} HP</span>
            )}
            <span className="log-hp-current"> {entry.currentHp}/{entry.maxHp} remaining</span>
            {entry.rollInfo && !isDamage && <span className="log-roll-info"> ({entry.rollInfo})</span>}
            {entry.formula && !isDamage && <span className="log-dice-formula">{entry.formula}</span>}
          </>
        )}
      </div>
    </div>
  );
}

function HealingEntry({ entry }) {
  return (
    <div className="log-entry log-healing">
      <div className="log-entry-header">
        <span className="log-icon">
          <i className="fas fa-heart"></i>
        </span>
        <span className="log-character">{entry.targetName}</span>
        <span className="log-name">Healed ({entry.sourceName || entry.healingName})</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-hp-details">
        {entry.popupText && <span>{entry.popupText}</span>}
        {entry.amount !== undefined && <span>Healed for {entry.amount} HP ({entry.currentHp}/{entry.maxHp})</span>}
      </div>
    </div>
  );
}

function DeathSaveEntry({ entry }) {
  const isSuccess = entry.success;
  const isNat20 = entry.isNatural20;
  const isNat1 = entry.isNatural1;
  return (
    <div className={`log-entry log-death-save ${isSuccess ? 'log-death-save-success' : 'log-death-save-failure'}`}>
      <div className="log-entry-header">
        <span className="log-icon">
          <i className="fas fa-skull-crossbones"></i>
        </span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">
          {isNat20 && 'Natural 20 — Stabilized!'}
          {isNat1 && 'Natural 1 — Double Failure'}
          {!isNat20 && !isNat1 && (isSuccess ? 'Death Save Success' : 'Death Save Failure')}
        </span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-death-save-details">
        <span className={`log-die ${isSuccess ? 'log-die-selected' : ''}`}>({entry.roll})</span>
        {isNat1 && <span className="log-nat-badge log-nat1">NAT 1</span>}
        {isNat20 && <span className="log-nat-badge log-nat20">NAT 20</span>}
      </div>
    </div>
  );
}

function SpellEntry({ entry }) {
  const hasMetamagic = entry.metamagic && entry.metamagic.length > 0;
  return (
    <div className="log-entry log-spell">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-wand-magic-sparkles"></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">Cast {entry.spellName}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-spell-details">
        <span className="log-spell-level">Level {entry.spellLevel}</span>
        <span className="log-spell-casting-time">{entry.castingTime}</span>
        {hasMetamagic ? (
          <span className="log-metamagic-list">
            {entry.metamagic.map((opt, i) => (
              <span key={i} className="log-metamagic-option">{opt}</span>
            ))}
            {entry.spCost > 0 && (
              <span className="log-metamagic-cost">{entry.spCost} SP</span>
            )}
          </span>
        ) : (
          <span className="log-no-metamagic">No Metamagic</span>
        )}
      </div>
    </div>
  );
}

function MetamagicEntry({ entry }) {
  const isPositive = entry.damageDifference > 0;
  const isNegative = entry.damageDifference < 0;
  return (
    <div className="log-entry log-metamagic">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-dice"></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">Empowered Spell — {entry.spellName}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-empowered-details">
        <span className="log-target">→ {entry.targetName}</span>
        <span className="log-empowered-damage">
          {entry.originalDamage} → {entry.newTotal}
        </span>
        <span className={`log-empowered-difference${isPositive ? ' log-empowered-positive' : ''}${isNegative ? ' log-empowered-negative' : ''}${!isPositive && !isNegative ? ' log-empowered-neutral' : ''}`}>
          {isPositive ? '+' : ''}{entry.damageDifference}
        </span>
        <span className="log-empowered-dice-info">
          Rerolled {entry.rerolledDiceCount} die{entry.rerolledDiceCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

function HealingPoolEntry({ entry }) {
  return (
    <div className="log-entry log-healing">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-hand-holding-heart"></i></span>
        <span className="log-character">{entry.sourceName}</span>
        <span className="log-name">{entry.featureName} → {entry.targetName} (+{entry.amount} HP)</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-hp-details">
        <span className="log-hp-delta">Used {entry.amount} HP point from from pool with </span>
        <span className="log-hp-current"> {entry.poolAfter} remaining</span>
      </div>
    </div>
  );
}

function AbilityUseEntry({ entry }) {
  const hasSaveDetails = entry.saveRoll != null;
  const hasDeathSave = entry.deathSaveRoll != null;
  return (
    <div className="log-entry log-ability-use">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-bolt"></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">{entry.abilityName}</span>
        {entry.source && entry.source !== entry.abilityName && <span className="log-source-tag">{entry.source}</span>}
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-ability-details">
        {entry.description && <span className="log-ability-description" dangerouslySetInnerHTML={{ __html: entry.description }} />}
        {hasSaveDetails && (
          <div className="log-ability-save-details">
            <span className={`log-die log-die-selected`}>({entry.saveRoll})</span>
            <span className="log-save-info">+{entry.saveBonus} = {entry.saveTotal} vs DC {entry.saveDc}</span>
            <span className={`log-save-result ${entry.saveSuccess ? 'log-condition-success' : 'log-condition-failure'}`}>
              {entry.saveSuccess ? 'SUCCESS' : 'FAILURE'}
            </span>
            {entry.hpGained != null && (
              <span className="log-hp-gained">+{entry.hpGained} HP</span>
            )}
          </div>
        )}
        {hasDeathSave && (
          <div className="log-ability-death-save">
            <span className="log-icon-inline"><i className="fas fa-skull-crossbones"></i></span>
            <span>Death Save: </span>
            <span className={`log-die ${entry.deathSaveSuccess ? 'log-die-selected' : ''}`}>({entry.deathSaveRoll})</span>
            <span className={`log-save-result ${entry.deathSaveSuccess ? 'log-condition-success' : 'log-condition-failure'}`}>
              {entry.deathSaveSuccess ? 'SUCCESS' : 'FAILURE'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function RestEntry({ entry }) {
  const isLong = entry.type === 'long_rest';
  return (
    <div className={`log-entry log-rest ${isLong ? 'log-rest-long' : 'log-rest-short'}`}>
      <div className="log-entry-header">
        <span className="log-icon"><i className={`fas ${isLong ? 'fa-moon' : 'fa-bed'}`}></i></span>
        <span className="log-character">{entry.message?.split(' | ')[0]?.split('. ')[0] || entry.message}</span>
        <span className="log-name">{isLong ? 'Long Rest' : 'Short Rest'}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-rest-details">
        {entry.message && (
          <span>{entry.message}</span>
        )}
      </div>
    </div>
  );
}

function AutomationEntry({ entry }) {
  return (
    <div className="log-entry log-automation">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-wand-sparkles"></i></span>
        <span className="log-character">{entry.creatureName || entry.characterName || 'Automation'}</span>
        <span className="log-name">{entry.automationType || 'Automation'}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-automation-details">
        {entry.description && <span>{entry.description}</span>}
      </div>
    </div>
  );
}

function SaveResultEntry({ entry }) {
  const isSuccess = entry.success;
  return (
    <div className={`log-entry log-save-result ${isSuccess ? 'log-save-result-success' : 'log-save-result-failure'}`}>
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-shield-halved"></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">Saving Throw — {entry.targetName}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-save-result-details">
        <span className="log-save-info">
          {entry.saveType?.toUpperCase()} save DC {entry.saveDc}
        </span>
        <span className={`log-save-result ${isSuccess ? 'log-condition-success' : 'log-condition-failure'}`}>
          {isSuccess ? 'SAVE SUCCESS' : 'SAVE FAILURE'}
        </span>
        {entry.description && (
          <span className="log-save-result-description" dangerouslySetInnerHTML={{ __html: entry.description }} />
        )}
      </div>
    </div>
  );
}

export default function Log({ campaignName, characters }) {
  const { logEntries, initialized, addEntry } = useLog(campaignName);
  const [noteText, setNoteText] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const noteRef = useRef(null);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addEntry({
      type: 'note',
      characterName: selectedCharacter || 'Anonymous',
      noteText: noteText.trim()
    });
    setNoteText('');
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAddNote();
       }
     };

  return (
    <div className="campaign-tool log-view">
      <div className="log-toolbar">
        <h2><i className="fas fa-scroll"></i> Campaign Log</h2>
      </div>

        <div className="log-add-note no-print">
            {characters.length > 0 && (
              <select
                value={selectedCharacter}
                onChange={(e) => setSelectedCharacter(e.target.value)}
              >
                <option value="">Anonymous</option>
                {characters.map(ch => (
                  <option key={ch.name} value={ch.name}>{ch.name}</option>
                ))}
              </select>
            )}
            <textarea
              ref={noteRef}
              placeholder="Add a note to the log..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="log-add-btn" onClick={handleAddNote}><i className="fas fa-plus"></i></button>
          </div>

      {!initialized && <div className="log-loading no-print">Loading log...</div>}
      {initialized && logEntries.length === 0 && (
        <div className="log-empty no-print">No entries yet. Roll dice or add a note to get started.</div>
      )}

      <div className="log-entries">
        {!initialized ? null : [...logEntries].reverse().map(entry => (
          <div key={entry.id}>
            {entry.type === 'roll' && <RollEntry entry={entry}/>}
            {entry.type === 'note' && <NoteEntry entry={entry}/>}
            {entry.type === 'travel' && <TravelEntry entry={entry}/>}
            {entry.type === 'loot' && <LootEntry entry={entry}/>}
            {entry.type === 'condition' && <ConditionEntry entry={entry}/>}
            {entry.type === 'encounter' && <EncounterEntry entry={entry}/>}
            {entry.type === 'hp_change' && <HpChangeEntry entry={entry}/>}
            {entry.type === 'healing' && <HealingEntry entry={entry}/>}
            {entry.type === 'death_save' && <DeathSaveEntry entry={entry}/>}
            {entry.type === 'spell' && <SpellEntry entry={entry}/>}
            {entry.type === 'metamagic' && <MetamagicEntry entry={entry}/>}
            {entry.type === 'healing_pool' && <HealingPoolEntry entry={entry}/>}
            {entry.type === 'ability_use' && <AbilityUseEntry entry={entry}/>}
            {entry.type === 'short_rest' && <RestEntry entry={entry}/>}
            {entry.type === 'long_rest' && <RestEntry entry={entry}/>}
            {entry.type === 'automation' && <AutomationEntry entry={entry}/>}
            {entry.type === 'save_result' && <SaveResultEntry entry={entry}/>}
          </div>
        ))}
      </div>
    </div>
  );
}
