import React, { useState, useEffect, useRef } from 'react';

function App() {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [username, setUsername] = useState('');
    const ws = useRef(null);

    useEffect(() => {
        // Create WebSocket connection
        ws.current = new WebSocket('ws://localhost:8000/ws');

        // Connection opened
        ws.current.onopen = () => {
            console.log('WebSocket connected');
        };

        // Listen for messages
        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setMessages(prev => [...prev, {
                    user: data.username,
                    content: data.content
                }]);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        // Handle errors
        ws.current.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        // Handle connection close
        ws.current.onclose = () => {
            console.log('WebSocket disconnected');
        };

        // Clean up on unmount
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, []);

    const sendMessage = () => {
        if (inputMessage.trim() && ws.current.readyState === WebSocket.OPEN) {
            const message = {
                username: username,
                content: inputMessage
            };
            ws.current.send(JSON.stringify(message));
            setInputMessage('');
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h1>WebSocket Chat</h1>

            <div style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your username"
                    style={{ padding: '8px', marginRight: '10px' }}
                />
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your message"
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    style={{ padding: '8px', marginRight: '10px', width: '300px' }}
                />
                <button
                    onClick={sendMessage}
                    style={{ padding: '8px 16px' }}
                >
                    Send
                </button>
            </div>

            <div style={{ border: '1px solid #ccc', padding: '10px', height: '400px', overflowY: 'auto' }}>
                {messages.map((message, index) => (
                    <div key={index} style={{ marginBottom: '10px' }}>
                        <strong>{message.user}: </strong>
                        <span>{message.content}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default App;