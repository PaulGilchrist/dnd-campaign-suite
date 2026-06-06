export function automationInfoPopup(action) {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: action.name,
      automationType: action.automation.type,
      description: action.description || '',
      automation: action.automation,
    },
  }
}
