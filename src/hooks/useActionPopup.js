import usePopup from './usePopup.js'

export function buildFeatureDetailHtml(entity) {
    if (entity.details) {
        return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
}

function buildSpellDetailHtml(entity) {
    if (entity.desc) {
        return `<b>${entity.name}</b><br/><br/>${entity.desc}<br/>`;
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
