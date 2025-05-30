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
                From: 'System',
                MsgType: 'client_connected',
                Content: `Connected to room: ${roomName}`,
                SentAt: new Date().toISOString()
            });
        };

        newSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                addMessage(data);
            } catch (e) {
                addMessage({
                    From: 'System',
                    MsgType: 'text',
                    Content: event.data,
                    SentAt: new Date().toISOString()
                });
            }
        };

        newSocket.onclose = () => {
            addMessage({
                From: 'System',
                MsgType: 'client_disconnected',
                Content: 'Disconnected from room',
                SentAt: new Date().toISOString()
            });
            socketInitialized.current = false;
        };

        newSocket.onerror = (error) => {
            addMessage({
                From: 'System',
                MsgType: 'text',
                Content: `Error: ${error.message}`,
                SentAt: new Date().toISOString()
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
                From: username,
                SentAt: messageData.sent_at,
                MsgType: "text",
                Content: messageInput,
                Filename: ""
            });

            // Send the message
            socket.send(JSON.stringify(jsonMessage));
            setMessageInput('');
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
                <button onClick={onLeaveRoom} className="leave-button">
                    Leave Room
                </button>
            </div>

            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`message ${msg.From === username ? 'own-message' : ''}`}
                    >
                        <div className="message-header">
                            <span className="sender">{msg.From}</span>
                            <span className="timestamp">
                {new Date(msg.SentAt).toLocaleTimeString()}
              </span>
                        </div>
                        <div className="message-content">
                            {msg.MsgType === 'text' ? (
                                msg.Content
                            ) : msg.MsgType === 'client_connected' || msg.MsgType === 'client_disconnected' ? (
                                <em>{msg.Content}</em>
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