/* eslint-disable react/prop-types */
import usePopup from './use-popup'

export function buildFeatureDetailHtml(entity) {
    if (entity.details) {
        return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
}

export function buildSpellDetailHtml(entity) {
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
    switch (preset) {
        case 'feature':
            return usePopup(buildFeatureDetailHtml);
        case 'spell':
            return usePopup(buildSpellDetailHtml);
        case 'ability':
            return usePopup(buildAbilityDetailHtml(context.allAbilityScores));
        default:
            if (typeof preset === 'function') return usePopup(preset);
            return usePopup(() => null);
    }
}
