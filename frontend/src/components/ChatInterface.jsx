import { useState, useEffect, useRef } from 'react';

function ChatInterface({ roomName, username, password, onLeaveRoom }) {
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

        newSocket.onmessage = (event) => {
            try {
                console.log('Raw WebSocket message:', event.data);
                const data = JSON.parse(event.data);
                console.log('Parsed message data:', data);
                
                // Decode base64 content if it exists and looks like base64
                if (data.content && typeof data.content === 'string' && data.content.match(/^[A-Za-z0-9+/=]+$/)) {
                    try {
                        const decoded = atob(data.content);
                        data.content = decoded;
                        console.log('Decoded base64 content:', decoded);
                    } catch (e) {
                        console.warn('Failed to decode base64 content:', e);
                    }
                }
                
                console.log('Message content:', data.content);
                console.log('Message type:', data.message_type);
                console.log('Message from:', data.from);
                addMessage(data);
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
    }, [roomName, username, password]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (messageInput.trim() && socket && socket.readyState === WebSocket.OPEN) {
            // Create properly formatted message
            const messageData = {
                from: username, // lowercase to match struct tags
                sent_at: new Date().toISOString(),
                message_type: "text", // explicitly set type
                filename: "", // empty string for text messages
                content: new TextEncoder().encode(messageInput) // proper binary data
            };

            // Convert to JSON-safe format
            const jsonMessage = {
                ...messageData,
                content: Array.from(messageData.content) // convert Uint8Array to regular array
            };

            // Add to local state (using string content for display)
            addMessage({
                from: username,
                sent_at: messageData.sent_at,
                message_type: "text",
                content: messageInput,
                filename: ""
            });

            // Send the message
            socket.send(JSON.stringify(jsonMessage));
            setMessageInput('');
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
                    sent_at: new Date().toISOString(),
                    filename: ""
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
                <button onClick={handleLeaveRoom} className="leave-button">
                    Leave Room
                </button>
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