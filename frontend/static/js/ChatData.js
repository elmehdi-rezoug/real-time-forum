import { state } from './state.js';
import { displayMessage } from './toast.js';
import {
  renderChatUsers,
  updatePanelStatus,
  appendMessageToActiveChat,
  prependMessageToActiveChat,
  updateConversationAfterMessage,
  getMessagesContainer,
} from './Chatui.js';

const HISTORY_SCROLL_THROTTLE_MS = 1000;

export const chatState = {
  socket: null,
  usersById: new Map(),
  activeUserId: null,
  historyOffsetByPartner: new Map(),
  hasMoreHistoryByPartner: new Map(),
  historyLoadingByPartner: new Map(),
  renderedMessageIdsByPartner: new Map(),
  pendingHistoryRequest: null,
  lastScrollLoadAt: 0,
  throttleTimeoutId: null,
};

export function parseUserId(input) {
  const id = Number(input);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

export function parseMessageDate(stamp) {
  if (!stamp) return 0;
  const asDate = new Date(stamp);
  if (Number.isNaN(asDate.getTime())) return 0;
  return asDate.getTime();
}

export function formatRelativeStamp(stamp) {
  const time = parseMessageDate(stamp);
  if (!time) return '';
  return new Date(time).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizeUser(input = {}) {
  const id = parseUserId(input.id ?? input.user_id ?? input.userId);
  if (!id) return null;

  return {
    id,
    nickname: String(input.nickname || input.name || 'User'),
    online: Boolean(input.online),
    unread: Number(input.unread || 0),
    lastMessage: String(
      input.lastMessage || input.last_message || input.preview || ''
    ),
    lastMessageTime:
      input.lastMessageTime || input.last_message_time || input.last_seen || '',
  };
}

export function getOrCreateRenderedMessageSet(partnerId) {
  if (!chatState.renderedMessageIdsByPartner.has(partnerId)) {
    chatState.renderedMessageIdsByPartner.set(partnerId, new Set());
  }
  return chatState.renderedMessageIdsByPartner.get(partnerId);
}

export function handleHistoryScrollLoad(e) {
  const currentPartnerId = chatState.activeUserId;
  if (!currentPartnerId) return;

  // Only load more history when scrolling up and at the very top
  // scrollTop must be exactly 0 to trigger loading
  const isAtVeryTop = e.target.scrollTop === 0;

  // If we're not at the very top, don't load more history
  if (!isAtVeryTop) return;

  const now = Date.now();
  if (now - chatState.lastScrollLoadAt < HISTORY_SCROLL_THROTTLE_MS) {
    // Even if throttled, we still want to check again after the throttle period
    // Clear any existing timeout
    if (chatState.throttleTimeoutId) {
      clearTimeout(chatState.throttleTimeoutId);
    }

    // Set a timeout to check again after throttle period
    chatState.throttleTimeoutId = setTimeout(() => {
      chatState.throttleTimeoutId = null;
      // Trigger scroll event again to check if we're still at the top
      e.target.dispatchEvent(new Event('scroll'));
    }, HISTORY_SCROLL_THROTTLE_MS - (now - chatState.lastScrollLoadAt));

    return;
  }

  chatState.lastScrollLoadAt = now;

  const hasMore = chatState.hasMoreHistoryByPartner.get(currentPartnerId);
  const loading = chatState.historyLoadingByPartner.get(currentPartnerId);
  if (!hasMore || loading) return;

  const offset = chatState.historyOffsetByPartner.get(currentPartnerId) || 0;
  requestHistory(currentPartnerId, offset);
}

export function upsertUser(rawUser = {}) {
  const normalized = normalizeUser(rawUser);
  if (!normalized) return null;

  const existing = chatState.usersById.get(normalized.id);

  // Only use the incoming unread value if the raw data explicitly provided one;
  // otherwise keep the existing client-side count so that page navigations
  // (which re-fetch /api/users) don't accidentally clear unread badges.
  const hasExplicitUnread = 'unread' in rawUser;

  const merged = {
    ...existing,
    ...normalized,
    nickname: normalized.nickname || existing?.nickname || 'User',
    lastMessage: normalized.lastMessage || existing?.lastMessage || '',
    lastMessageTime:
      normalized.lastMessageTime || existing?.lastMessageTime || '',
    unread: hasExplicitUnread
      ? normalized.unread
      : Number(existing?.unread || 0),
  };

  chatState.usersById.set(merged.id, merged);
  return merged;
}

export function ensureUser(userId, nickname = '') {
  const existing = chatState.usersById.get(userId);
  if (existing) return existing;

  const user = {
    id: userId,
    nickname: nickname || 'User',
    online: false,
    unread: 0,
    lastMessage: '',
    lastMessageTime: '',
  };
  chatState.usersById.set(userId, user);
  return user;
}

export function getSortedUsers() {
  const currentUserId = parseUserId(state.auth.id);

  return [...chatState.usersById.values()]
    .filter((user) => user.id !== currentUserId)
    .sort((a, b) => {
      // Only consider lastMessageTime valid if there's actual message content
      const aHasMsg = Boolean(a.lastMessage);
      const bHasMsg = Boolean(b.lastMessage);
      const aStamp = parseMessageDate(a.lastMessageTime);
      const bStamp = parseMessageDate(b.lastMessageTime);

      // Both have messages → sort by most recent first
      if (aHasMsg && bHasMsg && aStamp > 0 && bStamp > 0) {
        return bStamp - aStamp;
      }
      // One has messages, one doesn't → messages first
      if (aHasMsg !== bHasMsg) return Number(bHasMsg) - Number(aHasMsg);

      // Neither has messages (or can't compare timestamps) → alphabetical A–Z
      return a.nickname.localeCompare(b.nickname, undefined, {
        sensitivity: 'base',
      });
    });
}

export function requestHistory(partnerId, offset) {
  if (
    !chatState.socket ||
    chatState.socket.readyState !== WebSocket.OPEN ||
    !partnerId
  ) {
    return;
  }

  chatState.historyLoadingByPartner.set(partnerId, true);
  chatState.pendingHistoryRequest = { partnerId, offset };

  chatState.socket.send(
    JSON.stringify({
      type: 'get_history',
      partner_id: partnerId,
      offset,
    })
  );
}

export function initWebSocket() {
  const currentUserId = parseUserId(state.auth.id);
  if (!currentUserId) return;

  if (
    chatState.socket &&
    (chatState.socket.readyState === WebSocket.OPEN ||
      chatState.socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const socketURL = `${protocol}://${location.host}/ws`;
  const socket = new WebSocket(socketURL);

  socket.onmessage = (event) => {
    let payload = null;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    if (payload?.type === 'user_online' || payload?.type === 'user_offline') {
      document.dispatchEvent(
        new CustomEvent('chat:socket-status', { detail: payload })
      );
      return;
    }

    // Handle force logout message
    if (payload?.type === 'force_logout') {
      console.log('Received force_logout message:', payload);
      // Dispatch a custom event that auth.js can listen to
      document.dispatchEvent(
        new CustomEvent('auth:force-logout', { detail: payload })
      );
      return;
    }

    document.dispatchEvent(
      new CustomEvent('chat:socket-chat', { detail: payload })
    );
  };

  socket.onclose = () => {
    if (chatState.socket === socket) {
      chatState.socket = null;
    }
  };

  chatState.socket = socket;
}

export function disconnectChatSocket() {
  if (chatState.socket) {
    chatState.socket.close();
    chatState.socket = null;
  }

  // Clear any pending throttle timeout
  if (chatState.throttleTimeoutId) {
    clearTimeout(chatState.throttleTimeoutId);
    chatState.throttleTimeoutId = null;
  }

  chatState.usersById.clear();
  chatState.activeUserId = null;
  chatState.historyOffsetByPartner.clear();
  chatState.hasMoreHistoryByPartner.clear();
  chatState.historyLoadingByPartner.clear();
  chatState.renderedMessageIdsByPartner.clear();
  chatState.pendingHistoryRequest = null;
  chatState.lastScrollLoadAt = 0;
}

export function handleSocketStatusEvent(payload) {
  const userId = parseUserId(payload?.user_id);
  if (!userId) return;

  const user = ensureUser(userId, payload?.nickname);
  user.online = payload?.type === 'user_online';
  if (payload?.nickname) user.nickname = String(payload.nickname);
  chatState.usersById.set(userId, user);

  renderChatUsers();
  if (chatState.activeUserId === userId) {
    updatePanelStatus(user.online);
  }
}

export function handleSocketChatEvent(payload) {
  if (!payload || typeof payload !== 'object') return;

  if (payload.type === 'error') {
    displayMessage(payload.message || 'Chat error', true);
    return;
  }

  if (payload.type === 'new_message' && payload.message) {
    const message = payload.message;
    updateConversationAfterMessage(message);

    const currentUserId = parseUserId(state.auth.id);
    const senderID = parseUserId(message.sender_id);
    const receiverID = parseUserId(message.receiver_id);
    if (!currentUserId || !senderID || !receiverID) return;

    const active = chatState.activeUserId;
    const belongsToActive =
      active &&
      ((senderID === active && receiverID === currentUserId) ||
        (senderID === currentUserId && receiverID === active));

    if (belongsToActive) appendMessageToActiveChat(message);
    return;
  }

  if (payload.type === 'history_response') {
    const request = chatState.pendingHistoryRequest;
    if (!request) return;

    const { partnerId, offset } = request;
    chatState.pendingHistoryRequest = null;
    chatState.historyLoadingByPartner.set(partnerId, false);

    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    chatState.hasMoreHistoryByPartner.set(partnerId, Boolean(payload.has_more));
    chatState.historyOffsetByPartner.set(partnerId, offset + messages.length);

    if (chatState.activeUserId !== partnerId) return;

    const container = getMessagesContainer();
    if (!container) return;

    if (offset === 0) {
      container.innerHTML = '';
      [...messages]
        .reverse()
        .forEach((message) => appendMessageToActiveChat(message));
      if (messages.length === 0) {
        container.innerHTML =
          '<div class="chat-no-history">No messages yet.</div>';
      } else {
        container.scrollTop = container.scrollHeight;
      }
      return;
    }

    const previousScrollTop = container.scrollTop;
    const previousScrollHeight = container.scrollHeight;

    messages.forEach((message) => prependMessageToActiveChat(message));

    // Maintain scroll position relative to bottom when adding older messages
    // This prevents jumping to the top of the message history
    container.scrollTop =
      previousScrollTop + (container.scrollHeight - previousScrollHeight);
  }
}

export function sendActiveChatMessage() {
  const currentUserId = parseUserId(state.auth.id);
  const partnerId = chatState.activeUserId;

  if (!currentUserId || !partnerId) return;
  if (!chatState.socket || chatState.socket.readyState !== WebSocket.OPEN) {
    displayMessage('Chat connection is offline. Please refresh.', true);
    return;
  }

  const input = document.getElementById('chat-input');
  if (!(input instanceof HTMLInputElement)) return;

  const content = input.value.trim();
  if (!content) return;

  chatState.socket.send(
    JSON.stringify({
      type: 'send_message',
      sender_id: currentUserId,
      receiver_id: partnerId,
      content,
    })
  );

  input.value = '';
}
