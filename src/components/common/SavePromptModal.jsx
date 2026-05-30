import { useState, useEffect, useCallback } from 'react';
import utils from '../../services/utils.js';
import { rollD20 } from '../../services/diceRoller.js';
import { sendSaveResult, clearSavePrompt } from '../../services/savePromptService.js';
import Subscriber from './Subscriber.jsx';
import './savePromptModal.css';

function SavePromptModal({ campaignName, characters }) {
  const [prompt, setPrompt] = useState(null);

  const characterNames = new Set((characters || []).map(c => {
    const name = typeof c === 'string' ? c : c.name;
    return name ? utils.getFirstName(name).toLowerCase() : '';
  }));

  const handleEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-savePrompt-`;
    if (!event.key.startsWith(prefix)) return;
    const targetName = event.key.slice(prefix.length);
    if (!targetName || !characterNames.has(targetName.toLowerCase())) return;

    setPrompt({ targetName, ...event.data });
  }, [campaignName, characterNames]);

  const handleClearedEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-savePromptCleared-`;
    if (!event.key.startsWith(prefix)) return;
    const targetName = event.key.slice(prefix.length);
    if (!targetName) return;
    if (prompt?.targetName === targetName && event.data?.promptId === prompt?.promptId) {
      setPrompt(null);
    }
  }, [campaignName, prompt]);

  const handleDismiss = useCallback(() => {
    if (prompt) {
      clearSavePrompt(campaignName, prompt.targetName, prompt.promptId);
    }
    setPrompt(null);
  }, [campaignName, prompt]);

  const handleRollSave = useCallback(() => {
    if (!prompt) return;

    let saveBonus = 0;
    try {
      const stored = localStorage.getItem('combatSummary');
      if (stored) {
        const cs = JSON.parse(stored);
        const creature = cs.creatures.find(c =>
          c.name === prompt.targetName || c.name.startsWith(prompt.targetName + ' ')
        );
        if (creature?.saveBonuses?.[prompt.saveType] != null) {
          saveBonus = creature.saveBonuses[prompt.saveType];
        }
      }
    } catch { /* ignore */ }

    const roll = rollD20();
    const total = roll + saveBonus;
    const success = total >= prompt.saveDc;

    sendSaveResult(campaignName, prompt.targetName, {
      promptId: prompt.promptId,
      success,
      roll,
      total,
      saveBonus,
    });

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: {
        promptId: prompt.promptId,
        targetName: prompt.targetName,
        saveType: prompt.saveType,
        saveDc: prompt.saveDc,
        success,
        roll,
        total,
        saveBonus,
        rawDamage: prompt.rawDamage,
        dcSuccess: prompt.dcSuccess,
      },
    }));

    setPrompt(null);
  }, [campaignName, prompt]);

  const abilityLabel = prompt ? (prompt.saveType || '').toUpperCase() : '';

  return (
    <>
      {typeof EventSource !== 'undefined' && (
        <Subscriber
          campaignName={campaignName}
          handleEvent={(event) => {
            handleEvent(event);
            handleClearedEvent(event);
          }}
        />
      )}
      <div className="sp-overlay" onClick={handleDismiss}>
          <div className="sp-modal" onClick={e => e.stopPropagation()}>
            <div className="sp-header">
              <i className="fa-solid fa-shield-halved"></i> Saving Throw Required
            </div>
            <div className="sp-body">
              <p><strong>{prompt.targetName}</strong> must make a <strong>{abilityLabel}</strong> saving throw.</p>
              <p className="sp-dc">DC {prompt.saveDc}</p>
              {prompt.dcSuccess === 'half' && <p className="sp-note">Half damage on successful save</p>}
              {prompt.dcSuccess === 'none' && <p className="sp-note">No damage on successful save</p>}
              {prompt.sourceName && <p className="sp-source">Source: {prompt.sourceName}</p>}
            </div>
            <div className="sp-actions">
              <button className="sp-roll-btn" onClick={handleRollSave} type="button">
                <i className="fa-solid fa-dice-d20"></i> Roll Save
              </button>
              <button className="sp-dismiss-btn" onClick={handleDismiss} type="button">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SavePromptModal;
