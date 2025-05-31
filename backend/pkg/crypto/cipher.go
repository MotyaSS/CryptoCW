package crypto

import "errors"

var ErrUnsupportedAlgorithm = errors.New("unsupported encryption algorithm")

// Cipher represents a common interface for encryption algorithms
type Cipher interface {
	// Encrypt encrypts a block of data
	Encrypt(block []byte) []byte

	// Decrypt decrypts a block of data
	Decrypt(block []byte) []byte

	// EncryptCBC encrypts data using CBC mode
	EncryptCBC(data []byte, iv []byte) []byte

	// DecryptCBC decrypts data using CBC mode
	DecryptCBC(ciphertext []byte, iv []byte) []byte
}

// NewCipher creates a new cipher instance based on the algorithm and key
func NewCipher(algorithm string, key []byte) (Cipher, error) {
	switch algorithm {
	case "RC5":
		return New(12, key)
	case "TwoFish":
		return NewTwoFish(key)
	default:
		return nil, ErrUnsupportedAlgorithm
	}
}
