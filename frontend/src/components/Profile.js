import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Profile() {
  const [user, setUser] = useState({});
  const [skills, setSkills] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [skillType, setSkillType] = useState('teach');

  useEffect(() => {
    fetchProfile();
    fetchSkills();
  }, []);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get('http://localhost:8080/api/profile', { headers: { Authorization: `Bearer ${token}` } });
    setUser(res.data);
  };

  const fetchSkills = async () => {
    const res = await axios.get('http://localhost:8080/api/skills');
    setSkills(res.data);
  };

  const updateProfile = async () => {
    const token = localStorage.getItem('token');
    await axios.put('http://localhost:8080/api/profile', user, { headers: { Authorization: `Bearer ${token}` } });
    alert('Profile updated');
  };

  const addSkill = async () => {
    const token = localStorage.getItem('token');
    await axios.post('http://localhost:8080/api/user-skills', { skill_id: selectedSkill, skill_type: skillType }, { headers: { Authorization: `Bearer ${token}` } });
    alert('Skill added');
  };

  return (
    <div>
      <h2>Profile</h2>
      <input type="text" placeholder="Name" value={user.name || ''} onChange={(e) => setUser({ ...user, name: e.target.value })} />
      <textarea placeholder="Bio" value={user.bio || ''} onChange={(e) => setUser({ ...user, bio: e.target.value })} />
      <button onClick={updateProfile}>Update Profile</button>
      <h3>Add Skill</h3>
      <select value={selectedSkill} onChange={(e) => setSelectedSkill(e.target.value)}>
        <option value="">Select Skill</option>
        {skills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
      </select>
      <select value={skillType} onChange={(e) => setSkillType(e.target.value)}>
        <option value="teach">Teach</option>
        <option value="learn">Learn</option>
      </select>
      <button onClick={addSkill}>Add Skill</button>
    </div>
  );
}

export default Profile;