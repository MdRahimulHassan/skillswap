import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Paper, TextField, Button, Typography, Box, Card, CardContent, Avatar, Select, MenuItem, FormControl, InputLabel, Grid, Chip, Alert, Tabs, Tab, IconButton, InputAdornment } from '@mui/material';
import { Person, LocationOn, Link as LinkIcon, Work, Edit, Save, Cancel } from '@mui/icons-material';

function Profile() {
  const [user, setUser] = useState({});
  const [skills, setSkills] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [skillType, setSkillType] = useState('teach');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [portfolioLinks, setPortfolioLinks] = useState('');

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

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleAvatarUpload = (event) => {
    // Placeholder for avatar upload functionality
    alert('Avatar upload feature coming soon!');
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:8080/api/profile', {
        ...user,
        portfolio_links: portfolioLinks
      }, { headers: { Authorization: `Bearer ${token}` } });
      setError('');
      setEditMode(false);
      alert('Profile updated successfully');
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    fetchProfile(); // Reset to original values
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom className="page-title">
        My Profile
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Avatar sx={{ width: 100, height: 100, mx: 'auto', mb: 2 }} style={{ backgroundColor: '#1976d2', fontSize: '2rem' }}>
                  {getInitials(user.name)}
                </Avatar>
                <IconButton
                  sx={{ position: 'absolute', bottom: 8, right: 'calc(50% - 20px)', backgroundColor: 'rgba(255,255,255,0.8)' }}
                  size="small"
                  onClick={handleAvatarUpload}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{user.name || 'Your Name'}</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>{user.email}</Typography>
              {user.location && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <LocationOn sx={{ mr: 0.5, fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="textSecondary">{user.location}</Typography>
                </Box>
              )}
              {user.experience_level && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Work sx={{ mr: 0.5, fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="textSecondary" sx={{ textTransform: 'capitalize' }}>
                    {user.experience_level}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="profile tabs">
                <Tab label="Profile" icon={<Person />} iconPosition="start" />
                <Tab label="Skills" icon={<Work />} iconPosition="start" />
                <Tab label="Settings" icon={<Edit />} iconPosition="start" />
              </Tabs>
            </Box>

            {/* Profile Tab */}
            {tabValue === 0 && (
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Personal Information</Typography>
                  {!editMode ? (
                    <Button startIcon={<Edit />} onClick={() => setEditMode(true)}>
                      Edit
                    </Button>
                  ) : (
                    <Box>
                      <Button startIcon={<Save />} onClick={handleSaveProfile} disabled={loading} sx={{ mr: 1 }}>
                        Save
                      </Button>
                      <Button startIcon={<Cancel />} onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    </Box>
                  )}
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Full Name"
                      value={user.name || ''}
                      onChange={(e) => setUser({ ...user, name: e.target.value })}
                      fullWidth
                      disabled={!editMode}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Person color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Location"
                      value={user.location || ''}
                      onChange={(e) => setUser({ ...user, location: e.target.value })}
                      fullWidth
                      disabled={!editMode}
                      placeholder="City, Country"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LocationOn color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth disabled={!editMode}>
                      <InputLabel>Experience Level</InputLabel>
                      <Select
                        value={user.experience_level || ''}
                        onChange={(e) => setUser({ ...user, experience_level: e.target.value })}
                        label="Experience Level"
                      >
                        <MenuItem value="beginner">Beginner</MenuItem>
                        <MenuItem value="intermediate">Intermediate</MenuItem>
                        <MenuItem value="advanced">Advanced</MenuItem>
                        <MenuItem value="expert">Expert</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Portfolio Links"
                      value={portfolioLinks}
                      onChange={(e) => setPortfolioLinks(e.target.value)}
                      fullWidth
                      disabled={!editMode}
                      placeholder="GitHub, LinkedIn, personal website (comma separated)"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LinkIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Bio"
                      value={user.bio || ''}
                      onChange={(e) => setUser({ ...user, bio: e.target.value })}
                      multiline
                      rows={4}
                      fullWidth
                      disabled={!editMode}
                      placeholder="Tell others about yourself, your interests, and what you're looking to achieve"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Skills Tab */}
            {tabValue === 1 && (
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Manage Skills</Typography>

                <Paper sx={{ p: 2, mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>Add New Skill</Typography>
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

                {(user.teach_skills || user.learn_skills) && (
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Your Skills</Typography>
                    {user.teach_skills && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" color="primary">Teaching:</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                          {user.teach_skills.map(skill => <Chip key={skill.id} label={skill.name} color="primary" />)}
                        </Box>
                      </Box>
                    )}
                    {user.learn_skills && (
                      <Box>
                        <Typography variant="subtitle1" color="secondary">Learning:</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                          {user.learn_skills.map(skill => <Chip key={skill.id} label={skill.name} color="secondary" />)}
                        </Box>
                      </Box>
                    )}
                  </Paper>
                )}
              </Box>
            )}

            {/* Settings Tab */}
            {tabValue === 2 && (
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Account Settings</Typography>
                <Typography variant="body2" color="textSecondary">
                  Account settings and preferences will be available here.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Profile;