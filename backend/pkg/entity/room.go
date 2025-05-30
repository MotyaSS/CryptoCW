package entity

import (
	"errors"
)

var RoomFull = errors.New("room is full")
var RoomNotFound = errors.New("room not found")

type EncryptionAlgorithm string

const (
	RC5     EncryptionAlgorithm = "RC5"
	TwoFish EncryptionAlgorithm = "TwoFish"
)

type Room struct {
	Name             string
	Password         string
	Algo             EncryptionAlgorithm
	Client1, Client2 *Client
	ToC1, ToC2       chan Message
}
