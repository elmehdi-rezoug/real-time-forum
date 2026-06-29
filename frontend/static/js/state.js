export const state = {
  auth: { authenticated: false, user: null },
};

export function resetAuth() {
  state.auth = { authenticated: false, user: null };
}

export async function initAuth() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) throw new Error('auth check failed');
    state.auth = await res.json();
  } catch (err) {
    console.error('initAuth error:', err);
    state.auth = { authenticated: false, user: null };
  }
}
