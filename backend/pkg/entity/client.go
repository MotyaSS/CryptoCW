package entity

import (
	"github.com/gorilla/websocket"
	"log/slog"
	"time"
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
		case msg, ok := <-c.To: // from kafka
			if !ok {
				slog.Info("Channel closed, stopping write handler")
				return
			}
			err := c.ws.WriteJSON(msg)
			if err != nil {
				slog.Error("Error writing to client:",
					"err", err,
				)
				return
			}

		case <-time.After(time.Second * 30):
			slog.Warn("Timed out writing to client")
		}
	}
}

func (c *Client) handleRead() {
	defer func() {
		c.ws.Close()
	}()
	for {
		msg := Message{}
		err := c.ws.ReadJSON(&msg)
		if err != nil {
			slog.Error("Error reading from client:", err)
			return
		}
		// Try to send to c.From, but check if closed
		select {
		case c.From <- msg:
			// sent successfully
		}
	}
}
