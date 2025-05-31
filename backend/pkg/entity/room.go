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

type Mode string

const (
	ECB  Mode = "ECB"
	CBC  Mode = "CBC"
	PCBC Mode = "PCBC"
	CFB  Mode = "CFB"
	OFB  Mode = "OFB"
	CTR  Mode = "CTR"
)

type Padding string

const (
	Zeros    Padding = "Zeros"
	PKCS7    Padding = "PKCS7"
	ISO10126 Padding = "ISO10126"
	ANSIX923 Padding = "ANSIX923"
)

type Room struct {
	Name     string
	Password string
	Algo     EncryptionAlgorithm
	Mode     Mode
	Padding  Padding
	Client1  *Client
	ToC1     chan Message
	Client2  *Client
	ToC2     chan Message
}
