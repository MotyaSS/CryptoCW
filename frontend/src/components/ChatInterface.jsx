import { useState, useEffect, useRef } from 'react';
import { encryptMessage, decryptMessage, generateIV } from '../encryption';

function ChatInterface({ roomName, username, password, algorithm, mode, padding, onLeaveRoom, setAlgorithm, setMode, setPadding }) {
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [socket, setSocket] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef(null);
    const socketInitialized = useRef(false);
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

    // File reception state
    const [fileReceptions, setFileReceptions] = useState(new Map());
    const fileReceptionsRef = useRef(new Map());
    const [downloadQueue, setDownloadQueue] = useState([]);

    // --- File Upload State ---
    const [uploadProgress, setUploadProgress] = useState(0); // 0-100
    const [uploadingFileName, setUploadingFileName] = useState(null);

    // --- File Download State ---
    const [downloadProgress, setDownloadProgress] = useState({}); // { filename: percent }
    const [readyToSave, setReadyToSave] = useState({}); // { filename: Uint8Array }

    // Function to add message to chat
    const addMessage = (message) => {
        setMessages(prev => [...prev, message]);
    };

    // Function to handle completed file download
    const handleFileDownload = async (fileData, filename) => {
        try {
            // Create blob from the decrypted data
            const blob = new Blob([fileData], { type: 'application/octet-stream' });
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            addMessage({
                from: 'System',
                message_type: 'text',
                content: `File ${filename} downloaded successfully`,
                sent_at: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to download file:', error);
            addMessage({
                from: 'System',
                message_type: 'text',
                content: `Failed to download file ${filename}: ${error.message}`,
                sent_at: new Date().toISOString()
            });
        }
    };

    // Process download queue
    useEffect(() => {
        if (downloadQueue.length > 0) {
            const [fileData, filename] = downloadQueue[0];
            handleFileDownload(fileData, filename);
            setDownloadQueue(prev => prev.slice(1));
        }
    }, [downloadQueue]);

    useEffect(() => {
        if (socketInitialized.current || !roomName || !username || !password) {
            return;
        }

        const wsUrl = `ws://${window.location.host}/ws/${roomName}?room_name=${roomName}&room_password=${encodeURIComponent(password)}&username=${encodeURIComponent(username)}`;
        const newSocket = new WebSocket(wsUrl);

        newSocket.onopen = () => {
            addMessage({
                from: 'System',
                message_type: 'client_connected',
                content: `Connected to room: ${roomName}`,
                sent_at: new Date().toISOString()
            });
        };

        newSocket.onmessage = async (event) => {
            try {
                console.log('Raw WebSocket message:', event.data);
                const data = JSON.parse(event.data);
                console.log('Parsed message data:', data);

                switch (data.message_type) {
                    case 'room_settings':
                        // Update encryption settings from server
                        const settings = data.content;
                        if (settings.algorithm) setAlgorithm(settings.algorithm);
                        if (settings.mode) setMode(settings.mode);
                        if (settings.padding) setPadding(settings.padding);
                        
                        addMessage({
                            from: 'System',
                            message_type: 'text',
                            content: `Room encryption: ${settings.algorithm} (${settings.mode} mode, ${settings.padding} padding)`,
                            sent_at: data.sent_at
                        });
                        break;

                    case 'text':
                        try {
                            const decrypted = await decryptMessage(
                                algorithm,
                                password,
                                data.content,
                                data.iv,
                                mode,
                                padding
                            );
                            console.log('Decrypted message:', decrypted);
                            addMessage({
                                ...data,
                                content: decrypted
                            });
                        } catch (error) {
                            console.error('Failed to decrypt message:', error);
                            addMessage({
                                ...data,
                                content: '[Encrypted message - decryption failed]'
                            });
                        }
                        break;
                    case 'file_start': {
                        const msgId = `${data.sent_at}_${data.filename}`;
                        fileReceptionsRef.current.set(data.filename, {
                            sender: data.from,
                            size: parseInt(data.content),
                            chunks: [],
                            receivedSize: 0,
                            startTime: Date.now(),
                            msgId
                        });
                        setFileReceptions(new Map(fileReceptionsRef.current));
                        setDownloadProgress(prev => ({ ...prev, [data.filename]: 0 }));
                        // Add a file_transfer message to chat
                        setMessages(prev => [
                            ...prev,
                            {
                                id: msgId,
                                from: data.from,
                                sent_at: data.sent_at,
                                message_type: 'file_transfer',
                                filename: data.filename,
                                progress: 0,
                                ready: false
                            }
                        ]);
                        break;
                    }
                    case 'file_chunk': {
                        try {
                            if (!data.iv) {
                                throw new Error('Missing IV for file chunk');
                            }
                            const decryptedBase64 = await decryptMessage(
                                algorithm,
                                password,
                                data.content,
                                data.iv,
                                mode,
                                padding
                            );
                            const binaryStr = atob(decryptedBase64);
                            const chunkBytes = new Uint8Array(binaryStr.length);
                            for (let i = 0; i < binaryStr.length; i++) {
                                chunkBytes[i] = binaryStr.charCodeAt(i);
                            }
                            // Always use the ref for up-to-date state
                            const fileReception = fileReceptionsRef.current.get(data.filename);
                            if (fileReception) {
                                fileReception.chunks.push(chunkBytes);
                                fileReception.receivedSize += chunkBytes.length;
                                // Update progress for UI
                                const percent = Math.round((fileReception.receivedSize / fileReception.size) * 100);
                                setDownloadProgress(p => ({ ...p, [data.filename]: percent }));
                                // Trigger UI update
                                setFileReceptions(new Map(fileReceptionsRef.current));
                                // Update message progress
                                setMessages(prev => updateMessageById(prev, fileReception.msgId, { progress: percent }));
                            }
                        } catch (error) {
                            console.error('Failed to decrypt file chunk:', error);
                            addMessage({
                                from: 'System',
                                message_type: 'text',
                                content: `Error receiving file chunk: ${error.message}`,
                                sent_at: new Date().toISOString()
                            });
                        }
                        break;
                    }
                    case 'file_end': {
                        try {
                            // Always use the ref for up-to-date state
                            const fileReception = fileReceptionsRef.current.get(data.filename);
                            if (fileReception) {
                                if (fileReception.receivedSize !== fileReception.size) {
                                    throw new Error(`Size mismatch: received ${fileReception.receivedSize} bytes, expected ${fileReception.size} bytes`);
                                }
                                const totalLength = fileReception.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                                const fileData = new Uint8Array(totalLength);
                                let offset = 0;
                                for (const chunk of fileReception.chunks) {
                                    fileData.set(chunk, offset);
                                    offset += chunk.length;
                                }
                                setReadyToSave(prev => ({ ...prev, [data.filename]: fileData }));
                                setDownloadProgress(prev => ({ ...prev, [data.filename]: 100 }));
                                // Remove from ref and state
                                fileReceptionsRef.current.delete(data.filename);
                                setFileReceptions(new Map(fileReceptionsRef.current));
                                // Update message progress
                                setMessages(prev => updateMessageById(prev, fileReception.msgId, { progress: 100, ready: true }));
                                console.log(`${data.from} finished uploading ${data.filename}. File ready to save.`);
                            }
                        } catch (error) {
                            console.error('Failed to process file end:', error);
                            addMessage({
                                from: 'System',
                                message_type: 'text',
                                content: `Error completing file transfer: ${error.message}`,
                                sent_at: new Date().toISOString()
                            });
                            // Remove from ref and state
                            fileReceptionsRef.current.delete(data.filename);
                            setFileReceptions(new Map(fileReceptionsRef.current));
                        }
                        break;
                    }
                    default:
                        addMessage(data);
                }
            } catch (e) {
                console.error('Error processing message:', e);
                addMessage({
                    from: 'System',
                    message_type: 'text',
                    content: `Error processing message: ${e.message}`,
                    sent_at: new Date().toISOString()
                });
            }
        };

        newSocket.onclose = () => {
            addMessage({
                from: 'System',
                message_type: 'client_disconnected',
                content: 'Disconnected from room',
                sent_at: new Date().toISOString()
            });
            socketInitialized.current = false;
            onLeaveRoom();
        };

        newSocket.onerror = (error) => {
            addMessage({
                from: 'System',
                message_type: 'text',
                content: `Error: ${error.message}`,
                sent_at: new Date().toISOString()
            });
        };

        setSocket(newSocket);
        socketInitialized.current = true;

        return () => {
            if (newSocket && newSocket.readyState === WebSocket.OPEN) {
                newSocket.close();
            }
        };
    }, [roomName, username, password, algorithm, mode, padding, setAlgorithm, setMode, setPadding]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (messageInput.trim() && socket && socket.readyState === WebSocket.OPEN) {
            try {
                // Generate random IV
                const iv = generateIV(algorithm);

                // Encrypt the message
                const encrypted = await encryptMessage(
                    algorithm,
                    password,
                    messageInput,
                    iv,
                    mode,
                    padding
                );

                // Convert IV to base64 for transmission
                const ivBase64 = btoa(String.fromCharCode.apply(null, iv));

                // Create message with encrypted content
                const messageData = {
                    from: username,
                    sent_at: new Date().toISOString(),
                    message_type: "text",
                    content: encrypted,
                    iv: ivBase64
                };

                // Add to local state (using unencrypted content for display)
                addMessage({
                    from: username,
                    sent_at: messageData.sent_at,
                    message_type: "text",
                    content: messageInput
                });

                // Log the outgoing message
                console.log('[WebSocket] Sending message:', messageData);

                // Send encrypted message
                socket.send(JSON.stringify(messageData));
                setMessageInput('');
            } catch (error) {
                console.error('Failed to send message:', error);
                addMessage({
                    from: 'System',
                    message_type: 'text',
                    content: `Error sending message: ${error.message}`,
                    sent_at: new Date().toISOString()
                });
            }
        }
    };

    const handleLeaveRoom = async () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            try {
                // Send disconnect message
                const disconnectMessage = {
                    from: username,
                    message_type: "client_disconnected",
                    content: username,
                    sent_at: new Date().toISOString()
                };
                console.log("Sending disconnect message:", disconnectMessage);
                socket.send(JSON.stringify(disconnectMessage));
                // Give a short delay to allow the message to be sent
                setTimeout(() => {
                    console.log("Closing socket connection...");
                    socket.close(1000, "User left the room");
                    socketInitialized.current = false;
                }, 100);
            } catch (error) {
                console.error("Error during room leave:", error);
                socket.close();
                socketInitialized.current = false;
            }
        } else {
            console.log("Socket already closed or not connected");
            socketInitialized.current = false;
            onLeaveRoom();
        }
    };

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Utility: Safe Uint8Array to base64 for large arrays
    function uint8ToBase64(uint8) {
        let binary = '';
        const chunkSize = 0x8000; // 32KB
        for (let i = 0; i < uint8.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    }

    // --- New File Upload Handler ---
    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file || !socket || socket.readyState !== WebSocket.OPEN) return;
        setUploadingFileName(file.name);
        setUploadProgress(0);
        setIsUploading(true);
        try {
            const uploadMsgId = `${Date.now()}_${file.name}`;
            setMessages(prev => [
                ...prev,
                {
                    id: uploadMsgId,
                    from: username,
                    sent_at: new Date().toISOString(),
                    message_type: 'file_transfer',
                    filename: file.name,
                    progress: 0,
                    ready: false,
                    isUpload: true,
                    fileData: null // will be set for preview if image
                }
            ]);
            const reader = new FileReader();
            reader.onload = async (e) => {
                const fileData = new Uint8Array(e.target.result);
                // If image, store for preview
                const isImage = isImageFile(file.name);
                if (isImage) {
                    setMessages(prev => prev.map(msg =>
                        msg.id === uploadMsgId ? { ...msg, fileData } : msg
                    ));
                }
                // Send file_start
                const startMessage = {
                    from: username,
                    sent_at: new Date().toISOString(),
                    message_type: "file_start",
                    filename: file.name,
                    content: file.size.toString()
                };
                console.log('[WebSocket] Sending file_start:', startMessage);
                socket.send(JSON.stringify(startMessage));
                console.log(`Uploading file: ${file.name}`);
                for (let i = 0; i < fileData.length; i += CHUNK_SIZE) {
                    const chunk = fileData.slice(i, i + CHUNK_SIZE);
                    // Use safe base64 encoding
                    const chunkBase64 = uint8ToBase64(chunk);
                    // Generate IV for this chunk
                    const iv = generateIV(algorithm);
                    const ivBase64 = btoa(String.fromCharCode.apply(null, iv));
                    // Encrypt chunk
                    const encryptedChunk = await encryptMessage(
                        algorithm,
                        password,
                        chunkBase64,
                        iv,
                        mode,
                        padding
                    );
                    const chunkMessage = {
                        from: username,
                        sent_at: new Date().toISOString(),
                        message_type: "file_chunk",
                        filename: file.name,
                        content: encryptedChunk,
                        iv: ivBase64
                    };
                    console.log('[WebSocket] Sending file_chunk:', {
                        ...chunkMessage,
                        content: '[ENCRYPTED]',
                        chunkIndex: Math.floor(i / CHUNK_SIZE),
                        chunkSize: chunk.length
                    });
                    socket.send(JSON.stringify(chunkMessage));
                    setUploadProgress(Math.round(((i + chunk.length) / fileData.length) * 100));
                    // Update message progress
                    setMessages(prev => prev.map(msg =>
                        msg.id === uploadMsgId ? { ...msg, progress: Math.round(((i + chunk.length) / fileData.length) * 100) } : msg
                    ));
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                // Send file_end
                const endMessage = {
                    from: username,
                    sent_at: new Date().toISOString(),
                    message_type: "file_end",
                    filename: file.name,
                    content: file.name
                };
                console.log('[WebSocket] Sending file_end:', endMessage);
                socket.send(JSON.stringify(endMessage));
                console.log(`File uploaded: ${file.name}`);
                setUploadProgress(100);
                setTimeout(() => {
                    setIsUploading(false);
                    setUploadingFileName(null);
                    setUploadProgress(0);
                }, 1000);
                setMessages(prev => prev.map(msg =>
                    msg.id === uploadMsgId ? { ...msg, progress: 100, ready: true } : msg
                ));
            };
            reader.readAsArrayBuffer(file);
        } catch (error) {
            console.error('Failed to upload file:', error);
            addMessage({
                from: 'System',
                message_type: 'text',
                content: `Error uploading file: ${error.message}`,
                sent_at: new Date().toISOString()
            });
            setIsUploading(false);
            setUploadingFileName(null);
            setUploadProgress(0);
        }
    };

    // --- Save As handler ---
    const handleSaveAs = (filename) => {
        const fileData = readyToSave[filename];
        if (!fileData) return;
        const blob = new Blob([fileData], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);
    };

    // Helper to check if a filename is an image
    function isImageFile(filename) {
        return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(filename);
    }

    // Helper to update a message by id
    function updateMessageById(messages, id, update) {
        return messages.map(msg => (msg.id === id ? { ...msg, ...update } : msg));
    }

    return (
        <div className="chat-interface">
            <div className="chat-header">
                <h2>Chat Room: {roomName}</h2>
                <div className="room-info">
                    <span>Algorithm: {algorithm}</span>
                    <span>Mode: {mode}</span>
                    <span>Padding: {padding}</span>
                    <button onClick={handleLeaveRoom} className="leave-button">
                        Leave Room
                    </button>
                </div>
            </div>

            <div className="chat-messages">
                {messages.map((msg, index) => {
                    const isOwn = msg.from === username;
                    const isSystem = msg.message_type === 'client_connected' || msg.message_type === 'client_disconnected' || msg.from === 'System';
                    if (isSystem) {
                        return (
                            <div
                                key={msg.id || index}
                                className="message-card system-message"
                                style={{
                                    background: '#f0f0f0',
                                    color: '#888',
                                    borderRadius: 2,
                                    margin: '8px auto',
                                    padding: '8px 16px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                    maxWidth: 340,
                                    alignSelf: 'center',
                                    textAlign: 'center',
                                    fontStyle: 'italic',
                                }}
                            >
                                <div className="message-content" style={{ marginBottom: 4 }}>
                                    {msg.content}
                                </div>
                                <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>
                                    {msg.sent_at ? new Date(msg.sent_at).toLocaleString() : ''}
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div
                            key={msg.id || index}
                            className={`message-card${isOwn ? ' own-message' : ''}`}
                            style={{
                                background: isOwn ? '#e6f7ff' : '#f5f5f5',
                                borderRadius: 8,
                                margin: '12px 0',
                                padding: 16,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                maxWidth: 420,
                                alignSelf: isOwn ? 'flex-end' : 'flex-start',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            {/* Sender name */}
                            <div style={{ fontWeight: 600, marginBottom: 8, color: '#1890ff' }}>{msg.from}</div>
                            {/* Message content */}
                            <div className="message-content" style={{ marginBottom: 8 }}>
                                {msg.message_type === 'text' ? (
                                    <span>{msg.content}</span>
                                ) : msg.message_type === 'file_transfer' ? (
                                    <div>
                                        <strong>File: {msg.filename}</strong>
                                        {isImageFile(msg.filename) && ((msg.isUpload && msg.fileData) || (!msg.isUpload && msg.ready && readyToSave[msg.filename])) ? (
                                            <div style={{ margin: '8px 0' }}>
                                                <img
                                                    src={msg.isUpload ? URL.createObjectURL(new Blob([msg.fileData], { type: 'image/*' })) : URL.createObjectURL(new Blob([readyToSave[msg.filename]], { type: 'image/*' }))}
                                                    alt={msg.filename}
                                                />
                                            </div>
                                        ) : null}
                                        <div className="progress-row">
                                            <progress value={msg.progress} max="100" style={{ flex: 1 }} />
                                            <span style={{ fontWeight: 500 }}>{msg.progress}%</span>
                                            {!msg.isUpload && msg.ready && readyToSave[msg.filename] && (
                                                <button style={{ marginLeft: 10 }} onClick={() => handleSaveAs(msg.filename)}>
                                                    Save As
                                                </button>
                                            )}
                                            {msg.isUpload && msg.ready && <span style={{ marginLeft: 10, color: '#4CAF50' }}>File uploaded</span>}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                            {/* Date and time */}
                            <div style={{ fontSize: 12, color: '#888', alignSelf: 'flex-end', marginTop: 4 }}>
                                {msg.sent_at ? new Date(msg.sent_at).toLocaleString() : ''}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="message-form">
                <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type your message..."
                    required
                />
                <button type="submit">Send</button>
                <input
                    type="file"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                    style={{ marginLeft: '10px' }}
                />
                {isUploading && (
                    <span style={{ marginLeft: '10px' }}>
                        Uploading {uploadingFileName}... {uploadProgress}%
                        <progress value={uploadProgress} max="100" style={{ marginLeft: '5px' }} />
                    </span>
                )}
            </form>
        </div>
    );
}

export default ChatInterface;