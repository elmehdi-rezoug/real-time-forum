Epic 1 — Subtask Plan

This document lists the ordered subtasks for Epic 1 (Real-Time Private Messaging) and the exact files to create or modify.

### 1. Database Schema & Models — Finished

- Goal: Define data structures for private messages (with timestamps) and track user activity for sorting.
- Modify: `backend/database/schema.sql` — add a `messages` table and update user activity columns.
- Modify: `backend/database/helpers.go` — add queries for message insertion, retrieval, and user status updates.
- Modify: `backend/types/types.go` — add structs for WebSocket payloads and message data.

### 2. WebSocket Connection Management — Finished

- Goal: Establish WebSocket upgrade handling and maintain a client registry mapping each authenticated user to multiple concurrent connections (multi-tab support).
- Modify: `backend/routing/routing.go` — register the WebSocket endpoint (e.g., `/ws`).
- Create: `backend/handlers/websocket.go` — implement connection upgrade, multi-tab client registry (`map[userID][]*websocket.Conn`), and read/write pumps.

### 3. User List & Status Broadcast — Finished

- Goal: Retrieve online/offline user list, sort by recent activity, and broadcast status changes to connected clients.
- Modify: `backend/handlers/websocket.go` — add broadcast logic for user status events.
- Modify: `backend/database/helpers.go` — add query to fetch and sort users by last activity.

### 4. Message History & Pagination — Finished

- Goal: Fetch historical messages between two users with a page size of 10 and offset-based pagination.
- Modify: `backend/handlers/websocket.go` — handle incoming requests for older messages via WS (or create a REST endpoint if preferred).

### 5. Backend Real-Time Message Routing — Finished

- Goal: Process incoming private messages via WebSockets, persist them to the database, and route the message payload to all active connections (tabs) of both the sender and the recipient.
- Modify: `backend/handlers/websocket.go` — add logic to parse incoming chat messages, call database insertion methods, and broadcast the message to the targeted users' connection arrays.

### 6. Frontend UI Structure & Styling — Finished

- Goal: Inject DOM containers for the always-visible user list and chat window without changing the base HTML file.
- Modify: `frontend/static/js/chatpanel.js` — dynamically generate and inject user list and chat window elements.
- Modify: `frontend/static/css/style.css` — add styles for online/offline indicators, message formatting, and scrollable chat areas.

### 7. Client-Side WebSocket & Real-Time Events — Finished

- Goal: Connect to the WebSocket server from the client, send/receive private messages, and update the UI in real time.
- Modify: `frontend/static/js/app-events.js` — register new chat and status events.
- Modify: `frontend/static/js/chatpanel.js` — handle WS connection, message rendering, and user list sorting logic.

### 8. Frontend Scroll-Based Pagination — Planned

- Goal: Detect scroll-to-top in the chat window and request 10 older messages, prepending them to the DOM.
- Modify: `frontend/static/js/chatpanel.js` — add scroll event listener, throttle/debounce logic, pagination state, and prepend behavior.
