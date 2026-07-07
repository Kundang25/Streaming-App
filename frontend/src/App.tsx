import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { RoomProvider } from './context/RoomContext';
import Home from './pages/Home';
import RoomPage from './pages/RoomPage';

const App: React.FC = () => {
  return (
    <Router>
      <RoomProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomCode" element={<RoomPage />} />
        </Routes>
      </RoomProvider>
    </Router>
  );
};

export default App;
