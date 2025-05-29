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
	Algo             encryptionAlgorithm
	Client1, Client2 *Client
	ToC1, ToC2       chan Message
}
