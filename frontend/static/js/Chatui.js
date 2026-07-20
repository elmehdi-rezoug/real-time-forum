import { state } from './state.js';
import { escapeHTML } from './utils.js';
import {
  chatState,
  parseUserId,
  formatRelativeStamp,
  getOrCreateRenderedMessageSet,
  upsertUser,
  ensureUser,
  getSortedUsers,
  requestHistory,
  handleHistoryScrollLoad,
} from './ChatData.js';

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

export function updatePanelStatus(isOnline) {
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
    <div class="chat-msg ${mine ? 'mine' : 'theirs'}" data-message-id="${
    message.id
  }">
      <div class="chat-msg-meta">
        <span class="chat-sender">${escapeHTML(sender)}</span>
        <span class="chat-time">${escapeHTML(stamp)}</span>
      </div>
      <div class="chat-bubble">${escapeHTML(
        String(message.content || '')
      )}</div>
    </div>`;
}

export function getMessagesContainer() {
  return document.getElementById('chat-messages-list');
}

export function appendMessageToActiveChat(message) {
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

export function prependMessageToActiveChat(message) {
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

export function updateConversationAfterMessage(message) {
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

function renderPanelShell(user) {
  const dock = document.getElementById('chat-panel-dock');
  const container = document.querySelector('.container');
  if (!dock || !container) return;

  dock.innerHTML = `
    <div class="chat-panel">
      <div class="chat-panel-header">
        <div class="chat-panel-user">
          <div class="chat-avatar sm">${escapeHTML(
            (user.nickname[0] || '?').toUpperCase()
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
    // Add scroll event listener with passive option for better performance
    messagesContainer.addEventListener('scroll', handleHistoryScrollLoad, {
      passive: true,
    });
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
              ${
                stamp
                  ? `<span class="chat-last-time">${escapeHTML(stamp)}</span>`
                  : ''
              }
              ${
                user.unread > 0
                  ? `<span class="chat-badge">${user.unread}</span>`
                  : ''
              }
            </div>
            <div class="chat-preview ${
              preview === 'No messages yet' ? 'chat-no-msg' : ''
            }">
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
