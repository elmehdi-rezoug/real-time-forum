import { state } from './state.js';
import { navigateTo } from './routeer.js';
import { displayMessage } from './toast.js';
import { disconnectChatSocket } from './ChatData.js';

const LOGOUT_SYNC_KEY = 'forum:auth:logout';
let authSyncInitialized = false;

function applyLoggedOutState(showToast = true) {
  disconnectChatSocket();
  state.auth = { authenticated: false, id: null, nickname: null };
  if (showToast) {
    displayMessage('logout successfully', false);
  }
  navigateTo('/login');
}

function broadcastLogoutToOtherTabs() {
  localStorage.setItem(LOGOUT_SYNC_KEY, String(Date.now()));
}

export function initAuthSync() {
  if (authSyncInitialized) return;
  authSyncInitialized = true;

  window.addEventListener('storage', (event) => {
    if (event.key !== LOGOUT_SYNC_KEY || !event.newValue) return;
    applyLoggedOutState(false);
  });

  // Listen for force logout events from WebSocket
  document.addEventListener('auth:force-logout', (event) => {
    console.log('Received auth:force-logout event:', event.detail);
    // Only handle if the force logout is for the current user
    const currentUserId = state.auth.id;
    console.log(
      'Current user ID:',
      currentUserId,
      'Event user ID:',
      event.detail?.user_id
    );
    if (event.detail?.user_id && event.detail.user_id === currentUserId) {
      console.log('Force logging out user');
      applyLoggedOutState(false);
      broadcastLogoutToOtherTabs();
    }
  });
}

export async function handleLogout() {
  try {
    await fetch('/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout error:', err);
  }

  applyLoggedOutState(true);
  broadcastLogoutToOtherTabs();
}
