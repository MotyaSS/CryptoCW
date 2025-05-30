package server

import (
	"CryptographyCW/pkg/entity"
	"CryptographyCW/pkg/service"
	"log/slog"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type ChatHandler struct {
	s *service.Service
}

func NewHandler(s *service.Service) *ChatHandler {
	return &ChatHandler{s: s}
}

func (h *ChatHandler) InitRoutes() http.Handler {
	router := http.NewServeMux()
	router.HandleFunc("/ws/{room_name}", h.JoinRoom)
	router.HandleFunc("POST /add_room", withCORS(h.CreateRoomHandler))
	router.HandleFunc("POST /delete_room", withCORS(h.DeleteRoomHandler))

	return router
}

func withCORS(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*") // caution: for dev purpose only!!!
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		h(w, r)
	}
}

func (h *ChatHandler) CreateRoomHandler(w http.ResponseWriter, r *http.Request) {
	name := r.FormValue("room_name")
	password := r.FormValue("password")
	algorithm := r.FormValue("algorithm")

	if name == "" || password == "" {
		w.WriteHeader(http.StatusBadRequest)
		http.Error(w, "name or password is empty", http.StatusBadRequest)
		slog.Warn("Handler.CreateRoomHandler name or password is empty")
		return
	}

	// Validate algorithm
	if algorithm != string(entity.RC5) && algorithm != string(entity.TwoFish) {
		w.WriteHeader(http.StatusBadRequest)
		http.Error(w, "invalid encryption algorithm", http.StatusBadRequest)
		slog.Warn("Handler.CreateRoomHandler invalid algorithm", "algorithm", algorithm)
		return
	}

	// TODO: pass to kafka
	err := h.s.CreateRoom(name, password, entity.EncryptionAlgorithm(algorithm))
	if err != nil {
		slog.Warn("Handler.DeleteRoomHandler failed to delete",
			"err", err,
		)
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(err.Error()))
		return
	}
}

func (h *ChatHandler) DeleteRoomHandler(w http.ResponseWriter, r *http.Request) {
	name := r.FormValue("name")
	password := r.FormValue("password")

	if name == "" || password == "" {
		w.WriteHeader(http.StatusBadRequest)
		slog.Warn("Handler.DeleteRoomHandler name or password is empty")
		return
	}

	// TODO: pass to kafka
	err := h.s.DeleteRoom(name, password)
	if err != nil {
		slog.Warn("Handler.DeleteRoomHandler failed to delete",
			"err", err,
		)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}

func (h *ChatHandler) JoinRoom(w http.ResponseWriter, r *http.Request) {
	// init connection
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Warn("Handler.WSHandler failed to upgrade:", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	name := r.FormValue("room_name")
	password := r.FormValue("room_password")
	username := r.FormValue("username")

	if name == "" || password == "" || username == "" {
		slog.Warn("Handler.WSHandler name, password or username is empty")
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("name or password is empty"))
		return
	}

	if err = h.s.Connect(name, password, entity.NewClient(username, ws)); err != nil {
		slog.Warn("Handler.WSHandler failed to connect:", "error", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}
