package main

import (
	"CryptographyCW/pkg/crypto"
	"syscall/js"
)

func encrypt(this js.Value, inputs []js.Value) interface{} {
	key := inputs[0].String()
	data := inputs[1].String()

	cipher, err := crypto.New(12, []byte(key))
	if err != nil {
		return js.ValueOf(map[string]interface{}{
			"error": err.Error(),
		})
	}

	encrypted := cipher.Encrypt([]byte(data))
	return js.ValueOf(map[string]interface{}{
		"result": js.Global().Get("Uint8Array").New(len(encrypted)),
		"data":   encrypted,
	})
}

func decrypt(this js.Value, inputs []js.Value) interface{} {
	key := inputs[0].String()
	data := inputs[1].String()

	cipher, err := crypto.New(12, []byte(key))
	if err != nil {
		return js.ValueOf(map[string]interface{}{
			"error": err.Error(),
		})
	}

	decrypted := cipher.Decrypt([]byte(data))
	return js.ValueOf(map[string]interface{}{
		"result": string(decrypted),
	})
}

func main() {
	c := make(chan struct{})

	js.Global().Set("rc5Encrypt", js.FuncOf(encrypt))
	js.Global().Set("rc5Decrypt", js.FuncOf(decrypt))

	<-c
}
