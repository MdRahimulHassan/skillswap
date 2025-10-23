import React from 'react';
import { Typography, Box, Paper, Alert } from '@mui/material';

function Messages() {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom className="page-title">
        Messages
      </Typography>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Messaging Feature
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Connect with your skill swap partners through our messaging system.
        </Typography>
        <Alert severity="info">
          This feature is currently under development. Check back soon!
        </Alert>
      </Paper>
    </Box>
  );
}

export default Messages;