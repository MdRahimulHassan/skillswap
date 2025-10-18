import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Admin() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get('http://localhost:8080/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
    setUsers(res.data);
  };

  return (
    <div>
      <h2>Admin Dashboard</h2>
      <h3>Users</h3>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.name} - {user.email} {user.is_admin ? '(Admin)' : ''}</li>
        ))}
      </ul>
    </div>
  );
}

export default Admin;