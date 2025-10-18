import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <nav>
      <Link to="/profile">Profile</Link>
      <Link to="/matches">Matches</Link>
      <Link to="/messages">Messages</Link>
      {token && <button onClick={logout}>Logout</button>}
    </nav>
  );
}

export default Navbar;