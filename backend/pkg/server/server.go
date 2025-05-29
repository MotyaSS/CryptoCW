package server

import (
	"net/http"
)

type Server struct {
	handler http.Handler
}

func NewServer(h *ChatHandler) *Server {
	return &Server{
		handler: h.InitRoutes(),
	}
}

func (s *Server) Run(addr string) error {
	return http.ListenAndServe(addr, s.handler)
}
