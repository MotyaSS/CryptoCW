import { useState } from 'react';
import RoomManagement from './components/RoomManagement.jsx';
import ChatInterface from './components/ChatInterface.jsx';
import './styles/App.css';

function App() {
    const [currentRoom, setCurrentRoom] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [algorithm, setAlgorithm] = useState('RC5');

    const handleJoinRoom = (roomName, username, password, algo) => {
        setCurrentRoom(roomName);
        setUsername(username);
        setPassword(password);
        setAlgorithm(algo || 'RC5'); // Default to RC5 if not specified
    };

    const handleLeaveRoom = () => {
        setCurrentRoom(null);
        setPassword('');
        setAlgorithm('RC5');
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
                        algorithm={algorithm}
                        onLeaveRoom={handleLeaveRoom}
                    />
                </div>
            )}
        </div>
    );
}

export default App;