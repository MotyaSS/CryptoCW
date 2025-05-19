package entity

import (
	"github.com/gorilla/websocket"
)

type Client struct {
	Username string
	ws       *websocket.Conn
}
