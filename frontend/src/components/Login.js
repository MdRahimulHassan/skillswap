import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Paper, TextField, Button, Typography, Box, Alert, Link, IconButton, InputAdornment } from '@mui/material';
import { Email, Lock, Person, School } from '@mui/icons-material';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('http://localhost:8080/login', { email, password });
      localStorage.setItem('token', res.data.token);
      navigate('/profile');
    } catch (err) {
      setError('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      setError('Please enter your email address.');
      return;
    }
    // Placeholder for forgot password functionality
    alert('Password reset feature is coming soon! Please contact support.');
    setForgotPassword(false);
    setResetEmail('');
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="90vh" sx={{ backgroundColor: '#f5f7fa' }}>
      <Paper elevation={6} sx={{ p: 4, maxWidth: 450, width: '100%', borderRadius: 2 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
            <School sx={{ fontSize: 40, color: '#1976d2', mr: 1 }} />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
              SkillSwap
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ color: '#666', mb: 1 }}>
            Welcome Back!
          </Typography>
          <Typography variant="body2" sx={{ color: '#888' }}>
            Connect with fellow learners and share your skills
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!forgotPassword ? (
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <Button type="submit" variant="contained" color="primary" fullWidth disabled={loading} sx={{ py: 1.5, fontSize: '1.1rem' }}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleForgotPassword} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" align="center" gutterBottom>
              Reset Password
            </Typography>
            <Typography variant="body2" align="center" sx={{ mb: 2, color: '#666' }}>
              Enter your email address and we'll help you reset your password.
            </Typography>
            <TextField
              label="Email Address"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <Button type="submit" variant="contained" color="primary" fullWidth sx={{ py: 1.5 }}>
              Send Reset Link
            </Button>
            <Button onClick={() => setForgotPassword(false)} variant="text" fullWidth>
              Back to Login
            </Button>
          </Box>
        )}

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          {!forgotPassword && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              <Link component="button" variant="body2" onClick={() => setForgotPassword(true)} sx={{ cursor: 'pointer' }}>
                Forgot your password?
              </Link>
            </Typography>
          )}
          <Typography variant="body2">
            Don't have an account?{' '}
            <Link component={RouterLink} to="/register" sx={{ fontWeight: 'bold' }}>
              Sign up here
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default Login;