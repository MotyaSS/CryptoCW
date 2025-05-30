import { useState } from 'react';
import RoomManagement from './components/RoomManagement.jsx';
import ChatInterface from './components/ChatInterface.jsx';
import './styles/App.css';

function App() {
    const [currentRoom, setCurrentRoom] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleJoinRoom = (roomName, username, password) => {
        setCurrentRoom(roomName);
        setUsername(username);
        setPassword(password);
    };

    const handleLeaveRoom = () => {
        setCurrentRoom(null);
        setPassword('');
    };

    return (
        <div className="app-container">
            <h1>Crypto Chat Application</h1>

            {!currentRoom ? (
                <div className="content-section">
                    <RoomManagement onJoinRoom={handleJoinRoom} />
                </div>
            ) : (
                <div className="content-section">
                    <ChatInterface
                        roomName={currentRoom}
                        username={username}
                        password={password}
                        onLeaveRoom={handleLeaveRoom}
                    />
                </div>
            )}
        </div>
    );
}

export default App;