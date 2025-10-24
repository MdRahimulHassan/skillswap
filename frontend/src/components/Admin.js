import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Typography, Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Alert, CircularProgress, Tabs, Tab, Grid, Card, CardContent, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import { People, School, BarChart, Security, Add, Edit, Delete, Block, CheckCircle } from '@mui/icons-material';

function Admin() {
  const [users, setUsers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:8080/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      setUsers(res.data);
    } catch (err) {
      setError('Failed to load users');
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

  const fetchStatistics = async () => {
    try {
      const token = localStorage.getItem('token');
      // Mock statistics since we don't know the API
      setStatistics({
        totalUsers: users.length,
        totalSkills: skills.length,
        activeMatches: Math.floor(users.length / 2),
        newUsersThisMonth: Math.floor(users.length / 4)
      });
    } catch (err) {
      setError('Failed to load statistics');
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleAddSkill = async () => {
    if (!newSkillName.trim()) return;

    try {
      await axios.post('http://localhost:8080/api/admin/skills', { name: newSkillName });
      setNewSkillName('');
      setSkillDialogOpen(false);
      fetchSkills();
      alert('Skill added successfully');
    } catch (err) {
      setError('Failed to add skill');
    }
  };

  const handleDeleteSkill = async (skillId) => {
    if (!window.confirm('Are you sure you want to delete this skill?')) return;

    try {
      await axios.delete(`http://localhost:8080/api/admin/skills/${skillId}`);
      fetchSkills();
      alert('Skill deleted successfully');
    } catch (err) {
      setError('Failed to delete skill');
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:8080/api/admin/users/${userId}/status`,
        { is_active: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchUsers();
      alert('User status updated');
    } catch (err) {
      setError('Failed to update user status');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSkills();
    fetchStatistics();
  }, []);

  if (loading) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom className="page-title">
        Admin Dashboard
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="admin tabs">
            <Tab label="Overview" icon={<BarChart />} iconPosition="start" />
            <Tab label="Users" icon={<People />} iconPosition="start" />
            <Tab label="Skills" icon={<School />} iconPosition="start" />
            <Tab label="Moderation" icon={<Security />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* Overview Tab */}
        {tabValue === 0 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Platform Statistics</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <People sx={{ fontSize: 40, color: '#1976d2', mb: 1 }} />
                    <Typography variant="h4" color="primary">{statistics.totalUsers || 0}</Typography>
                    <Typography variant="body2" color="textSecondary">Total Users</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <School sx={{ fontSize: 40, color: '#1976d2', mb: 1 }} />
                    <Typography variant="h4" color="primary">{statistics.totalSkills || 0}</Typography>
                    <Typography variant="body2" color="textSecondary">Total Skills</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <CheckCircle sx={{ fontSize: 40, color: '#1976d2', mb: 1 }} />
                    <Typography variant="h4" color="primary">{statistics.activeMatches || 0}</Typography>
                    <Typography variant="body2" color="textSecondary">Active Matches</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <BarChart sx={{ fontSize: 40, color: '#1976d2', mb: 1 }} />
                    <Typography variant="h4" color="primary">{statistics.newUsersThisMonth || 0}</Typography>
                    <Typography variant="body2" color="textSecondary">New Users (Month)</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Users Tab */}
        {tabValue === 1 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>User Management</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.is_admin ? <Chip label="Admin" color="primary" /> : <Chip label="User" />}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.is_active ? "Active" : "Inactive"}
                          color={user.is_active ? "success" : "error"}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => setEditingUser(user)}>
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                        >
                          {user.is_active ? <Block /> : <CheckCircle />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {users.length === 0 && (
              <Typography variant="body2" sx={{ textAlign: 'center', mt: 2 }}>
                No users found.
              </Typography>
            )}
          </Box>
        )}

        {/* Skills Tab */}
        {tabValue === 2 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Skill Management</Typography>
              <Button variant="contained" startIcon={<Add />} onClick={() => setSkillDialogOpen(true)}>
                Add Skill
              </Button>
            </Box>

            <Grid container spacing={2}>
              {skills.map(skill => (
                <Grid item xs={12} sm={6} md={4} key={skill.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6">{skill.name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        ID: {skill.id}
                      </Typography>
                    </CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
                      <IconButton size="small" color="error" onClick={() => handleDeleteSkill(skill.id)}>
                        <Delete />
                      </IconButton>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {skills.length === 0 && (
              <Typography variant="body2" sx={{ textAlign: 'center', mt: 2 }}>
                No skills found.
              </Typography>
            )}
          </Box>
        )}

        {/* Moderation Tab */}
        {tabValue === 3 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Moderation Tools</Typography>
            <Typography variant="body2" color="textSecondary">
              Moderation tools and user reports will be available here.
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Add Skill Dialog */}
      <Dialog open={skillDialogOpen} onClose={() => setSkillDialogOpen(false)}>
        <DialogTitle>Add New Skill</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Skill Name"
            fullWidth
            variant="outlined"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSkillDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddSkill} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Admin;