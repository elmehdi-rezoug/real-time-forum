import { state } from './state.js';
import { postCardHTML } from './utils.js';
import { renderUserList } from './listusers.js';

let ws = null;
let reconnectTimer = null;

// connect / disconnect

export function connectWS() {

  if (!state.auth.authenticated) return;

  // already open or connecting — don't create a second connection
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  )
    return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  ws.onopen = () => clearTimeout(reconnectTimer);
  ws.onmessage = (e) => {
    try {
      handle(JSON.parse(e.data));
    } catch {}
  };
  ws.onclose = () => {
    ws = null;
    reconnectTimer = setTimeout(connectWS, 3000);
  };
  ws.onerror = () => ws.close();
}

export function disconnectWS() {
  clearTimeout(reconnectTimer);
  if (ws) {
    ws.close();
    ws = null;
  }
}

//  event handler

function handle(msg) {
  switch (msg.type) {
    case 'users':
      // server sends full list — filter self out then render
      renderUserList((msg.users || []).filter((u) => u.id !== state.auth.id));
      break;

    case 'session_kicked':
      disconnectWS();
      location.reload();
      break;
  }
}
