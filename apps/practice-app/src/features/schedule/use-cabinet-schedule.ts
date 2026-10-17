import { useCallback, useEffect, useState } from 'react';
import { createCabinetPilot } from './cabinet-pilot';

// Opt-in public reads for the staged TestFlight pilot; the ordinary source remains supported.
export const cabinetPilotEnabled = process.env.EXPO_PUBLIC_CABINET_SCHEDULE_PILOT === '1';
const client = createCabinetPilot({ origin: process.env.EXPO_PUBLIC_CABINET_API_ORIGIN || '' });

export function useCabinetSchedule(enabled: boolean) {
  const [state, setState] = useState(client.getState);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const pending = client.refresh();
    setState(client.getState());
    setState(await pending);
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const pending = client.refresh();
    // One initial read; ordinary AppState/polling/reminder effects never call this client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(client.getState());
    void pending.then(next => { if (active) setState(next); });
    return () => { active = false; };
  }, [enabled]);
  return { ...state, refresh };
}
