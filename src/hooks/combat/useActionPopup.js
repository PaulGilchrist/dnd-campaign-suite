import usePopup from './usePopup.js'
import { loadBackgroundData } from '../../services/ui/dataLoader.js'

export function buildFeatureDetailHtml(entity) {
    if (entity.details) {
        return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
}

function buildSpellDetailHtml(entity) {
    if (entity.description) {
        return `<b>${entity.name}</b><br/><br/>${entity.description}<br/>`;
    }
    return null;
}

export function buildAbilityDetailHtml(allAbilityScores) {
    return (name) => {
        const abilityScore = allAbilityScores.find((a) => a.full_name === name);
        if (abilityScore) {
            return `<h3>${name}</h3>${abilityScore.description}<br/>`;
         }
        return null;
     };
}

let weaponMasteryCache = null;
export async function loadWeaponMasteries() {
    if (weaponMasteryCache === null) {
        weaponMasteryCache = await (await fetch('/data/2024/weapon-mastery.json')).json();
      }
    return weaponMasteryCache;
}

export async function showWeaponMasteryPopup(masteryName, setPopupHtml) {
    const masteries = await loadWeaponMasteries().catch(() => []);
    const entity = masteries.find((m) => m.name === masteryName);
    if (entity && entity.description) {
        setPopupHtml(`<b>${entity.name}</b><br/><br/>${entity.description}<br/>`);
      }
}

let backgroundsCache = null;
export async function loadBackgrounds() {
    if (backgroundsCache === null) {
        backgroundsCache = await (await fetch('/data/2024/backgrounds.json')).json();
      }
    return backgroundsCache;
}

export async function showBackgroundPopup(backgroundName, setPopupHtml, rulesVersion = '2024') {
    try {
        const backgrounds = await loadBackgroundData(rulesVersion);
        const entity = backgrounds.find((b) => b.name === backgroundName || b.index === backgroundName.toLowerCase());
        if (entity && entity.description) {
            let html = `<b>${entity.name}</b><br/><br/>${entity.description}`;
            if (entity.ability_scores) {
                html += `<br/><br/><b>Ability Scores:</b> ${entity.ability_scores}`;
              }
            if (entity.feat) {
                html += `<br/><br/><b>Feat:</b> ${entity.feat}`;
              }
            if (entity.skill_proficiencies) {
                html += `<br/><br/><b>Skill Proficiencies:</b> ${entity.skill_proficiencies}`;
              }
            if (entity.tool_proficiencies) {
                html += `<br/><br/><b>Tool Proficiencies:</b> ${entity.tool_proficiencies}`;
              }
            if (entity.equipment) {
                html += `<br/><br/><b>Equipment:</b> ${entity.equipment}`;
              }
            if (entity.book || entity.page) {
                let source = `${entity.book || ''} ${entity.page || ''}`.trim();
                html += `<br/><br/><b>Source:</b> ${source}`;
              }
            setPopupHtml(html);
           } else {
            setPopupHtml(`<b>${backgroundName}</b><br/><br/>Background details not found in database.`);
        }
    } catch (error) {
        console.error(`[showBackgroundPopup] Error loading background:`, error);
        setPopupHtml(`<b>${backgroundName}</b><br/><br/>Error loading background details: ${error.message}. Check browser console for more details.`);
    }
}

export default function useActionPopup(preset, context = {}) {
    let handler;
    if (preset === 'feature') {
        handler = buildFeatureDetailHtml;
    } else if (preset === 'spell') {
        handler = buildSpellDetailHtml;
    } else if (preset === 'ability') {
        handler = buildAbilityDetailHtml(context.allAbilityScores);
    } else if (typeof preset === 'function') {
        handler = preset;
    } else {
        handler = () => null;
    }

    return usePopup(handler);
}
