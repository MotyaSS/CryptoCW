import { useState } from 'react';

function RoomManagement({ onJoinRoom }) {
    const [activeTab, setActiveTab] = useState('join');
    const [formData, setFormData] = useState({
        roomName: '',
        password: '',
        username: '',
        algorithm: 'RC5', // Default to RC5
        mode: 'CBC',     // Default to CBC
        padding: 'PKCS7' // Default to PKCS7
    });
    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/add_room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `room_name=${encodeURIComponent(formData.roomName)}&password=${encodeURIComponent(formData.password)}&algorithm=${encodeURIComponent(formData.algorithm)}&mode=${encodeURIComponent(formData.mode)}&padding=${encodeURIComponent(formData.padding)}`
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            setMessage('Room created successfully!');
            setFormData({ roomName: '', password: '', username: '', algorithm: 'RC5', mode: 'CBC', padding: 'PKCS7' });
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    };

    const handleDeleteRoom = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/delete_room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `name=${encodeURIComponent(formData.roomName)}&password=${encodeURIComponent(formData.password)}`
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            setMessage('Room deleted successfully!');
            setFormData({ roomName: '', password: '', username: '', algorithm: 'RC5', mode: 'CBC', padding: 'PKCS7' });
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    };

    const handleJoin = (e) => {
        e.preventDefault();
        if (formData.roomName && formData.password && formData.username) {
            onJoinRoom(formData.roomName, formData.username, formData.password, formData.algorithm, formData.mode, formData.padding);
        } else {
            setMessage('Please fill all fields');
        }
    };

    return (
        <div className="room-management">
            <div className="tab-buttons">
                <button
                    className={activeTab === 'join' ? 'active' : ''}
                    onClick={() => setActiveTab('join')}
                >
                    Join Room
                </button>
                <button
                    className={activeTab === 'create' ? 'active' : ''}
                    onClick={() => setActiveTab('create')}
                >
                    Create Room
                </button>
                <button
                    className={activeTab === 'delete' ? 'active' : ''}
                    onClick={() => setActiveTab('delete')}
                >
                    Delete Room
                </button>
            </div>

            {message && <div className="message">{message}</div>}

            {activeTab === 'join' && (
                <form onSubmit={handleJoin} className="room-form">
                    <h2>Join Room</h2>
                    <input
                        type="text"
                        name="roomName"
                        value={formData.roomName}
                        onChange={handleChange}
                        placeholder="Room Name"
                        required
                    />
                    <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="Your Username"
                        required
                    />
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Room Password"
                        required
                    />
                    <button type="submit">Join Room</button>
                </form>
            )}

            {activeTab === 'create' && (
                <form onSubmit={handleCreateRoom} className="room-form">
                    <h2>Create Room</h2>
                    <input
                        type="text"
                        name="roomName"
                        value={formData.roomName}
                        onChange={handleChange}
                        placeholder="Room Name"
                        required
                    />
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Room Password"
                        required
                    />
                    <div className="encryption-settings">
                        <select
                            name="algorithm"
                            value={formData.algorithm}
                            onChange={handleChange}
                            required
                        >
                            <option value="RC5">RC5</option>
                            <option value="TwoFish">TwoFish</option>
                        </select>
                        <select
                            name="mode"
                            value={formData.mode}
                            onChange={handleChange}
                            required
                        >
                            <option value="CBC">CBC</option>
                            <option value="PCBC">PCBC</option>
                            <option value="CFB">CFB</option>
                            <option value="OFB">OFB</option>
                            <option value="CTR">CTR</option>
                        </select>
                        <select
                            name="padding"
                            value={formData.padding}
                            onChange={handleChange}
                            required
                        >
                            <option value="Zeros">Zeros</option>
                            <option value="ANSI_X923">ANSI X.923</option>
                            <option value="PKCS7">PKCS7</option>
                            <option value="ISO10126">ISO10126</option>
                        </select>
                    </div>
                    <button type="submit">Create Room</button>
                </form>
            )}

            {activeTab === 'delete' && (
                <form onSubmit={handleDeleteRoom} className="room-form">
                    <h2>Delete Room</h2>
                    <input
                        type="text"
                        name="roomName"
                        value={formData.roomName}
                        onChange={handleChange}
                        placeholder="Room Name"
                        required
                    />
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Room Password"
                        required
                    />
                    <button type="submit">Delete Room</button>
                </form>
            )}
        </div>
    );
}

export default RoomManagement;