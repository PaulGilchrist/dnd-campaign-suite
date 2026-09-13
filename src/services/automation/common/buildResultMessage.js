export function buildResultMessage({ targetName, option, saveDc, saveType, success }) {
    const effectDesc = getEffectDescription(option);
    if (success) {
        return `${targetName} rolled a ${saveType} save (DC ${saveDc}): <strong>Success</strong>.<br/>No effect applied.`;
    }
    return `${targetName} rolled a ${saveType} save (DC ${saveDc}): <strong>Failure</strong>.<br/>${effectDesc} applied to ${targetName}.`;
}

function getEffectDescription(option) {
    if (option.effect === 'push_15ft') return `${option.name} — target pushed 15 ft away`;
    if (option.effect === 'prone') return `${option.name} — target gains the Prone condition`;
    if (option.effect === 'addled') return `${option.name} — target cannot make Opportunity Attacks`;
    if (option.effect === 'disadvantage_next_attack') return `${option.name} — target has Disadvantage on its next attack roll`;
    if (option.effect === 'no_reactions') return `${option.name} — target can't take Reactions until the start of your next turn`;
    return option.name;
}
