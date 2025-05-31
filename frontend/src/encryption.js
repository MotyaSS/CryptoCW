import './wasm_exec.js';

// WebAssembly encryption module wrapper
let encryptionModule = null;
let go = null;

// Initialize the WASM module
async function initWasm() {
    if (encryptionModule && go) {
        return encryptionModule;
    }

    try {
        // Load the wasm_exec.js helper from Go
        go = new Go();
        
        // Fetch and instantiate the WebAssembly module
        const result = await WebAssembly.instantiateStreaming(
            fetch('/src/encryption.wasm'),
            go.importObject
        );

        encryptionModule = result.instance;
        
        // Run the WASM module
        go.run(encryptionModule);
        
        // Add cleanup on window unload
        window.addEventListener('unload', () => {
            if (window.cleanup) {
                window.cleanup();
            }
        });

        return encryptionModule;
    } catch (error) {
        console.error('Failed to initialize WASM module:', error);
        throw error;
    }
}

// Encrypt a message
async function encryptMessage(algorithm, key, message, iv) {
    await initWasm();
    
    try {
        // Convert message to UTF-8
        const encoder = new TextEncoder();
        const messageBytes = encoder.encode(message);
        
        // If IV is a base64 string, convert it to Uint8Array
        let ivArray;
        if (typeof iv === 'string') {
            const binaryString = atob(iv);
            ivArray = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                ivArray[i] = binaryString.charCodeAt(i);
            }
        } else {
            ivArray = iv;
        }
        
        // Call the WASM encryption function
        const result = window.encryptMessage(
            algorithm,
            key,
            messageBytes,
            ivArray
        );

        if (!result) {
            throw new Error('Encryption failed: no result returned');
        }

        if (result.error) {
            throw new Error(result.error);
        }

        // Return the base64 string directly
        return result.data;
    } catch (error) {
        console.error('Encryption failed:', error);
        throw error;
    }
}

// Decrypt a message
async function decryptMessage(algorithm, key, encryptedData, iv) {
    await initWasm();
    
    try {
        // Call the WASM decryption function with base64 strings
        const result = window.decryptMessage(
            algorithm,
            key,
            encryptedData,
            iv
        );

        if (!result) {
            throw new Error('Decryption failed: no result returned');
        }

        if (result.error) {
            throw new Error(result.error);
        }

        // Use result.data instead of result.result
        if (result.data === undefined) {
            throw new Error('Decryption failed: no data in result');
        }

        return result.data;
    } catch (error) {
        console.error('Decryption failed:', error);
        throw error;
    }
}

// Generate a random IV
function generateIV(algorithm) {
    // RC5 uses 8-byte IV, TwoFish uses 16-byte IV
    const ivLength = algorithm === 'RC5' ? 8 : 16;
    const iv = new Uint8Array(ivLength);
    crypto.getRandomValues(iv);
    return iv;
}

export { initWasm, encryptMessage, decryptMessage, generateIV }; 