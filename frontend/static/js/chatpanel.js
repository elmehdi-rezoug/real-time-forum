import { state } from './state.js';
import { displayMessage } from './toast.js';
import { escapeHTML } from './utils.js';

const HISTORY_SCROLL_THROTTLE_MS = 250;

const chatState = {
  socket: null,
  usersById: new Map(),
  activeUserId: null,
  historyOffsetByPartner: new Map(),
  hasMoreHistoryByPartner: new Map(),
  historyLoadingByPartner: new Map(),
  renderedMessageIdsByPartner: new Map(),
  pendingHistoryRequest: null,
  lastScrollLoadAt: 0,
};

function ensureChatSidebar() {
  const sidebarCol = document.querySelector('.sidebar-col');
  if (!sidebarCol) return null;

  let sidebar = document.getElementById('chat-sidebar');
  if (sidebar) return sidebar;

  sidebar = document.createElement('aside');
  sidebar.id = 'chat-sidebar';
  sidebar.className = 'chat-sidebar';
  sidebar.innerHTML = `
    <div class="chat-sidebar-head">
      <h3 class="chat-sidebar-title">Direct Messages</h3>
      <span id="chat-online-count" class="chat-online-count">0 online</span>
    </div>
    <div id="chat-user-list" class="chat-user-list">
      <div class="chat-empty-list">No conversations yet.</div>
    </div>`;

  sidebarCol.prepend(sidebar);
  return sidebar;
}

function ensureChatDock() {
  const container = document.querySelector('.container');
  if (!container) return null;

  let dock = document.getElementById('chat-panel-dock');
  if (dock) return dock;

  dock = document.createElement('aside');
  dock.id = 'chat-panel-dock';
  dock.className = 'chat-panel-dock';
  container.appendChild(dock);
  return dock;
}

export function injectChatLayout() {
  const sidebar = ensureChatSidebar();
  const dock = ensureChatDock();
  return Boolean(sidebar && dock);
}

