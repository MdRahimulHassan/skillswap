import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Paper, TextField, Button, Avatar, Grid,
  List, ListItem, ListItemAvatar, ListItemText, IconButton,
  InputAdornment, Divider
} from '@mui/material';
import { Send, Search, MoreVert } from '@mui/icons-material';

function Messages() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const mockConversations = [
      {
        id: 1,
        user: { name: 'Alice Johnson', email: 'alice@example.com' },
        lastMessage: 'Hey! I saw you teach React. I\'d love to learn more about it.',
        timestamp: '2024-01-15T10:30:00Z',
        unread: 2,
        messages: [
          { id: 1, text: 'Hi! I\'m interested in learning React.', sender: 'Alice Johnson', timestamp: '2024-01-15T10:00:00Z' },
          { id: 2, text: 'Great! I\'d be happy to help you learn React.', sender: 'You', timestamp: '2024-01-15T10:15:00Z' },
          { id: 3, text: 'Hey! I saw you teach React. I\'d love to learn more about it.', sender: 'Alice Johnson', timestamp: '2024-01-15T10:30:00Z' }
        ]
      },
      {
        id: 2,
        user: { name: 'Bob Smith', email: 'bob@example.com' },
        lastMessage: 'Thanks for the Python tips! Really helpful.',
        timestamp: '2024-01-14T16:45:00Z',
        unread: 0,
        messages: [
          { id: 1, text: 'Hi! I need help with Python basics.', sender: 'Bob Smith', timestamp: '2024-01-14T16:00:00Z' },
          { id: 2, text: 'Sure! Let me share some resources with you.', sender: 'You', timestamp: '2024-01-14T16:30:00Z' },
          { id: 3, text: 'Thanks for the Python tips! Really helpful.', sender: 'Bob Smith', timestamp: '2024-01-14T16:45:00Z' }
        ]
      }
    ];
    setConversations(mockConversations);
    setSelectedConversation(mockConversations[0]);
  }, []);

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = (now - date) / (1000 * 60 * 60);
    return diff < 24
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    const message = {
      id: Date.now(),
      text: newMessage,
      sender: 'You',
      timestamp: new Date().toISOString()
    };

    const updatedConversations = conversations.map(c =>
      c.id === selectedConversation.id
        ? { ...c, messages: [...c.messages, message], lastMessage: newMessage, timestamp: new Date().toISOString(), unread: 0 }
        : c
    );
    setConversations(updatedConversations);
    setSelectedConversation(prev => ({
      ...prev,
      messages: [...prev.messages, message],
      lastMessage: newMessage,
      timestamp: new Date().toISOString(),
      unread: 0
    }));
    setNewMessage('');
  };

  const filteredConversations = conversations.filter(c =>
    c.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{
      display: 'flex',
      height: 'calc(100vh - 100px)',
      backgroundColor: '#f0f2f5',
      borderRadius: 2,
      overflow: 'hidden'
    }}>
      {/* Left Sidebar (Chats List) */}
      <Paper
        elevation={1}
        sx={{
          width: { xs: '100%', md: '30%' },
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #e0e0e0'
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid #ddd' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search Messenger"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
              sx: { borderRadius: 5, backgroundColor: '#f5f6f7' }
            }}
          />
        </Box>

        <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
          {filteredConversations.map(conv => (
            <ListItem
              key={conv.id}
              button
              selected={selectedConversation?.id === conv.id}
              onClick={() => setSelectedConversation(conv)}
              sx={{
                px: 2,
                py: 1.5,
                backgroundColor:
                  selectedConversation?.id === conv.id ? '#e7f3ff' : 'inherit',
                '&:hover': { backgroundColor: '#f0f2f5' },
                transition: '0.2s'
              }}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: '#1877f2' }}>{getInitials(conv.user.name)}</Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontWeight: 600 }}>{conv.user.name}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {formatTime(conv.timestamp)}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {conv.lastMessage}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Chat Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedConversation ? (
          <>
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 3,
                py: 2,
                borderBottom: '1px solid #ddd',
                backgroundColor: 'white'
              }}
            >
              <Avatar sx={{ bgcolor: '#1877f2', mr: 2 }}>
                {getInitials(selectedConversation.user.name)}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {selectedConversation.user.name}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {selectedConversation.user.email}
                </Typography>
              </Box>
              <IconButton>
                <MoreVert />
              </IconButton>
            </Box>

            {/* Messages */}
            <Box
              sx={{
                flexGrow: 1,
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                background: 'linear-gradient(180deg, #f0f2f5 0%, #ffffff 100%)',
                backgroundSize: 'contain'
              }}
            >
              {selectedConversation.messages.map((msg) => (
                <Box
                  key={msg.id}
                  sx={{
                    display: 'flex',
                    flexDirection: msg.sender === 'You' ? 'row-reverse' : 'row',
                    mb: 2
                  }}
                >
                  {msg.sender !== 'You' && (
                    <Avatar sx={{ bgcolor: '#1877f2', mr: 1, alignSelf: 'flex-end' }}>
                      {getInitials(msg.sender)}
                    </Avatar>
                  )}
                  <Box
                    sx={{
                      maxWidth: '70%',
                      p: 1.5,
                      borderRadius: 3,
                      backgroundColor: msg.sender === 'You' ? '#0084ff' : '#e4e6eb',
                      color: msg.sender === 'You' ? 'white' : 'black',
                      boxShadow: 1
                    }}
                  >
                    <Typography variant="body2">{msg.text}</Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mt: 0.5,
                        textAlign: msg.sender === 'You' ? 'right' : 'left',
                        opacity: 0.7
                      }}
                    >
                      {formatTime(msg.timestamp)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            {/* Input */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 2,
                borderTop: '1px solid #ddd',
                backgroundColor: 'white'
              }}
            >
              <TextField
                fullWidth
                size="small"
                placeholder="Aa"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                sx={{
                  mr: 1,
                  '& .MuiInputBase-root': {
                    borderRadius: 5,
                    backgroundColor: '#f0f2f5'
                  }
                }}
              />
              <Button
  variant="contained"
  onClick={handleSendMessage}
  disabled={!newMessage.trim()}
  sx={{
    minWidth: 48,
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: '#1877f2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    transition: 'background-color 0.2s ease, transform 0.1s ease',
    '&:hover': {
      backgroundColor: '#166fe5',
      transform: 'scale(1.05)'
    },
    '&:disabled': {
      backgroundColor: '#cfd8e0',
      color: '#fff'
    }
  }}
>
  <Send sx={{ fontSize: 22 }} />
</Button>

            </Box>
          </>
        ) : (
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f0f2f5'
            }}
          >
            <Typography color="textSecondary">
              Select a conversation to start chatting
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default Messages;
