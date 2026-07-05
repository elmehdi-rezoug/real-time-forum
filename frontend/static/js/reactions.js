// reactions.js
import { state } from './state.js';
import { navigateTo } from './routeer.js';
import { displayMessage } from './toast.js';

export async function reactToPost(postId, type) {
  try {
    const res = await fetch('/api/posts/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, type }),
    });
    const data = await res.json();
    updateReactionUI(postId, data);
  } catch (err) {
    console.error('reactToPost error:', err);
    displayMessage('Network error. Please try again.', true);
  }
}

export function renderReactionBar(post) {
  const liked = post.user_reaction === 'like';
  const disliked = post.user_reaction === 'dislike';
  return `
    <div class="post-reactions" data-post-id="${post.id}">
      <button class="react-btn like-btn ${liked ? 'active' : ''}"
              data-action="react" data-post-id="${
                post.id
              }" data-reaction-type="like">
        👍 <span class="like-count">${post.like_count}</span>
      </button>
      <button class="react-btn dislike-btn ${disliked ? 'active' : ''}"
              data-action="react" data-post-id="${
                post.id
              }" data-reaction-type="dislike">
        👎 <span class="dislike-count">${post.dislike_count}</span>
      </button>
    </div>`;
}

function updateReactionUI(postId, data) {
  const bar = document.querySelector(
    `.post-reactions[data-post-id="${postId}"]`
  );
  if (!bar) return;

  bar.querySelector('.like-count').textContent = data.like_count;
  bar.querySelector('.dislike-count').textContent = data.dislike_count;
  bar
    .querySelector('.like-btn')
    .classList.toggle('active', data.user_reaction === 'like');
  bar
    .querySelector('.dislike-btn')
    .classList.toggle('active', data.user_reaction === 'dislike');
}