function parseUserId(input) {
  const id = Number(input);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

function parseMessageDate(stamp) {
  if (!stamp) return 0;
  const asDate = new Date(stamp);
  if (Number.isNaN(asDate.getTime())) return 0;
  return asDate.getTime();
}

function formatRelativeStamp(stamp) {
  const time = parseMessageDate(stamp);
  if (!time) return '';
  return new Date(time).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeUser(input = {}) {
  const id = parseUserId(input.id ?? input.user_id ?? input.userId);
  if (!id) return null;

  return {
    id,
    nickname: String(input.nickname || input.name || 'User'),
    online: Boolean(input.online),
    unread: Number(input.unread || 0),
    lastMessage: String(
      input.lastMessage || input.last_message || input.preview || '',
    ),
    lastMessageTime:
      input.lastMessageTime || input.last_message_time || input.last_seen || '',
  };
}

function getOrCreateRenderedMessageSet(partnerId) {
  if (!chatState.renderedMessageIdsByPartner.has(partnerId)) {
    chatState.renderedMessageIdsByPartner.set(partnerId, new Set());
  }
  return chatState.renderedMessageIdsByPartner.get(partnerId);
}

function upsertUser(rawUser = {}) {
  const normalized = normalizeUser(rawUser);
  if (!normalized) return null;

  const existing = chatState.usersById.get(normalized.id);
  const merged = {
    ...existing,
    ...normalized,
    nickname: normalized.nickname || existing?.nickname || 'User',
    lastMessage: normalized.lastMessage || existing?.lastMessage || '',
    lastMessageTime:
      normalized.lastMessageTime || existing?.lastMessageTime || '',
    unread:
      typeof normalized.unread === 'number'
        ? normalized.unread
        : Number(existing?.unread || 0),
  };

  chatState.usersById.set(merged.id, merged);
  return merged;
}

function ensureUser(userId, nickname = '') {
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

function getSortedUsers() {
  const currentUserId = parseUserId(state.auth.id);

  return [...chatState.usersById.values()]
    .filter((user) => user.id !== currentUserId)
    .sort((a, b) => {
      const aStamp = parseMessageDate(a.lastMessageTime);
      const bStamp = parseMessageDate(b.lastMessageTime);
      const aHasStamp = aStamp > 0;
      const bHasStamp = bStamp > 0;

      if (aHasStamp && bHasStamp) return bStamp - aStamp;
      if (aHasStamp !== bHasStamp) return bHasStamp - aHasStamp;

      return a.nickname.localeCompare(b.nickname, undefined, {
        sensitivity: 'base',
      });
    });
}

function updatePanelStatus(isOnline) {
  const statusEl = document.getElementById('chat-panel-status');
  if (!statusEl) return;

  statusEl.textContent = isOnline ? 'Online' : 'Offline';
  statusEl.classList.toggle('st-on', isOnline);
  statusEl.classList.toggle('st-off', !isOnline);
}

function renderMessageHTML(message) {
  const currentUserId = parseUserId(state.auth.id);
  const mine = message.sender_id === currentUserId;
  const sender = String(message.sender_nickname || (mine ? 'You' : 'User'));
  const stamp = formatRelativeStamp(message.created_at);

  return `
    <div class="chat-msg ${mine ? 'mine' : 'theirs'}" data-message-id="${message.id}">
      <div class="chat-msg-meta">
        <span class="chat-sender">${escapeHTML(sender)}</span>
        <span class="chat-time">${escapeHTML(stamp)}</span>
      </div>
      <div class="chat-bubble">${escapeHTML(String(message.content || ''))}</div>
    </div>`;
}

function getMessagesContainer() {
  return document.getElementById('chat-messages-list');
}

function appendMessageToActiveChat(message) {
  const container = getMessagesContainer();
  if (!container || chatState.activeUserId === null) return;

  const messageID = Number(message.id);
  const renderedSet = getOrCreateRenderedMessageSet(chatState.activeUserId);
  if (Number.isFinite(messageID) && renderedSet.has(messageID)) return;
  if (Number.isFinite(messageID)) renderedSet.add(messageID);

  const noHistory = container.querySelector('.chat-no-history');
  if (noHistory) noHistory.remove();

  container.insertAdjacentHTML('beforeend', renderMessageHTML(message));
  container.scrollTop = container.scrollHeight;
}

function prependMessageToActiveChat(message) {
  const container = getMessagesContainer();
  if (!container || chatState.activeUserId === null) return;

  const messageID = Number(message.id);
  const renderedSet = getOrCreateRenderedMessageSet(chatState.activeUserId);
  if (Number.isFinite(messageID) && renderedSet.has(messageID)) return;
  if (Number.isFinite(messageID)) renderedSet.add(messageID);

  const previousScrollHeight = container.scrollHeight;
  const noHistory = container.querySelector('.chat-no-history');
  if (noHistory) noHistory.remove();

  container.insertAdjacentHTML('afterbegin', renderMessageHTML(message));
  container.scrollTop = container.scrollHeight - previousScrollHeight;
}

function updateConversationAfterMessage(message) {
  const currentUserId = parseUserId(state.auth.id);
  if (!currentUserId) return;

  const senderID = parseUserId(message.sender_id);
  const receiverID = parseUserId(message.receiver_id);
  if (!senderID || !receiverID) return;

  const partnerID = senderID === currentUserId ? receiverID : senderID;
  const partner = ensureUser(partnerID, message.sender_nickname);

  partner.lastMessage = String(message.content || '');
  partner.lastMessageTime = message.created_at || new Date().toISOString();

  const incomingFromPartner = senderID === partnerID;
  if (incomingFromPartner && chatState.activeUserId !== partnerID) {
    partner.unread = Number(partner.unread || 0) + 1;
  } else if (chatState.activeUserId === partnerID) {
    partner.unread = 0;
  }

  chatState.usersById.set(partnerID, partner);
  renderChatUsers();
}

function handleHistoryScrollLoad(e) {
  const currentPartnerId = chatState.activeUserId;
  if (!currentPartnerId) return;
  if (e.target.scrollTop > 40) return;

  const now = Date.now();
  if (now - chatState.lastScrollLoadAt < HISTORY_SCROLL_THROTTLE_MS) return;
  chatState.lastScrollLoadAt = now;

  const hasMore = chatState.hasMoreHistoryByPartner.get(currentPartnerId);
  const loading = chatState.historyLoadingByPartner.get(currentPartnerId);
  if (!hasMore || loading) return;

  const offset = chatState.historyOffsetByPartner.get(currentPartnerId) || 0;
  requestHistory(currentPartnerId, offset);
}

function requestHistory(partnerId, offset) {
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
    }),
  );
}

function renderPanelShell(user) {
  const dock = document.getElementById('chat-panel-dock');
  const container = document.querySelector('.container');
  if (!dock || !container) return;

  dock.innerHTML = `
    <div class="chat-panel">
      <div class="chat-panel-header">
        <div class="chat-panel-user">
          <div class="chat-avatar sm">${escapeHTML(
            (user.nickname[0] || '?').toUpperCase(),
          )}</div>
          <span class="chat-panel-name">${escapeHTML(user.nickname)}</span>
          <span
            id="chat-panel-status"
            class="chat-panel-status ${user.online ? 'st-on' : 'st-off'}"
          >${user.online ? 'Online' : 'Offline'}</span>
        </div>
        <button class="chat-close" data-action="close-chat" title="Close chat">✕</button>
      </div>
      <div id="chat-messages-list" class="chat-messages">
        <div class="chat-no-history">No messages yet.</div>
      </div>
      <div class="chat-input-row">
        <input
          id="chat-input"
          class="chat-input"
          placeholder="Write a private message..."
          maxlength="500"
        >
        <button class="chat-send" data-action="send-chat-message" title="Send message">➤</button>
      </div>
    </div>`;

  const messagesContainer = getMessagesContainer();
  if (messagesContainer) {
    messagesContainer.addEventListener('scroll', handleHistoryScrollLoad);
  }

  container.classList.add('chat-open');
  dock.classList.add('open');
}

