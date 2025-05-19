package entity

import "time"

type Message struct {
	From     string    `json:"from"`
	SentAt   time.Time `json:"sent_at"`
	MsgType  string    `json:"message_type"` // [text/file_start/file_chunk/file_end/client_connected/client_disconnected]
	Filename string    `json:"filename"`     // for files only
	Content  []byte    `json:"content"`
}
