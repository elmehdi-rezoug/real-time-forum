package types

type CommentPayload struct {
	PostID  int    `json:"post_id"`
	Content string `json:"content"`
	UserID  int    `json:"user_id"`
}

type CommentsResponse struct {
	Comments []Comment `json:"comments"`
}

type Comment struct {
	Nickname  string `json:"nickname"`
	Content   string `json:"content"`
	CreatedAt string `json:"created_at"`
}

// MessagePayload represents the data a client sends to send a private message.
type MessagePayload struct {
	SenderID   int    `json:"sender_id"`
	ReceiverID int    `json:"receiver_id"`
	Content    string `json:"content"`
}

// WebSocketPayload represents the envelope used for real-time socket events.
type WebSocketPayload struct {
	Type     string   `json:"type"`
	Message  *Message `json:"message,omitempty"`
	UserID   int      `json:"user_id,omitempty"`
	Nickname string   `json:"nickname,omitempty"`
}

// Message represents the actual private message data stored and exchanged.
type Message struct {
	ID             int    `json:"id"`
	SenderID       int    `json:"sender_id"`
	ReceiverID     int    `json:"receiver_id"`
	Content        string `json:"content"`
	CreatedAt      string `json:"created_at"`
	SenderNickname string `json:"sender_nickname"`
}
