import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Profile from './components/Profile';
import Matches from './components/Matches';
import Messages from './components/Messages';
import Admin from './components/Admin';
import Navbar from './components/Navbar';
import './App.css';

function App() {
  const token = localStorage.getItem('token');
  return (
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {token && (
            <>
              <Route path="/profile" element={<Profile />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/admin" element={<Admin />} />
            </>
          )}
          <Route path="/" element={<Login />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
