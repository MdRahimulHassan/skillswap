import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Matches() {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get('http://localhost:8080/api/matches', { headers: { Authorization: `Bearer ${token}` } });
    setMatches(res.data);
  };

  return (
    <div>
      <h2>Potential Matches</h2>
      {matches.map(match => (
        <div key={match.user_id}>
          <h3>{match.name}</h3>
          <p>{match.bio}</p>
          <p>Teaches: {match.teach_skill}, Learns: {match.learn_skill}</p>
          <button>Connect</button>
        </div>
      ))}
    </div>
  );
}

export default Matches;