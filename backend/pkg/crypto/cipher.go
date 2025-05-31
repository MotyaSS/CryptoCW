package crypto

import "errors"

var (
	ErrUnsupportedAlgorithm = errors.New("unsupported encryption algorithm")
	ErrUnsupportedMode      = errors.New("unsupported cipher mode")
	ErrUnsupportedPadding   = errors.New("unsupported padding type")
)

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

	// EncryptWithMode encrypts data using the specified mode and padding
	EncryptWithMode(data []byte, iv []byte, mode string, padding PaddingType) []byte

	// DecryptWithMode decrypts data using the specified mode and padding
	DecryptWithMode(ciphertext []byte, iv []byte, mode string, padding PaddingType) []byte
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

// GetMode returns a Mode instance for the specified mode name
func GetMode(c Cipher, mode string) (Mode, error) {
	switch mode {
	case "CBC":
		return NewCBCMode(c), nil
	case "PCBC":
		return NewPCBCMode(c), nil
	case "CFB":
		return NewCFBMode(c), nil
	case "OFB":
		return NewOFBMode(c), nil
	case "CTR":
		return NewCTRMode(c), nil
	default:
		return nil, ErrUnsupportedMode
	}
}
