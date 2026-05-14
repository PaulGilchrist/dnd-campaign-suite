import usePopup from './usePopup.js'

export function buildFeatureDetailHtml(entity) {
    if (entity.details) {
        return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
}

function buildSpellDetailHtml(entity) {
    if (entity.desc) {
        let html = `<b>${entity.name}</b><br/><br/>${entity.desc}<br/>`;
        if (typeof entity.higher_level === 'string' && entity.higher_level.trim()) {
            html += `<br/><b>At higher levels.</b>&nbsp;${entity.higher_level}`;
        }
        return html;
    }
    return null;
}

export function buildAbilityDetailHtml(allAbilityScores) {
    return (name) => {
        const abilityScore = allAbilityScores.find((a) => a.full_name === name);
        if (abilityScore) {
            return `<h3>${name}</h3>${abilityScore.desc}<br/>`;
        }
        return null;
    };
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
