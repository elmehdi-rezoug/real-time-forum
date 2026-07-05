// ---- initial REST load ----------------------------------------------

import { escapeHTML } from './utils.js';

export function openChatPanel(userId) {
  const dock = document.getElementById('chat-panel-dock');
  const container = document.querySelector('.container');
  if (!dock || !container) return;

  const item = document.querySelector(
    `.chat-user-item[data-user-id="${userId}"]`
  );
  const nickname = item ? item.dataset.userNickname : 'User';
  const online = item ? !item.classList.contains('offline') : false;

  dock.innerHTML = `
    <div class="chat-panel">
      <div class="chat-panel-header">
        <div class="chat-panel-user">
          <div class="chat-avatar sm">${escapeHTML(
            (nickname[0] || '?').toUpperCase()
          )}</div>
          <span class="chat-panel-name">${escapeHTML(nickname)}</span>
          <span class="chat-panel-status ${online ? 'st-on' : 'st-off'}">${
    online ? 'Online' : 'Offline'
  }</span>
        </div>
        <button class="chat-close" data-action="close-chat" title="Close chat">✕</button>
      </div>
      <div class="chat-messages">
        <div class="chat-no-history">Messaging is coming soon</div>
      </div>
      <div class="chat-input-row disabled">
        <input class="chat-input" placeholder="Messaging coming soon" disabled>
        <button class="chat-send" disabled>➤</button>
      </div>
    </div>`;

  container.classList.add('chat-open');
  dock.classList.add('open');
}

export function closeChatPanel() {
  const dock = document.getElementById('chat-panel-dock');
  const container = document.querySelector('.container');
  if (dock) {
    dock.innerHTML = '';
    dock.classList.remove('open');
  }
  if (container) container.classList.remove('chat-open');
}
