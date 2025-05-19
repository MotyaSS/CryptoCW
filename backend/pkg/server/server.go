package server

import (
	"CryptographyCW/pkg/service"
	"net/http"
)

type Server struct {
	service *service.Service
	handler http.Handler
}

func NewServer() *Server {
	return &Server{
		service: service.NewService(),
		handler: NewHandler().InitRoutes(),
	}
}

func (s *Server) Run(addr string) error {
	return http.ListenAndServe(addr, s.handler)
}
