import React, { useState, useRef, useEffect } from 'react';

const WS_URL = 'ws://localhost:8080/ws';

export default function ChatApp() {
    const [room, setRoom] = useState('');
    const [username, setUsername] = useState('');
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [creating, setCreating] = useState(false);
    const [createRoomName, setCreateRoomName] = useState('');
    const [createStatus, setCreateStatus] = useState('');
    const ws = useRef(null);

    useEffect(() => {
        return () => {
            if (ws.current) ws.current.close();
        };
    }, []);

    const connect = () => {
        if (!room || !username) return;
        const url = `${WS_URL}?room_name=${encodeURIComponent(room)}&username=${encodeURIComponent(username)}`;
        ws.current = new WebSocket(url);
        ws.current.onopen = () => setConnected(true);
        ws.current.onclose = () => setConnected(false);
        ws.current.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                setMessages((prev) => [...prev, msg]);
            } catch {}
        };
    };

    const createRoom = async () => {
        if (!createRoomName) return;
        setCreateStatus('');
        setCreating(true);
        try {
            const res = await fetch('http://localhost:8080/add_room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `name=${encodeURIComponent(createRoomName)}`
            });
            if (res.ok) {
                setCreateStatus('Room created!');
                setRoom(createRoomName);
            } else {
                setCreateStatus('Failed to create room');
            }
        } catch {
            setCreateStatus('Failed to create room');
        }
        setCreating(false);
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (ws.current && input) {
            const msg = { sender: username, content: input };
            ws.current.send(JSON.stringify(msg));
            setMessages((prev) => [...prev, msg]); // Show sent message immediately
            setInput('');
        }
    };

    if (!connected) {
        return (
            <div style={{ maxWidth: 400, margin: '2rem auto' }}>
                <h2>Join Chat Room</h2>
                <input placeholder="Room name" value={room} onChange={e => setRoom(e.target.value)} /><br />
                <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} /><br />
                <button onClick={connect} disabled={!room || !username}>Connect</button>
                <hr />
                <h3>Create Room</h3>
                <input placeholder="New room name" value={createRoomName} onChange={e => setCreateRoomName(e.target.value)} />
                <button onClick={createRoom} disabled={!createRoomName || creating}>Create</button>
                {createStatus && <div>{createStatus}</div>}
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 400, margin: '2rem auto' }}>
            <h2>Room: {room}</h2>
            <div style={{ border: '1px solid #ccc', height: 300, overflowY: 'auto', marginBottom: 8, padding: 8 }}>
                {messages.map((m, i) => (
                    <div key={i}><b>{m.sender}:</b> {m.content}</div>
                ))}
            </div>
            <form onSubmit={sendMessage} style={{ display: 'flex' }}>
                <input
                    style={{ flex: 1 }}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Type a message..."
                />
                <button type="submit" disabled={!input}>Send</button>
            </form>
            <button onClick={() => { ws.current.close(); setConnected(false); }}>Disconnect</button>
        </div>
    );
}
