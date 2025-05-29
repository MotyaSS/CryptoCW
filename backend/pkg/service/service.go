package service

import (
	"CryptographyCW/pkg/entity"
	"errors"
	"sync"
)

type Service struct {
	Rooms map[string]*entity.Room
	mutex sync.RWMutex
}

func NewService() *Service {
	return &Service{
		Rooms: make(map[string]*entity.Room),
	}
}

var RoomExistsError = errors.New("room already exists")
var RoomNotFoundError = errors.New("room not found")
var RoomFullError = errors.New("room is full")
var RoomPasswordError = errors.New("room password is incorrect")

func (s *Service) CreateRoom(name string, password string) error {

	s.mutex.Lock()
	defer s.mutex.Unlock()

	if _, ok := s.Rooms[name]; ok {
		return RoomExistsError
	}

	s.Rooms[name] = &entity.Room{
		Name:     name,
		Password: password,
		ToC1:     make(chan entity.Message, 10), // initialize channels
		ToC2:     make(chan entity.Message, 10),
	}

	return nil
}

func (s *Service) DeleteRoom(name string, password string) error {

	s.mutex.Lock()
	defer s.mutex.Unlock()

	if _, ok := s.Rooms[name]; ok {
		delete(s.Rooms, name)
		return nil
	}

	return RoomNotFoundError
}

func (s *Service) Connect(roomName, roomPassword string, newClient *entity.Client) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	room, ok := s.Rooms[roomName]
	if !ok {
		return RoomNotFoundError
	}
	if room.Password != roomPassword {
		return RoomPasswordError
	}
	newClient.Room = room
	if room.Client1 == nil {
		room.Client1 = newClient
		newClient.Room = room
		newClient.To = room.ToC1
		newClient.From = room.ToC2
		return nil
	}

	if room.Client2 == nil {
		room.Client2 = newClient
		newClient.Room = room
		newClient.To = room.ToC2
		newClient.From = room.ToC1

		// Notify Client1 that Client2 has connected
		// TODO: have to be sent to kafka
		select {
		case room.ToC1 <- entity.Message{
			From:    "system",
			MsgType: "client_connected",
			Content: []byte(newClient.Username),
		}:
		default:
		}
		return nil
	}

	return RoomFullError
}
