/**
 * WARNING: SSE re-render loop risk
 *
 * This module generates a single UUID per browser tab session.  It is used to:
 *   1. Identify this client tab when subscribing to the SSE stream (query param clientId)
 *   2. Let the server tag every outbound SSE event with `selfId` (the subscriber's own ID)
 *   3. Allow the Subscriber component to skip processing its own echoed events
 *
 * Every browser tab gets a unique id.  Closing and reopening a tab gets a new one.
 */

const clientId = crypto.randomUUID();

export default clientId;
