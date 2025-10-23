import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Typography, Box, Grid, Card, CardContent, CardActions, Button, Avatar, Chip, Alert, CircularProgress } from '@mui/material';

function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:8080/api/matches', { headers: { Authorization: `Bearer ${token}` } });
      setMatches(res.data);
    } catch (err) {
      setError('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const acceptMatch = async (matchId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8080/api/matches/${matchId}/accept`, {}, { headers: { Authorization: `Bearer ${token}` } });
      alert('Match accepted!');
      fetchMatches(); // Refresh list
    } catch (err) {
      setError('Failed to accept match');
    }
  };

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';
  };

  if (loading) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom className="page-title">
        Potential Matches
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={3}>
        {matches.map(match => (
          <Grid item xs={12} sm={6} md={4} key={match.user_id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ mr: 2 }} style={{ backgroundColor: '#1976d2' }}>
                    {getInitials(match.name)}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{match.name}</Typography>
                    <Typography variant="body2" color="textSecondary">{match.email}</Typography>
                  </Box>
                </Box>
                <Typography variant="body2" sx={{ mb: 1 }}>{match.bio}</Typography>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="primary">Teaches: <Chip label={match.teach_skill} size="small" color="primary" /></Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="secondary">Learns: <Chip label={match.learn_skill} size="small" color="secondary" /></Typography>
                </Box>
              </CardContent>
              <CardActions>
                <Button size="small" variant="contained" onClick={() => acceptMatch(match.id)}>
                  Connect
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      {matches.length === 0 && !loading && (
        <Typography variant="body1" sx={{ textAlign: 'center', mt: 4 }}>
          No matches found. Update your skills to find potential partners!
        </Typography>
      )}
    </Box>
  );
}

export default Matches;