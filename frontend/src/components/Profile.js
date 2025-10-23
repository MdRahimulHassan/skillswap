import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Paper, TextField, Button, Typography, Box, Card, CardContent, Avatar, Select, MenuItem, FormControl, InputLabel, Grid, Chip, Alert } from '@mui/material';

function Profile() {
  const [user, setUser] = useState({});
  const [skills, setSkills] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [skillType, setSkillType] = useState('teach');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchSkills();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:8080/api/profile', { headers: { Authorization: `Bearer ${token}` } });
      setUser(res.data);
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchSkills = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/skills');
      setSkills(res.data);
    } catch (err) {
      setError('Failed to load skills');
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:8080/api/profile', user, { headers: { Authorization: `Bearer ${token}` } });
      setError('');
      alert('Profile updated');
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const addSkill = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:8080/api/user-skills', { skill_id: selectedSkill, skill_type: skillType }, { headers: { Authorization: `Bearer ${token}` } });
      setError('');
      alert('Skill added');
      fetchProfile(); // Refresh to show new skill
    } catch (err) {
      setError('Failed to add skill');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom className="page-title">
        Profile
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2 }} style={{ backgroundColor: '#1976d2' }}>
                {getInitials(user.name)}
              </Avatar>
              <Typography variant="h6">{user.name || 'Your Name'}</Typography>
              <Typography variant="body2" color="textSecondary">{user.email}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Edit Profile</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Name"
                value={user.name || ''}
                onChange={(e) => setUser({ ...user, name: e.target.value })}
                fullWidth
              />
              <TextField
                label="Bio"
                value={user.bio || ''}
                onChange={(e) => setUser({ ...user, bio: e.target.value })}
                multiline
                rows={4}
                fullWidth
              />
              <Button variant="contained" onClick={updateProfile} disabled={loading}>
                {loading ? 'Updating...' : 'Update Profile'}
              </Button>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Add Skill</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Skill</InputLabel>
                <Select value={selectedSkill} onChange={(e) => setSelectedSkill(e.target.value)} label="Skill">
                  {skills.map(skill => <MenuItem key={skill.id} value={skill.id}>{skill.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Type</InputLabel>
                <Select value={skillType} onChange={(e) => setSkillType(e.target.value)} label="Type">
                  <MenuItem value="teach">Teach</MenuItem>
                  <MenuItem value="learn">Learn</MenuItem>
                </Select>
              </FormControl>
              <Button variant="contained" onClick={addSkill} disabled={loading || !selectedSkill}>
                Add Skill
              </Button>
            </Box>
          </Paper>
        </Grid>
        {(user.teach_skills || user.learn_skills) && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Your Skills</Typography>
              {user.teach_skills && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1">Teaching:</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {user.teach_skills.map(skill => <Chip key={skill.id} label={skill.name} color="primary" />)}
                  </Box>
                </Box>
              )}
              {user.learn_skills && (
                <Box>
                  <Typography variant="subtitle1">Learning:</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {user.learn_skills.map(skill => <Chip key={skill.id} label={skill.name} color="secondary" />)}
                  </Box>
                </Box>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

export default Profile;