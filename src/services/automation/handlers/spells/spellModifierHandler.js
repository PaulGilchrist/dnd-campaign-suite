import { automationInfoPopup } from '../../../shared/popupResponse.js';

export async function handle(action) {
    if (action.name === 'Metamagic') return null;
    return automationInfoPopup(action);
}
