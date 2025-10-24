import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Typography, Box, Grid, Card, CardContent, CardActions, Button, Avatar, Chip, Alert, CircularProgress, TextField, FormControl, InputLabel, Select, MenuItem, InputAdornment, Rating, IconButton } from '@mui/material';
import { LocationOn, Work, Star, Message, Person, FilterList } from '@mui/icons-material';

function Matches() {
  const [matches, setMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [experienceFilter, setExperienceFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');

  useEffect(() => {
    fetchMatches();
  }, []);

  useEffect(() => {
    filterMatches();
  }, [matches, searchTerm, experienceFilter, skillFilter]);

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

  const filterMatches = () => {
    let filtered = matches;

    if (searchTerm) {
      filtered = filtered.filter(match =>
        match.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.bio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.teach_skill.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.learn_skill.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (experienceFilter) {
      filtered = filtered.filter(match => match.experience_level === experienceFilter);
    }

    if (skillFilter) {
      filtered = filtered.filter(match =>
        match.teach_skill === skillFilter || match.learn_skill === skillFilter
      );
    }

    setFilteredMatches(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setExperienceFilter('');
    setSkillFilter('');
  };

  if (loading) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom className="page-title">
        Potential Matches
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Search and Filter Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Search matches"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FilterList color="action" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Experience Level</InputLabel>
            <Select
              value={experienceFilter}
              onChange={(e) => setExperienceFilter(e.target.value)}
              label="Experience Level"
            >
              <MenuItem value="">All Levels</MenuItem>
              <MenuItem value="beginner">Beginner</MenuItem>
              <MenuItem value="intermediate">Intermediate</MenuItem>
              <MenuItem value="advanced">Advanced</MenuItem>
              <MenuItem value="expert">Expert</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Skill</InputLabel>
            <Select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              label="Skill"
            >
              <MenuItem value="">All Skills</MenuItem>
              {/* This would ideally come from the skills API */}
              <MenuItem value="JavaScript">JavaScript</MenuItem>
              <MenuItem value="Python">Python</MenuItem>
              <MenuItem value="React">React</MenuItem>
              <MenuItem value="Node.js">Node.js</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={clearFilters}>
            Clear Filters
          </Button>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {filteredMatches.map(match => (
          <Grid item xs={12} sm={6} md={4} key={match.user_id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ mr: 2, width: 56, height: 56 }} style={{ backgroundColor: '#1976d2' }}>
                    {getInitials(match.name)}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{match.name}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <LocationOn sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                      <Typography variant="body2" color="textSecondary">
                        {match.location || 'Location not specified'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Work sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                      <Typography variant="body2" color="textSecondary" sx={{ textTransform: 'capitalize' }}>
                        {match.experience_level || 'Not specified'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                  {match.bio || 'No bio available'}
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="primary" sx={{ mb: 0.5 }}>
                    <strong>Teaches:</strong>
                  </Typography>
                  <Chip label={match.teach_skill} size="small" color="primary" />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="secondary" sx={{ mb: 0.5 }}>
                    <strong>Learns:</strong>
                  </Typography>
                  <Chip label={match.learn_skill} size="small" color="secondary" />
                </Box>

                {/* Mutual interests placeholder */}
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Mutual Interests:</strong>
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Technology, Programming
                  </Typography>
                </Box>
              </CardContent>

              <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                <Button size="small" variant="outlined" startIcon={<Person fontSize="small" />}>
                  View Profile
                </Button>
                <Button size="small" variant="outlined" startIcon={<Message fontSize="small" />}>
                  Message
                </Button>
                <Button size="small" variant="contained" onClick={() => acceptMatch(match.id)}>
                  Connect
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredMatches.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            {matches.length === 0 ? 'No matches found' : 'No matches match your filters'}
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {matches.length === 0
              ? 'Update your skills to find potential partners!'
              : 'Try adjusting your search criteria or clearing filters.'
            }
          </Typography>
          {matches.length > 0 && (
            <Button variant="outlined" onClick={clearFilters} sx={{ mt: 2 }}>
              Clear All Filters
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}

export default Matches;