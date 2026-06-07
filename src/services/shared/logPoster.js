import { addEntry } from '../ui/logService.js'

export function postLogEntry(campaignName, entry) {
  return addEntry(campaignName, entry).catch(() => {})
}
