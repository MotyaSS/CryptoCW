package crypto

import (
	"encoding/binary"
	"errors"
)

// Constants for TwoFish
const (
	// TwoFish uses 128-bit (16-byte) blocks
	BlockSize = 16
	// Number of rounds in TwoFish
	Rounds = 16
)

// Pre-computed RS matrix for MDS (from TwoFish specification)
var RS = [4][8]byte{
	{0x01, 0xA4, 0x55, 0x87, 0x5A, 0x58, 0xDB, 0x9E},
	{0xA4, 0x56, 0x82, 0xF3, 0x1E, 0xC6, 0x68, 0xE5},
	{0x02, 0xA1, 0xFC, 0xC1, 0x47, 0xAE, 0x3D, 0x19},
	{0xA4, 0x55, 0x87, 0x5A, 0x58, 0xDB, 0x9E, 0x03},
}

// q0 and q1 permutations for S-box generation
var q0 = [256]byte{
	0xA9, 0x67, 0xB3, 0xE8, 0x04, 0xFD, 0xA3, 0x76,
	0x9A, 0x92, 0x80, 0x78, 0xE4, 0xDD, 0xD1, 0x38,
	0x0D, 0xC6, 0x35, 0x98, 0x18, 0xF7, 0xEC, 0x6C,
	0x43, 0x75, 0x37, 0x26, 0xFA, 0x13, 0x94, 0x48,
	0xF2, 0xD0, 0x8B, 0x30, 0x84, 0x54, 0xDF, 0x23,
	0x19, 0x5B, 0x3D, 0x59, 0xF3, 0xAE, 0xA2, 0x82,
	0x63, 0x01, 0x83, 0x2E, 0xD9, 0x51, 0x9B, 0x7C,
	0xA6, 0xEB, 0xA5, 0xBE, 0x16, 0x0C, 0xE3, 0x61,
	0xC0, 0x8C, 0x3A, 0xF5, 0x73, 0x2C, 0x25, 0x0B,
	0xBB, 0x4E, 0x89, 0x6B, 0x53, 0x6A, 0xB4, 0xF1,
	0xE1, 0xE6, 0xBD, 0x45, 0xE2, 0xF4, 0xB6, 0x66,
	0xCC, 0x95, 0x03, 0x56, 0xD4, 0x1C, 0x1E, 0xD7,
	0xFB, 0xC3, 0x8E, 0xB5, 0xE9, 0xCF, 0xBF, 0xBA,
	0xEA, 0x77, 0x39, 0xAF, 0x33, 0xC9, 0x62, 0x71,
	0x81, 0x79, 0x09, 0xAD, 0x24, 0xCD, 0xF9, 0xD8,
	0xE5, 0xC5, 0xB9, 0x4D, 0x44, 0x08, 0x86, 0xE7,
	0xA1, 0x1D, 0xAA, 0xED, 0x06, 0x70, 0xB2, 0xD2,
	0x41, 0x7B, 0xA0, 0x11, 0x31, 0xC2, 0x27, 0x90,
	0x20, 0xF6, 0x60, 0xFF, 0x96, 0x5C, 0xB1, 0xAB,
	0x9E, 0x9C, 0x52, 0x1B, 0x5F, 0x93, 0x0A, 0xEF,
	0x91, 0x85, 0x49, 0xEE, 0x2D, 0x4F, 0x8F, 0x3B,
	0x47, 0x87, 0x6D, 0x46, 0xD6, 0x3E, 0x69, 0x64,
	0x2A, 0xCE, 0xCB, 0x2F, 0xFC, 0x97, 0x05, 0x7A,
	0xAC, 0x7F, 0xD5, 0x1A, 0x4B, 0x0E, 0xA7, 0x5A,
	0x28, 0x14, 0x3F, 0x29, 0x88, 0x3C, 0x4C, 0x02,
	0xB8, 0xDA, 0xB0, 0x17, 0x55, 0x1F, 0x8A, 0x7D,
	0x57, 0xC7, 0x8D, 0x74, 0xB7, 0xC4, 0x9F, 0x72,
	0x7E, 0x15, 0x22, 0x12, 0x58, 0x07, 0x99, 0x34,
	0x6E, 0x50, 0xDE, 0x68, 0x65, 0xBC, 0xDB, 0xF8,
	0xC8, 0xA8, 0x2B, 0x40, 0xDC, 0xFE, 0x32, 0xA4,
	0xCA, 0x10, 0x21, 0xF0, 0xD3, 0x5D, 0x0F, 0x00,
	0x6F, 0x9D, 0x36, 0x42, 0x4A, 0x5E, 0xC1, 0xE0,
}

