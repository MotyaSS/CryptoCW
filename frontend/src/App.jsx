import { useState } from 'react';
import RoomManagement from './components/RoomManagement.jsx';
import ChatInterface from './components/ChatInterface.jsx';
import './styles/App.css';

function App() {
    const [currentRoom, setCurrentRoom] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [algorithm, setAlgorithm] = useState('RC5');
    const [mode, setMode] = useState('CBC');
    const [padding, setPadding] = useState('PKCS7');

    const handleJoinRoom = (roomName, username, password, algo, mode, padding) => {
        setCurrentRoom(roomName);
        setUsername(username);
        setPassword(password);
        setAlgorithm(algo || 'RC5');
        setMode(mode || 'CBC');
        setPadding(padding || 'PKCS7');
    };

    const handleLeaveRoom = () => {
        setCurrentRoom(null);
        setPassword('');
        setAlgorithm('RC5');
        setMode('CBC');
        setPadding('PKCS7');
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
                        mode={mode}
                        padding={padding}
                        onLeaveRoom={handleLeaveRoom}
                        setAlgorithm={setAlgorithm}
                        setMode={setMode}
                        setPadding={setPadding}
                    />
                </div>
            )}
        </div>
    );
}

export default App;