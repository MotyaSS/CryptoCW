import { useState, useEffect, useRef } from 'react';
import { encryptMessage, decryptMessage, generateIV } from '../encryption';

function ChatInterface({ roomName, username, password, algorithm, onLeaveRoom }) {
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [socket, setSocket] = useState(null);
    const messagesEndRef = useRef(null);
    const socketInitialized = useRef(false);

    // Function to add message to chat
    const addMessage = (message) => {
        setMessages(prev => [...prev, message]);
    };

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

                // Only decrypt text messages
                if (data.message_type === 'text') {
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
                } else {
                    addMessage(data);
                }
            } catch (e) {
                console.error('Error processing message:', e);
                addMessage({
                    from: 'System',
                    message_type: 'text',
                    content: event.data,
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
            </form>
        </div>
    );
}

export default ChatInterface;