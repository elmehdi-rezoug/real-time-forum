# Epics

## Epic 1 — Real-Time Private Messaging

- **Title:** Real-Time Private Messaging
- **Specification:** Build real-time user-to-user chat via WebSockets with an always-visible online/offline user list sorted by recent activity. The chat interface must display formatted messages with timestamps and support scroll-based pagination loading 10 older messages at a time.
- **Dependencies:** None (requires existing Authentication and SPA foundation).

## Epic 2 — Live Typing Indicators

- **Title:** Live Typing Indicators
- **Specification:** Add a real-time visual animation to the private messaging interface showing when a conversation partner is actively typing. Use keyboard and focus events to start/stop the animation smoothly and reliably.
- **Dependencies:** Requires Epic 1 to be finished.