var q1 = [256]byte{
	0x75, 0xF3, 0xC6, 0xF4, 0xDB, 0x7B, 0xFB, 0xC8,
	0x4A, 0xD3, 0xE6, 0x6B, 0x45, 0x7D, 0xE8, 0x4B,
	0xD6, 0x32, 0xD8, 0xFD, 0x37, 0x71, 0xF1, 0xE1,
	0x30, 0x0F, 0xF8, 0x1B, 0x87, 0xFA, 0x06, 0x3F,
	0x5E, 0xBA, 0xAE, 0x5B, 0x8A, 0x00, 0xBC, 0x9D,
	0x6D, 0xC1, 0xB1, 0x0E, 0x80, 0x5D, 0xD2, 0xD5,
	0xA0, 0x84, 0x07, 0x14, 0xB5, 0x90, 0x2C, 0xA3,
	0xB2, 0x73, 0x4C, 0x54, 0x92, 0x74, 0x36, 0x51,
	0x38, 0xB0, 0xBD, 0x5A, 0xFC, 0x60, 0x62, 0x96,
	0x6C, 0x42, 0xF7, 0x10, 0x7C, 0x28, 0x27, 0x8C,
	0x13, 0x95, 0x9C, 0xC7, 0x24, 0x46, 0x3B, 0x70,
	0xCA, 0xE3, 0x85, 0xCB, 0x11, 0xD0, 0x93, 0xB8,
	0xA6, 0x83, 0x20, 0xFF, 0x9F, 0x77, 0xC3, 0xCC,
	0x03, 0x6F, 0x08, 0xBF, 0x40, 0xE7, 0x2B, 0xE2,
	0x79, 0x0C, 0xAA, 0x82, 0x41, 0x3A, 0xEA, 0xB9,
	0xE4, 0x9A, 0xA4, 0x97, 0x7E, 0xDA, 0x7A, 0x17,
	0x66, 0x94, 0xA1, 0x1D, 0x3D, 0xF0, 0xDE, 0xB3,
	0x0B, 0x72, 0xA7, 0x1C, 0xEF, 0xD1, 0x53, 0x3E,
	0x8F, 0x33, 0x26, 0x5F, 0xEC, 0x76, 0x2A, 0x49,
	0x81, 0x88, 0xEE, 0x21, 0xC4, 0x1A, 0xEB, 0xD9,
	0xC5, 0x39, 0x99, 0xCD, 0xAD, 0x31, 0x8B, 0x01,
	0x18, 0x23, 0xDD, 0x1F, 0x4E, 0x2D, 0xF9, 0x48,
	0x4F, 0xF2, 0x65, 0x8E, 0x78, 0x5C, 0x58, 0x19,
	0x8D, 0xE5, 0x98, 0x57, 0x67, 0x7F, 0x05, 0x64,
	0xAF, 0x63, 0xB6, 0xFE, 0xF5, 0xB7, 0x3C, 0xA5,
	0xCE, 0xE9, 0x68, 0x44, 0xE0, 0x4D, 0x43, 0x69,
	0x29, 0x2E, 0xAC, 0x15, 0x59, 0xA8, 0x0A, 0x9E,
	0x6E, 0x47, 0xDF, 0x34, 0x35, 0x6A, 0xCF, 0xDC,
	0x22, 0xC9, 0xC0, 0x9B, 0x89, 0xD4, 0xED, 0xAB,
	0x12, 0xA2, 0x0D, 0x52, 0xBB, 0x02, 0x2F, 0xA9,
	0xD7, 0x61, 0x1E, 0xB4, 0x50, 0x04, 0xF6, 0xC2,
	0x16, 0x25, 0x86, 0x56, 0x55, 0x09, 0xBE, 0x91,
}

