package main

import (
	"CryptographyCW/pkg/server"
	"CryptographyCW/pkg/service"
	"log/slog"
	"os"
)

func main() {
	slog.SetDefault(
		slog.New(slog.NewJSONHandler(
			os.Stdout, nil),
		),
	)
	s := server.NewServer(server.NewHandler(service.NewService()))
	slog.Error(s.Run(":8080").Error())
}
