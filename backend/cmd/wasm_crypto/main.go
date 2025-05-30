package main

import (
	"CryptographyCW/pkg/crypto"
	"encoding/base64"
	"fmt"
	"syscall/js"
)

func createResult(data interface{}, err error) map[string]interface{} {
	if err != nil {
		return map[string]interface{}{
			"error": err.Error(),
		}
	}
	return map[string]interface{}{
		"data": data,
	}
}

// Convert JS array to byte slice
func jsArrayToBytes(arr js.Value) ([]byte, error) {
	if arr.Type() != js.TypeObject {
		return nil, fmt.Errorf("expected array, got %s", arr.Type().String())
	}

	length := arr.Length()
	bytes := make([]byte, length)
	for i := 0; i < length; i++ {
		bytes[i] = byte(arr.Index(i).Int())
	}
	return bytes, nil
}

// Convert byte slice to JS array
func bytesToJSArray(bytes []byte) js.Value {
	array := js.Global().Get("Uint8Array").New(len(bytes))
	js.CopyBytesToJS(array, bytes)
	return array
}

func encrypt(this js.Value, args []js.Value) interface{} {
	if len(args) < 4 {
		return createResult(nil, fmt.Errorf("invalid number of arguments"))
	}

	// Extract arguments
	algorithm := args[0].String()
	key := []byte(args[1].String())

	// Convert message to bytes
	messageBytes, err := jsArrayToBytes(args[2])
	if err != nil {
		return createResult(nil, fmt.Errorf("invalid message data: %v", err))
	}

	// Convert IV to bytes
	iv, err := jsArrayToBytes(args[3])
	if err != nil {
		return createResult(nil, fmt.Errorf("invalid IV data: %v", err))
	}

	// Create cipher
	cipher, err := crypto.NewCipher(algorithm, key)
	if err != nil {
		return createResult(nil, fmt.Errorf("cipher creation failed: %v", err))
	}

	// Encrypt data
	encrypted := cipher.EncryptCBC(messageBytes, iv)
	if encrypted == nil {
		return createResult(nil, fmt.Errorf("encryption failed"))
	}

	// Return base64 encoded string
	return createResult(base64.StdEncoding.EncodeToString(encrypted), nil)
}

func decrypt(this js.Value, args []js.Value) interface{} {
	if len(args) < 4 {
		return createResult(nil, fmt.Errorf("invalid number of arguments"))
	}

	// Extract arguments
	algorithm := args[0].String()
	key := []byte(args[1].String())

	fmt.Printf("Decrypting with algorithm: %s\n", algorithm)
	fmt.Printf("Encrypted data (base64): %s\n", args[2].String())
	fmt.Printf("IV (base64): %s\n", args[3].String())

	// Decode base64 content
	encryptedBytes, err := base64.StdEncoding.DecodeString(args[2].String())
	if err != nil {
		return createResult(nil, fmt.Errorf("invalid base64 content: %v", err))
	}

	// Decode base64 IV
	iv, err := base64.StdEncoding.DecodeString(args[3].String())
	if err != nil {
		return createResult(nil, fmt.Errorf("invalid base64 IV: %v", err))
	}

	fmt.Printf("Decoded encrypted data length: %d\n", len(encryptedBytes))
	fmt.Printf("Decoded IV length: %d\n", len(iv))

	// Create cipher
	cipher, err := crypto.NewCipher(algorithm, key)
	if err != nil {
		return createResult(nil, fmt.Errorf("cipher creation failed: %v", err))
	}

	// Decrypt data
	decrypted := cipher.DecryptCBC(encryptedBytes, iv)
	if decrypted == nil {
		return createResult(nil, fmt.Errorf("decryption failed"))
	}

	decryptedStr := string(decrypted)
	fmt.Printf("Decrypted result: %s\n", decryptedStr)

	return createResult(decryptedStr, nil)
}

func main() {
	fmt.Println("WASM Crypto module loaded")

	c := make(chan struct{})

	js.Global().Set("encryptMessage", js.FuncOf(encrypt))
	js.Global().Set("decryptMessage", js.FuncOf(decrypt))

	<-c
}
