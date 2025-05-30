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
