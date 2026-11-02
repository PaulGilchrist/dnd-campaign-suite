import { useEffect, useState } from 'react';
import { loadCampaignType } from '../../services/campaign/campaignMetaService.js';

/**
 * Campaign type ('standard' | 'arena' | 'starter') for the open campaign.
 * Drives the sidebar type chip and hides campaign-only views while an arena
 * battle is open. loadCampaignType answers 'standard' on any failure, so the
 * sidebar never loses its nav over a failed meta read.
 */
export default function useCampaignType(campaignName) {
  const [campaignType, setCampaignType] = useState('standard');

  useEffect(() => {
    if (!campaignName) {
      setCampaignType('standard');
      return undefined;
    }
    let cancelled = false;
    loadCampaignType(campaignName).then((type) => {
      if (!cancelled) setCampaignType(type);
    });
    return () => { cancelled = true; };
  }, [campaignName]);

  return campaignType;
}