// S-boxes
var sBox [2][256]byte

// TwoFish represents a TwoFish cipher instance
type TwoFish struct {
	roundKeys [40]uint32 // Expanded key for rounds
	sKeys     [4]uint32  // S-box keys
}

// Initialize S-boxes using the proper q-permutations
func init() {
	for i := 0; i < 256; i++ {
		// Apply q0 and q1 permutations as per TwoFish specification
		sBox[0][i] = q0[i]
		sBox[1][i] = q1[i]
	}
}

// Helper functions for bit rotation
func twofishRotateLeft(x uint32, n int) uint32 {
	return (x << uint(n&31)) | (x >> uint((32-n)&31))
}

func twofishRotateRight(x uint32, n int) uint32 {
	return (x >> uint(n&31)) | (x << uint((32-n)&31))
}

// NewTwoFish creates a new TwoFish cipher instance
func NewTwoFish(key []byte) (*TwoFish, error) {
	if len(key) != 16 && len(key) != 24 && len(key) != 32 {
		return nil, errors.New("twofish: key must be 16, 24, or 32 bytes")
	}

	t := &TwoFish{}
	t.expandKey(key)
	return t, nil
}

// h function for key schedule
func (t *TwoFish) h(x uint32, L []uint32, k int) uint32 {
	b := [4]byte{
		byte(x), byte(x >> 8),
		byte(x >> 16), byte(x >> 24),
	}

	if k == 4 {
		b[0] = sBox[1][b[0]] ^ byte(L[3])
		b[1] = sBox[0][b[1]] ^ byte(L[3]>>8)
		b[2] = sBox[0][b[2]] ^ byte(L[3]>>16)
		b[3] = sBox[1][b[3]] ^ byte(L[3]>>24)
	}
	if k >= 3 {
		b[0] = sBox[1][b[0]] ^ byte(L[2])
		b[1] = sBox[0][b[1]] ^ byte(L[2]>>8)
		b[2] = sBox[0][b[2]] ^ byte(L[2]>>16)
		b[3] = sBox[1][b[3]] ^ byte(L[2]>>24)
	}
	if k >= 2 {
		b[0] = sBox[1][b[0]] ^ byte(L[1])
		b[1] = sBox[0][b[1]] ^ byte(L[1]>>8)
		b[2] = sBox[0][b[2]] ^ byte(L[1]>>16)
		b[3] = sBox[1][b[3]] ^ byte(L[1]>>24)
	}
	b[0] = sBox[1][b[0]] ^ byte(L[0])
	b[1] = sBox[0][b[1]] ^ byte(L[0]>>8)
	b[2] = sBox[0][b[2]] ^ byte(L[0]>>16)
	b[3] = sBox[1][b[3]] ^ byte(L[0]>>24)

	// MDS matrix multiplication
	result := uint32(0)
	result ^= uint32(RS[0][b[0]]) << 24
	result ^= uint32(RS[1][b[1]]) << 16
	result ^= uint32(RS[2][b[2]]) << 8
	result ^= uint32(RS[3][b[3]])

	return result
}

