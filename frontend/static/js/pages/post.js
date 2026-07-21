import { state } from '../state.js';
import { fetchPostAndComments } from '../comments.js';
import { renderNavbar } from '../navbar.js';
import { renderChatUsers, injectChatLayout, openChatPanel } from '../Chatui.js';
import { initWebSocket, chatState } from '../ChatData.js';

async function fetchChatUsers() {
  try {
    const response = await fetch('/api/users');
    if (!response.ok) throw new Error('Failed to fetch chat users');
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch chat users:', error);
    return [];
  }
}

export function renderPostPage(postId) {
  const app = document.getElementById('app');

  app.innerHTML = `
    ${renderNavbar()}
    <div class="container">
      <div class="sidebar-col"></div>
      <main class="content">
        <div id="post-back-wrap">
          <button class="btn post-back-btn" data-action="nav" data-target="/">&larr; Back to Posts</button>
        </div>
        <div id="post-container"></div>
        <div id="comments-container"></div>
        <div id="comment-form-container">
          <textarea id="comment-input" placeholder="Write a comment..."></textarea>
          <button class="btn" data-action="submit-comment" data-post-id="${postId}">Submit Comment</button>
        </div>
        <div id="comments-load-more-wrap"></div>
      </main>
    </div>
  `;

  injectChatLayout();
  initWebSocket();
  fetchChatUsers().then((users) => {
    renderChatUsers(users);
    if (chatState.activeUserId) {
      openChatPanel(chatState.activeUserId);
    }
  });

  fetchPostAndComments(postId);
}
