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

func (s *Service) CreateRoom(name string, password string) error {

	s.mutex.Lock()
	defer s.mutex.Unlock()

	if _, ok := s.Rooms[name]; ok {
		return RoomExistsError
	}

	s.Rooms[name] = &entity.Room{
		Name:     name,
		Password: password,
	}

	return nil
}

func (s *Service) DeleteRoom(name string) error {

	s.mutex.Lock()
	defer s.mutex.Unlock()

	if _, ok := s.Rooms[name]; ok {
		delete(s.Rooms, name)
		return nil
	}

	return RoomNotFoundError
}

func (s *Service) Connect(roomName string, c *entity.Client) error {

	s.mutex.Lock()
	defer s.mutex.Unlock()

	if _, ok := s.Rooms[roomName]; !ok {
		return RoomNotFoundError
	}

	if s.Rooms[roomName].Client1 != nil {
		s.Rooms[roomName].Client1 = c

	} else if s.Rooms[roomName].Client2 != nil {
		s.Rooms[roomName].Client2 = c

	}

	return RoomFullError
}

func (s *Service) Disconnect(roomName string, c *entity.Client) error {

	s.mutex.Lock()
	defer s.mutex.Unlock()
	if _, ok := s.Rooms[roomName]; !ok {
		return RoomNotFoundError
	}

	// TODO: Handle disconnection logic
}