func (t *TwoFish) expandKey(key []byte) {
	k := len(key) / 4
	words := make([]uint32, k)

	// Convert key bytes to words
	for i := 0; i < k; i++ {
		words[i] = binary.BigEndian.Uint32(key[4*i:])
	}

	// Generate round subkeys
	for i := 0; i < 20; i++ {
		A := t.h(uint32(2*i), words, k)
		B := twofishRotateLeft(t.h(uint32(2*i+1), words, k), 8)
		t.roundKeys[2*i] = A + B
		t.roundKeys[2*i+1] = twofishRotateLeft(A+2*B, 9)
	}

	// Generate S-box keys
	for i := 0; i < k; i++ {
		t.sKeys[i] = t.h(words[k-1-i], words, k)
	}
}

// F function used in round function
func (t *TwoFish) f(R uint32, round int) uint32 {
	t0 := byte(R)
	t1 := byte(R >> 8)
	t2 := byte(R >> 16)
	t3 := byte(R >> 24)

	// Apply S-boxes
	t0 = sBox[0][t0]
	t1 = sBox[1][t1]
	t2 = sBox[0][t2]
	t3 = sBox[1][t3]

	// MDS matrix multiplication
	result := uint32(0)
	result ^= uint32(RS[0][t0]) << 24
	result ^= uint32(RS[1][t1]) << 16
	result ^= uint32(RS[2][t2]) << 8
	result ^= uint32(RS[3][t3])

	return result
}

// Encrypt encrypts a single block
func (t *TwoFish) Encrypt(block []byte) []byte {
	if len(block) != BlockSize {
		panic("twofish: input block must be 16 bytes")
	}

	// Split block into four 32-bit words
	P0 := binary.BigEndian.Uint32(block[0:4])
	P1 := binary.BigEndian.Uint32(block[4:8])
	P2 := binary.BigEndian.Uint32(block[8:12])
	P3 := binary.BigEndian.Uint32(block[12:16])

	// Initial whitening
	P0 ^= t.roundKeys[0]
	P1 ^= t.roundKeys[1]
	P2 ^= t.roundKeys[2]
	P3 ^= t.roundKeys[3]

	// Main encryption rounds
	for i := 0; i < Rounds; i++ {
		t0 := t.f(P0, i)
		t1 := t.f(twofishRotateLeft(P1, 8), i)

		P3 = twofishRotateRight(P3, 1)
		P3 ^= t0 + t1 + t.roundKeys[4+2*i]
		P2 = twofishRotateLeft(P2, 1)
		P2 ^= t0 + 2*t1 + t.roundKeys[5+2*i]

		// Swap for next round
		P0, P1, P2, P3 = P2, P3, P0, P1
	}

	// Undo last swap
	P0, P1, P2, P3 = P2, P3, P0, P1

	// Output whitening
	P0 ^= t.roundKeys[36]
	P1 ^= t.roundKeys[37]
	P2 ^= t.roundKeys[38]
	P3 ^= t.roundKeys[39]

	// Convert back to bytes
	result := make([]byte, BlockSize)
	binary.BigEndian.PutUint32(result[0:4], P0)
	binary.BigEndian.PutUint32(result[4:8], P1)
	binary.BigEndian.PutUint32(result[8:12], P2)
	binary.BigEndian.PutUint32(result[12:16], P3)

	return result
}

