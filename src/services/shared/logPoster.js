import { addEntry } from '../logService.js'

export function postLogEntry(campaignName, entry) {
  return addEntry(campaignName, entry).catch(() => {})
}
