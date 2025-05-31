import { useState, useEffect, useRef } from 'react';
import { encryptMessage, decryptMessage, generateIV } from '../encryption';

function ChatInterface({ roomName, username, password, algorithm, onLeaveRoom }) {
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [socket, setSocket] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef(null);
    const socketInitialized = useRef(false);
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

    // File reception state
    const [fileReceptions, setFileReceptions] = useState(new Map());
    const [downloadQueue, setDownloadQueue] = useState([]);

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
                    case 'text':
                        try {
                            const decrypted = await decryptMessage(
                                algorithm,
                                password,
                                data.content,
                                data.iv
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
                    
                    case 'file_start':
                        // Initialize file reception
                        setFileReceptions(prev => {
                            const newReceptions = new Map(prev);
                            newReceptions.set(data.filename, {
                                sender: data.from,
                                size: parseInt(data.content),
                                chunks: [],
                                receivedSize: 0,
                                startTime: Date.now()
                            });
                            return newReceptions;
                        });
                        addMessage({
                            ...data,
                            content: `${data.from} started uploading: ${data.filename} (${data.content} bytes)`
                        });
                        break;
                    
                    case 'file_chunk':
                        try {
                            if (!data.iv) {
                                throw new Error('Missing IV for file chunk');
                            }

                            // Decrypt chunk
                            const decryptedBase64 = await decryptMessage(
                                algorithm,
                                password,
                                data.content,
                                data.iv // This should be base64 encoded IV
                            );

                            // Convert base64 to binary
                            const binaryStr = atob(decryptedBase64);
                            const chunkBytes = new Uint8Array(binaryStr.length);
                            for (let i = 0; i < binaryStr.length; i++) {
                                chunkBytes[i] = binaryStr.charCodeAt(i);
                            }

                            // Update file reception state
                            setFileReceptions(prev => {
                                const newReceptions = new Map(prev);
                                const fileReception = newReceptions.get(data.filename);
                                if (fileReception) {
                                    fileReception.chunks.push(chunkBytes);
                                    fileReception.receivedSize += chunkBytes.length;
                                    
                                    // Calculate progress and speed
                                    const progress = Math.round((fileReception.receivedSize / fileReception.size) * 100);
                                    const elapsedSeconds = (Date.now() - fileReception.startTime) / 1000;
                                    const speedMBps = ((fileReception.receivedSize / (1024 * 1024)) / elapsedSeconds).toFixed(2);
                                    
                                    // Update progress message
                                    addMessage({
                                        from: 'System',
                                        message_type: 'text',
                                        content: `Receiving ${data.filename} from ${fileReception.sender}: ${progress}% (${speedMBps} MB/s)`,
                                        sent_at: new Date().toISOString()
                                    });
                                }
                                return newReceptions;
                            });
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
                    
                    case 'file_end':
                        try {
                            // Get file reception data
                            const fileReception = fileReceptions.get(data.filename);
                            if (fileReception) {
                                // Verify received size matches expected size
                                if (fileReception.receivedSize !== fileReception.size) {
                                    throw new Error(`Size mismatch: received ${fileReception.receivedSize} bytes, expected ${fileReception.size} bytes`);
                                }

                                // Combine all chunks
                                const totalLength = fileReception.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                                const fileData = new Uint8Array(totalLength);
                                let offset = 0;
                                for (const chunk of fileReception.chunks) {
                                    fileData.set(chunk, offset);
                                    offset += chunk.length;
                                }

                                // Queue file for download
                                setDownloadQueue(prev => [...prev, [fileData, data.filename]]);

                                // Calculate total transfer stats
                                const totalSeconds = (Date.now() - fileReception.startTime) / 1000;
                                const avgSpeedMBps = ((fileReception.size / (1024 * 1024)) / totalSeconds).toFixed(2);

                                // Cleanup reception state
                                setFileReceptions(prev => {
                                    const newReceptions = new Map(prev);
                                    newReceptions.delete(data.filename);
                                    return newReceptions;
                                });

                                addMessage({
                                    from: 'System',
                                    message_type: 'text',
                                    content: `${data.from} finished uploading ${data.filename}. Average speed: ${avgSpeedMBps} MB/s. Starting download...`,
                                    sent_at: new Date().toISOString()
                                });
                            }
                        } catch (error) {
                            console.error('Failed to process file end:', error);
                            addMessage({
                                from: 'System',
                                message_type: 'text',
                                content: `Error completing file transfer: ${error.message}`,
                                sent_at: new Date().toISOString()
                            });
                            
                            // Cleanup failed transfer
                            setFileReceptions(prev => {
                                const newReceptions = new Map(prev);
                                newReceptions.delete(data.filename);
                                return newReceptions;
                            });
                        }
                        break;
                    
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
    }, [roomName, username, password, algorithm]);

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
                    iv
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
                
                // Create a promise to wait for the message to be sent
                await new Promise((resolve, reject) => {
                    socket.send(JSON.stringify(disconnectMessage), (error) => {
                        if (error) {
                            console.error("Error sending disconnect message:", error);
                            reject(error);
                        } else {
                            console.log("Disconnect message sent successfully");
                            resolve();
                        }
                    });
                });

                // Add a small delay to ensure message processing
                await new Promise(resolve => setTimeout(resolve, 500));
                
                console.log("Closing socket connection...");
                socket.close(1000, "User left the room");
                socketInitialized.current = false;
                onLeaveRoom();
            } catch (error) {
                console.error("Error during room leave:", error);
                socket.close();
                socketInitialized.current = false;
                onLeaveRoom();
            }
        } else {
            console.log("Socket already closed or not connected");
            socketInitialized.current = false;
            onLeaveRoom();
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file || !socket || socket.readyState !== WebSocket.OPEN) return;

        try {
            setIsUploading(true);
            const reader = new FileReader();
            
            // Send file start message
            const startMessage = {
                from: username,
                sent_at: new Date().toISOString(),
                message_type: "file_start",
                filename: file.name,
                content: file.size.toString()
            };
            socket.send(JSON.stringify(startMessage));

            // Add local message showing file upload started
            addMessage({
                from: username,
                sent_at: new Date().toISOString(),
                message_type: "text",
                content: `Uploading file: ${file.name}`
            });

            reader.onload = async (e) => {
                const fileData = new Uint8Array(e.target.result);
                for (let i = 0; i < fileData.length; i += CHUNK_SIZE) {
                    const chunk = fileData.slice(i, i + CHUNK_SIZE);
                    
                    // Convert chunk to base64 string
                    const chunkBase64 = btoa(String.fromCharCode.apply(null, chunk));
                    
                    // Generate IV for this chunk
                    const iv = generateIV(algorithm);
                    const ivBase64 = btoa(String.fromCharCode.apply(null, iv));
                    
                    // Encrypt chunk
                    const encryptedChunk = await encryptMessage(
                        algorithm,
                        password,
                        chunkBase64, // Send base64 string
                        iv
                    );

                    const chunkMessage = {
                        from: username,
                        sent_at: new Date().toISOString(),
                        message_type: "file_chunk",
                        filename: file.name,
                        content: encryptedChunk,
                        iv: ivBase64
                    };
                    
                    socket.send(JSON.stringify(chunkMessage));
                    
                    // Wait a bit to prevent overwhelming the connection
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Send file end message
                const endMessage = {
                    from: username,
                    sent_at: new Date().toISOString(),
                    message_type: "file_end",
                    filename: file.name,
                    content: file.name
                };
                socket.send(JSON.stringify(endMessage));

                // Add local message showing file upload completed
                addMessage({
                    from: username,
                    sent_at: new Date().toISOString(),
                    message_type: "text",
                    content: `File uploaded: ${file.name}`
                });

                setIsUploading(false);
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
        }
    };

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    return (
        <div className="chat-interface">
            <div className="chat-header">
                <h2>Chat Room: {roomName}</h2>
                <div className="room-info">
                    <span>Algorithm: {algorithm}</span>
                    <button onClick={handleLeaveRoom} className="leave-button">
                        Leave Room
                    </button>
                </div>
            </div>

            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`message ${msg.from === username ? 'own-message' : ''}`}
                    >
                        <div className="message-header">
                            <span className="sender">{msg.from}</span>
                            <span className="timestamp">
                                {new Date(msg.sent_at).toLocaleTimeString()}
                            </span>
                        </div>
                        <div className="message-content">
                            {msg.message_type === 'text' ? (
                                msg.content
                            ) : msg.message_type === 'client_connected' || msg.message_type === 'client_disconnected' ? (
                                <em>{msg.content}</em>
                            ) : null}
                        </div>
                    </div>
                ))}
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
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    style={{ marginLeft: '10px' }}
                />
                {isUploading && <span>Uploading...</span>}
            </form>
        </div>
    );
}

export default ChatInterface;