// Package crypto implements RC5 encryption/decryption for WASM targets
package crypto

import "errors"

const (
	P32 = 0xB7E15163
	Q32 = 0x9E3779B9
)

// RC5 represents an RC5 cipher instance
type RC5 struct {
	rounds int
	S      []uint32
}

// New creates a new RC5 cipher instance
func New(rounds int, key []byte) (*RC5, error) {
	if rounds < 8 || rounds > 32 {
		return nil, errors.New("rc5: number of rounds must be between 8 and 32")
	}

	c := &RC5{
		rounds: rounds,
		S:      make([]uint32, 2*(rounds+1)),
	}

	c.expandKey(key)
	return c, nil
}

// expandKey initializes the key schedule
func (c *RC5) expandKey(key []byte) {
	// Convert key to uint32 words
	L := bytesToWords(key)

	// Initialize magic constants
	c.S[0] = P32
	for i := 1; i < len(c.S); i++ {
		c.S[i] = c.S[i-1] + Q32
	}

	// Mix in the secret key
	i, j, A, B := 0, 0, uint32(0), uint32(0)
	m := 3 * maxInt(len(c.S), len(L))

	for k := 0; k < m; k++ {
		A = rotateLeft(c.S[i]+A+B, 3)
		c.S[i] = A
		B = rotateLeft(L[j]+A+B, A+B)
		L[j] = B

		i = (i + 1) % len(c.S)
		j = (j + 1) % len(L)
	}
}

// Encrypt encrypts a 64-bit block
func (c *RC5) Encrypt(block []byte) []byte {
	if len(block) != 8 {
		panic("rc5: block size must be 8 bytes")
	}

	A := bytesToUint32(block[0:4])
	B := bytesToUint32(block[4:8])

	A += c.S[0]
	B += c.S[1]

	for i := 1; i <= c.rounds; i++ {
		A = rotateLeft(A^B, B) + c.S[2*i]
		B = rotateLeft(B^A, A) + c.S[2*i+1]
	}

	out := make([]byte, 8)
	uint32ToBytes(A, out[0:4])
	uint32ToBytes(B, out[4:8])

	return out
}

// Decrypt decrypts a 64-bit block
func (c *RC5) Decrypt(block []byte) []byte {
	if len(block) != 8 {
		panic("rc5: block size must be 8 bytes")
	}

	A := bytesToUint32(block[0:4])
	B := bytesToUint32(block[4:8])

	for i := c.rounds; i >= 1; i-- {
		B = rotateRight(B-c.S[2*i+1], A) ^ A
		A = rotateRight(A-c.S[2*i], B) ^ B
	}

	B -= c.S[1]
	A -= c.S[0]

	out := make([]byte, 8)
	uint32ToBytes(A, out[0:4])
	uint32ToBytes(B, out[4:8])

	return out
}

// EncryptCBC encrypts data using CBC mode
func (c *RC5) EncryptCBC(data []byte, iv []byte) []byte {
	if len(iv) != 8 {
		panic("rc5: IV must be 8 bytes")
	}

	// Pad data to block size if necessary
	padLen := 8 - (len(data) % 8)
	paddedData := make([]byte, len(data)+padLen)
	copy(paddedData, data)
	// PKCS7 padding
	for i := len(data); i < len(paddedData); i++ {
		paddedData[i] = byte(padLen)
	}

	// Initialize previous block with IV
	prev := make([]byte, 8)
	copy(prev, iv)

	// Process each block
	ciphertext := make([]byte, len(paddedData))
	for i := 0; i < len(paddedData); i += 8 {
		// XOR with previous ciphertext block (or IV for first block)
		block := make([]byte, 8)
		for j := 0; j < 8; j++ {
			block[j] = paddedData[i+j] ^ prev[j]
		}

		// Encrypt block
		encrypted := c.Encrypt(block)

		// Copy to output and save for next iteration
		copy(ciphertext[i:], encrypted)
		copy(prev, encrypted)
	}

	return ciphertext
}

// DecryptCBC decrypts data using CBC mode
func (c *RC5) DecryptCBC(ciphertext []byte, iv []byte) []byte {
	if len(iv) != 8 {
		panic("rc5: IV must be 8 bytes")
	}
	if len(ciphertext)%8 != 0 {
		panic("rc5: ciphertext is not a multiple of block size")
	}

	// Initialize previous block with IV
	prev := make([]byte, 8)
	copy(prev, iv)

	// Process each block
	plaintext := make([]byte, len(ciphertext))
	for i := 0; i < len(ciphertext); i += 8 {
		// Save current ciphertext block for next iteration
		current := make([]byte, 8)
		copy(current, ciphertext[i:i+8])

		// Decrypt block
		decrypted := c.Decrypt(current)

		// XOR with previous ciphertext block (or IV for first block)
		for j := 0; j < 8; j++ {
			plaintext[i+j] = decrypted[j] ^ prev[j]
		}

		// Update previous block
		copy(prev, current)
	}

	// Remove PKCS7 padding
	padLen := int(plaintext[len(plaintext)-1])
	if padLen > 8 || padLen < 1 {
		panic("rc5: invalid padding")
	}
	return plaintext[:len(plaintext)-padLen]
}

// EncryptWithMode encrypts data using the specified mode and padding
func (c *RC5) EncryptWithMode(data []byte, iv []byte, mode string, padding PaddingType) []byte {
	// Get the mode implementation
	modeImpl, err := GetMode(c, mode)
	if err != nil {
		return nil
	}

	// Add padding
	blockSize := len(iv)
	paddedData := Pad(data, blockSize, padding)

	// Encrypt using the selected mode
	return modeImpl.Encrypt(paddedData, iv)
}

// DecryptWithMode decrypts data using the specified mode and padding
func (c *RC5) DecryptWithMode(ciphertext []byte, iv []byte, mode string, padding PaddingType) []byte {
	// Get the mode implementation
	modeImpl, err := GetMode(c, mode)
	if err != nil {
		return nil
	}

	// Decrypt using the selected mode
	decrypted := modeImpl.Decrypt(ciphertext, iv)

	// Remove padding
	return Unpad(decrypted, padding)
}

// Helper functions

func rotateLeft(x, y uint32) uint32 {
	return (x << (y & 31)) | (x >> (32 - (y & 31)))
}

func rotateRight(x, y uint32) uint32 {
	return (x >> (y & 31)) | (x << (32 - (y & 31)))
}

func bytesToUint32(b []byte) uint32 {
	return uint32(b[0]) | uint32(b[1])<<8 | uint32(b[2])<<16 | uint32(b[3])<<24
}

func uint32ToBytes(v uint32, b []byte) {
	b[0] = byte(v)
	b[1] = byte(v >> 8)
	b[2] = byte(v >> 16)
	b[3] = byte(v >> 24)
}

func bytesToWords(key []byte) []uint32 {
	pad := (8 - (len(key) % 8)) % 8
	padded := append(key, make([]byte, pad)...)

	words := make([]uint32, len(padded)/4)
	for i := range words {
		words[i] = bytesToUint32(padded[i*4 : (i+1)*4])
	}
	return words
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