export function renderChatUsers(users) {
  if (!injectChatLayout()) return;

  if (Array.isArray(users)) {
    users.forEach((entry) => {
      upsertUser(entry);
    });
  }

  const list = document.getElementById('chat-user-list');
  const onlineCount = document.getElementById('chat-online-count');
  if (!list || !onlineCount) return;

  const sortedUsers = getSortedUsers();
  const onlineTotal = sortedUsers.filter((u) => u.online).length;
  onlineCount.textContent = `${onlineTotal} online`;

  if (sortedUsers.length === 0) {
    list.innerHTML = '<div class="chat-empty-list">No conversations yet.</div>';
    return;
  }

  list.innerHTML = sortedUsers
    .map((user) => {
      const firstLetter = (user.nickname[0] || '?').toUpperCase();
      const preview = user.lastMessage || 'No messages yet';
      const stamp = formatRelativeStamp(user.lastMessageTime);

      return `
        <div
          class="chat-user-item ${user.online ? '' : 'offline'} ${
            chatState.activeUserId === user.id ? 'active' : ''
          }"
          data-user-id="${user.id}"
          data-user-nickname="${escapeHTML(user.nickname)}"
          data-action="open-chat"
          role="button"
          tabindex="0"
          aria-label="Open chat with ${escapeHTML(user.nickname)}"
        >
          <div class="chat-avatar">
            ${escapeHTML(firstLetter)}
            <span class="chat-dot ${user.online ? 'dot-on' : 'dot-off'}"></span>
          </div>
          <div class="chat-user-info">
            <div class="chat-user-row">
              <span class="chat-username">${escapeHTML(user.nickname)}</span>
              ${stamp ? `<span class="chat-last-time">${escapeHTML(stamp)}</span>` : ''}
              ${user.unread > 0 ? `<span class="chat-badge">${user.unread}</span>` : ''}
            </div>
            <div class="chat-preview ${preview === 'No messages yet' ? 'chat-no-msg' : ''}">
              ${escapeHTML(preview)}
            </div>
          </div>
        </div>`;
    })
    .join('');
}

export function openChatPanel(userId) {
  if (!injectChatLayout()) return;

  const parsedUserId = parseUserId(userId);
  if (!parsedUserId) return;

  const user = ensureUser(parsedUserId);
  user.unread = 0;
  chatState.usersById.set(parsedUserId, user);
  chatState.activeUserId = parsedUserId;
  renderChatUsers();

  chatState.historyOffsetByPartner.set(parsedUserId, 0);
  chatState.hasMoreHistoryByPartner.set(parsedUserId, true);
  chatState.historyLoadingByPartner.set(parsedUserId, false);
  chatState.renderedMessageIdsByPartner.set(parsedUserId, new Set());

  renderPanelShell(user);
  requestHistory(parsedUserId, 0);
}

export function closeChatPanel() {
  const dock = document.getElementById('chat-panel-dock');
  const container = document.querySelector('.container');

  if (dock) {
    dock.innerHTML = '';
    dock.classList.remove('open');
  }
  if (container) container.classList.remove('chat-open');

  chatState.activeUserId = null;
  renderChatUsers();
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
    }),
  );

  input.value = '';
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

    messages.forEach((message) => prependMessageToActiveChat(message));
  }
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
        new CustomEvent('chat:socket-status', { detail: payload }),
      );
      return;
    }

    // Handle force logout message
    if (payload?.type === 'force_logout') {
      console.log('Received force_logout message:', payload);
      // Dispatch a custom event that auth.js can listen to
      document.dispatchEvent(
        new CustomEvent('auth:force-logout', { detail: payload }),
      );
      return;
    }

    document.dispatchEvent(
      new CustomEvent('chat:socket-chat', { detail: payload }),
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

  chatState.usersById.clear();
  chatState.activeUserId = null;
  chatState.historyOffsetByPartner.clear();
  chatState.hasMoreHistoryByPartner.clear();
  chatState.historyLoadingByPartner.clear();
  chatState.renderedMessageIdsByPartner.clear();
  chatState.pendingHistoryRequest = null;
  chatState.lastScrollLoadAt = 0;
}