// Decrypt decrypts a single block
func (t *TwoFish) Decrypt(block []byte) []byte {
	if len(block) != BlockSize {
		panic("twofish: input block must be 16 bytes")
	}

	// Split block into four 32-bit words
	C0 := binary.BigEndian.Uint32(block[0:4])
	C1 := binary.BigEndian.Uint32(block[4:8])
	C2 := binary.BigEndian.Uint32(block[8:12])
	C3 := binary.BigEndian.Uint32(block[12:16])

	// Undo output whitening
	C0 ^= t.roundKeys[36]
	C1 ^= t.roundKeys[37]
	C2 ^= t.roundKeys[38]
	C3 ^= t.roundKeys[39]

	// Main decryption rounds
	for i := Rounds - 1; i >= 0; i-- {
		t0 := t.f(C0, i)
		t1 := t.f(twofishRotateLeft(C1, 8), i)

		C3 = twofishRotateLeft(C3^(t0+t1+t.roundKeys[4+2*i]), 1)
		C2 = twofishRotateRight(C2^(t0+2*t1+t.roundKeys[5+2*i]), 1)

		// Swap for next round
		C0, C1, C2, C3 = C2, C3, C0, C1
	}

	// Undo last swap
	C0, C1, C2, C3 = C2, C3, C0, C1

	// Undo initial whitening
	C0 ^= t.roundKeys[0]
	C1 ^= t.roundKeys[1]
	C2 ^= t.roundKeys[2]
	C3 ^= t.roundKeys[3]

	// Convert back to bytes
	result := make([]byte, BlockSize)
	binary.BigEndian.PutUint32(result[0:4], C0)
	binary.BigEndian.PutUint32(result[4:8], C1)
	binary.BigEndian.PutUint32(result[8:12], C2)
	binary.BigEndian.PutUint32(result[12:16], C3)

	return result
}

// EncryptCBC encrypts data using CBC mode
func (t *TwoFish) EncryptCBC(data []byte, iv []byte) []byte {
	if len(iv) != BlockSize {
		panic("twofish: IV must be 16 bytes")
	}

	// Pad data to block size if necessary
	padLen := BlockSize - (len(data) % BlockSize)
	paddedData := make([]byte, len(data)+padLen)
	copy(paddedData, data)
	// PKCS7 padding
	for i := len(data); i < len(paddedData); i++ {
		paddedData[i] = byte(padLen)
	}

	// Initialize previous block with IV
	prev := make([]byte, BlockSize)
	copy(prev, iv)

	// Process each block
	ciphertext := make([]byte, len(paddedData))
	for i := 0; i < len(paddedData); i += BlockSize {
		// XOR with previous ciphertext block (or IV for first block)
		block := make([]byte, BlockSize)
		for j := 0; j < BlockSize; j++ {
			block[j] = paddedData[i+j] ^ prev[j]
		}

		// Encrypt block
		encrypted := t.Encrypt(block)

		// Copy to output and save for next iteration
		copy(ciphertext[i:], encrypted)
		copy(prev, encrypted)
	}

	return ciphertext
}

// DecryptCBC decrypts data using CBC mode
func (t *TwoFish) DecryptCBC(ciphertext []byte, iv []byte) []byte {
	if len(iv) != BlockSize {
		panic("twofish: IV must be 16 bytes")
	}
	if len(ciphertext)%BlockSize != 0 {
		panic("twofish: ciphertext is not a multiple of block size")
	}

	// Initialize previous block with IV
	prev := make([]byte, BlockSize)
	copy(prev, iv)

	// Process each block
	plaintext := make([]byte, len(ciphertext))
	for i := 0; i < len(ciphertext); i += BlockSize {
		// Save current ciphertext block for next iteration
		current := make([]byte, BlockSize)
		copy(current, ciphertext[i:i+BlockSize])

		// Decrypt block
		decrypted := t.Decrypt(current)

		// XOR with previous ciphertext block (or IV for first block)
		for j := 0; j < BlockSize; j++ {
			plaintext[i+j] = decrypted[j] ^ prev[j]
		}

		// Update previous block
		copy(prev, current)
	}

	// Remove PKCS7 padding
	padLen := int(plaintext[len(plaintext)-1])
	if padLen > BlockSize || padLen < 1 {
		panic("twofish: invalid padding")
	}
	return plaintext[:len(plaintext)-padLen]
}

// EncryptWithMode encrypts data using the specified mode and padding
func (c *TwoFish) EncryptWithMode(data []byte, iv []byte, mode string, padding PaddingType) []byte {
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
func (c *TwoFish) DecryptWithMode(ciphertext []byte, iv []byte, mode string, padding PaddingType) []byte {
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
