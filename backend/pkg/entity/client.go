package entity

import (
	"encoding/base64"
	"fmt"
	"log/slog"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	Username string
	Room     *Room
	To       <-chan Message
	From     chan<- Message
	ws       *websocket.Conn
}

func NewClient(username string, ws *websocket.Conn) *Client {
	return &Client{
		Username: username,
		ws:       ws,
	}
}

func (c *Client) StartServing() {
	go c.handleWrite()
	go c.handleRead()
}

func (c *Client) handleWrite() {
	defer func() {
		room := c.Room
		if room == nil {
			return
		}
		if room.Client1 == c {
			// Promote Client2 to Client1 if present
			if room.Client2 != nil {
				room.Client1 = room.Client2
				room.Client2 = nil
				// Swap channels
				room.ToC1, room.ToC2 = room.ToC2, room.ToC1
			} else {
				room.Client1 = nil
			}
		} else if room.Client2 == c {
			room.Client2 = nil
		}
	}()

	for {
		select {
		case msg, ok := <-c.To:
			if !ok {
				slog.Info("Channel closed, stopping write handler")
				return
			}

			// Ensure proper message formatting
			if msg.SentAt.IsZero() {
				msg.SentAt = time.Now()
			}
			if msg.MsgType == "" {
				msg.MsgType = "text"
			}

			// For text messages, ensure content is base64 encoded
			if msg.MsgType == "text" {
				if content, ok := msg.Content.([]byte); ok {
					msg.Content = base64.StdEncoding.EncodeToString(content)
				}
			}

			slog.Info("Writing message",
				"from", msg.From,
				"type", msg.MsgType,
				"content_type", fmt.Sprintf("%T", msg.Content),
				"iv_present", msg.IV != nil,
				"time", msg.SentAt)

			if err := c.ws.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
				slog.Error("SetWriteDeadline failed:", "error", err)
				return
			}

			// Use WriteJSON with our sanitized struct
			if err := c.ws.WriteJSON(msg); err != nil {
				slog.Error("Write failed:", err)
				return
			}

		case <-time.After(time.Second * 1):
			// Send ping to check connection health
			if err := c.ws.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second)); err != nil {
				c.From <- Message{
					From:    "system",
					SentAt:  time.Now(),
					MsgType: "client_disconnected",
					Content: c.Username,
				}
				slog.Warn("Ping failed, closing connection:", "error", err)
				return
			}
		}
	}
}

func (c *Client) handleRead() {
	defer func() {
		c.ws.Close()
	}()

	for {
		var msg Message
		err := c.ws.ReadJSON(&msg)

		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Error("WebSocket read error:", err)
			}
			return
		}

		// For text messages, ensure content is []byte
		if msg.MsgType == "text" {
			if content, ok := msg.Content.(string); ok {
				decoded, err := base64.StdEncoding.DecodeString(content)
				if err != nil {
					slog.Error("Failed to decode base64 content:", err)
					continue
				}
				msg.Content = decoded
			}
		}

		slog.Info("Received message",
			"from", msg.From,
			"type", msg.MsgType,
			"content_type", fmt.Sprintf("%T", msg.Content),
			"iv_present", msg.IV != nil,
			"time", msg.SentAt)

		// Set default values if empty
		if msg.From == "" {
			msg.From = c.Username
		}
		if msg.SentAt.IsZero() {
			msg.SentAt = time.Now()
		}
		if msg.MsgType == "" {
			msg.MsgType = "text"
		}

		// For system messages, don't expect IV
		if msg.MsgType != "text" && msg.MsgType != "file_start" {
			msg.IV = nil
		}

		// Send to the client's channel
		select {
		case c.From <- msg:
			// Message sent successfully
		default:
			slog.Warn("Client message channel blocked, dropping message")
		}
	}
}
