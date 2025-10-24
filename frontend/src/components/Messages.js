import React, { useState, useEffect } from 'react';
import { Typography, Box, Paper, TextField, Button, Avatar, Grid, List, ListItem, ListItemAvatar, ListItemText, Divider, IconButton, InputAdornment } from '@mui/material';
import { Send, Search, MoreVert } from '@mui/icons-material';

function Messages() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Mock data for conversations
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
    if (mockConversations.length > 0) {
      setSelectedConversation(mockConversations[0]);
    }
  }, []);

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim() && selectedConversation) {
      const message = {
        id: Date.now(),
        text: newMessage,
        sender: 'You',
        timestamp: new Date().toISOString()
      };

      const updatedConversations = conversations.map(conv => {
        if (conv.id === selectedConversation.id) {
          return {
            ...conv,
            messages: [...conv.messages, message],
            lastMessage: newMessage,
            timestamp: new Date().toISOString(),
            unread: 0
          };
        }
        return conv;
      });

      setConversations(updatedConversations);
      setSelectedConversation(prev => ({
        ...prev,
        messages: [...prev.messages, message],
        lastMessage: newMessage,
        timestamp: new Date().toISOString(),
        unread: 0
      }));
      setNewMessage('');
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ height: 'calc(100vh - 200px)' }}>
      <Typography variant="h4" component="h1" gutterBottom className="page-title">
        Messages
      </Typography>

      <Grid container sx={{ height: 'calc(100vh - 280px)' }}>
        {/* Conversations List */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <List sx={{ flexGrow: 1, overflow: 'auto' }}>
              {filteredConversations.map((conversation) => (
                <React.Fragment key={conversation.id}>
                  <ListItem
                    button
                    selected={selectedConversation?.id === conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    sx={{ py: 1.5 }}
                  >
                    <ListItemAvatar>
                      <Avatar style={{ backgroundColor: '#1976d2' }}>
                        {getInitials(conversation.user.name)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: conversation.unread > 0 ? 'bold' : 'normal' }}>
                            {conversation.user.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatTime(conversation.timestamp)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontWeight: conversation.unread > 0 ? 'bold' : 'normal'
                            }}
                          >
                            {conversation.lastMessage}
                          </Typography>
                          {conversation.unread > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                              <Typography
                                variant="caption"
                                sx={{
                                  backgroundColor: '#1976d2',
                                  color: 'white',
                                  px: 1,
                                  py: 0.2,
                                  borderRadius: 10,
                                  fontSize: '0.7rem'
                                }}
                              >
                                {conversation.unread}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Chat Area */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ mr: 2 }} style={{ backgroundColor: '#1976d2' }}>
                    {getInitials(selectedConversation.user.name)}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6">{selectedConversation.user.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {selectedConversation.user.email}
                    </Typography>
                  </Box>
                  <IconButton>
                    <MoreVert />
                  </IconButton>
                </Box>

                {/* Messages */}
                <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column' }}>
                  {selectedConversation.messages.map((message) => (
                    <Box
                      key={message.id}
                      sx={{
                        mb: 1,
                        alignSelf: message.sender === 'You' ? 'flex-end' : 'flex-start',
                        maxWidth: '70%'
                      }}
                    >
                      <Paper
                        sx={{
                          p: 1.5,
                          backgroundColor: message.sender === 'You' ? '#1976d2' : '#f5f5f5',
                          color: message.sender === 'You' ? 'white' : 'text.primary'
                        }}
                      >
                        <Typography variant="body2">{message.text}</Typography>
                      </Paper>
                      <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, ml: 1 }}>
                        {formatTime(message.timestamp)}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {/* Message Input */}
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      sx={{ minWidth: 48, height: 40 }}
                    >
                      <Send />
                    </Button>
                  </Box>
                </Box>
              </>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="h6" color="textSecondary">
                  Select a conversation to start messaging
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Messages;