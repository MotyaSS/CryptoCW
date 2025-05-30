package main

import (
	"CryptographyCW/pkg/server"
	"CryptographyCW/pkg/service"
	"log/slog"
	"os"
)

func main() {
	slog.SetDefault(
		slog.New(slog.NewTextHandler(
			os.Stdout, &slog.HandlerOptions{
				AddSource:   true,
				ReplaceAttr: nil,
			}),
		),
	)
	s := server.NewServer(server.NewHandler(service.NewService()))
	slog.Error(s.Run(":8080").Error())
}
