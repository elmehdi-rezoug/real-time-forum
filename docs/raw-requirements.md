# Real-Time Forum & Messaging SPA

## 1. Technical Constraints & Objectives

- **Architecture:** Single Page Application (SPA). Only one HTML file; all page transitions and logic must be handled via JavaScript.
- **Core Stack:** Golang (backend & WebSockets), SQLite (database), Vanilla JavaScript (frontend), HTML & CSS.
- **Prohibited:** No frontend frameworks or libraries (e.g., React, Angular, Vue).
- **Allowed Packages:** Standard Go packages, `gorilla/websocket`, `mattn/go-sqlite3`, `golang.org/x/crypto/bcrypt`, `gofrs/uuid` or `google/uuid`.
- **Learning Outcomes:** HTTP, sessions/cookies, DOM manipulation, goroutines/channels, WebSockets (Go & JS), SQL, and JS events (keyboard, focus, scroll).

## 2. Features & Functional Evaluation

### Authentication (Registration & Login)

- **Specification:** Unauthenticated users should only see login/register pages. Registration requires Nickname, Age, Gender, First Name, Last Name, E-mail, and Password. Login uses Password combined with either Nickname or E-mail. Users must be able to log out from any page.

- **Evaluation Checklist:**
  - Can users register and does the form request all required fields?
  - Does login fail for unregistered users?
  - Does the login accept nickname or email combined with password?
  - Can a logged-in user log out from multiple pages?

### Posts and Comments

- **Specification:** Users can create categorized posts and comment on them. Posts display in a main feed; comments become visible when viewing a specific post.

- **Evaluation Checklist:**
  - Can a user create a post?
  - After logging in, is the created post visible?
  - Can a logged-in user comment on a post and then view that comment when opening the post?

### Real-Time Private Messages

- **Specification:** Real-time chat via WebSockets. An always-visible user list displays online/offline users sorted by last message sent (or alphabetically for new users). Chat messages must show sender name and timestamp. The UI loads the 10 most recent messages and uses throttle/debounce on scroll to paginate 10 older messages at a time.

- **Evaluation Checklist:**
  - Is there a section to show online users?
  - Are chat users ordered by last message sent (with new users sorted alphabetically)?
  - Does sending a message format it with the user's name and timestamp?
  - Do messages arrive in real time across multiple browsers without refresh?
  - Does the chat show only the last 10 messages initially and load 10 more on scroll-up?
  - Is scroll pagination debounced/throttled to avoid repeated requests?

### Typing-In-Progress Engine

- **Specification:** A real-time typing indicator using WebSockets and JS keyboard/focus events. The indicator should be smooth and include the typing user's name. It must stop when the user stops typing, loses focus, or finishes.

- **Evaluation Checklist:**
  - Does the typing indicator display in real time across browsers when a user starts typing?
  - Is the animation smooth and user-friendly?
  - Does it show the typing user's name?
  - Does the indicator stop appropriately when typing ceases or focus is lost?
  - Does the typing indicator work correctly for both participants in a conversation?
