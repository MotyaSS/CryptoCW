package server

import (
	"github.com/gorilla/websocket"
	"log/slog"
	"net/http"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type ChatHandler struct {
}

func NewHandler() *ChatHandler {
	return &ChatHandler{}
}

func (h *ChatHandler) InitRoutes() http.Handler {
	router := http.NewServeMux()
	router.HandleFunc("POST /create_room", h.CreateRoomHandler)
	router.HandleFunc("/ws/{room_id}", h.JoinRoom)
	router.HandleFunc("POST /delete_room", h.DeleteRoomHandler)

	return router
}

func (h *ChatHandler) CreateRoomHandler(w http.ResponseWriter, r *http.Request) {
	name := r.FormValue("name")
	password := r.FormValue("password")
	// TODO: pass to kafka
}

func (h *ChatHandler) DeleteRoomHandler(w http.ResponseWriter, r *http.Request) {
	name := r.FormValue("name")
	password := r.FormValue("password")
	// TODO: pass to kafka
}

func (h *ChatHandler) JoinRoom(w http.ResponseWriter, r *http.Request) {
	// init connection
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Warn("Handler.WSHandler failed to upgrade:", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	defer ws.Close()

	name := r.FormValue("room_name")
	password := r.FormValue("room_password")
	if name == "" || password == "" {
		slog.Warn("Handler.WSHandler name or password is empty")
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("name or password is empty"))
		return
	}

	// TODO: connect to room
}
