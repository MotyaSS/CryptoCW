package entity

import (
	"errors"
)

var RoomFull = errors.New("room is full")
var RoomNotFound = errors.New("room not found")

type encryptionAlgorithm string

const (
	RC5     encryptionAlgorithm = "RC5"
	TwoFish encryptionAlgorithm = "TwoFish"
)

type Room struct {
	Name             string
	Password         string
	Client1, Client2 *Client
	Algo             encryptionAlgorithm
	broadcast        chan *Message
	done             chan struct{}
}
