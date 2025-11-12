import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Badge,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  School,
  Notifications,
  AccountCircle,
  ExitToApp,
  Settings,
  Person,
  Chat,
   Group,
} from '@mui/icons-material'; 

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [user, setUser] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications] = useState(3); // Mock notification count

  useEffect(() => {
    if (token) {
      fetchUserProfile();
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUser(data);
    } catch (err) {
      console.error('Failed to fetch user profile');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
    handleClose();
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const getInitials = (name) => {
    return name ? name.split(' ').map((n) => n[0]).join('').toUpperCase() : 'U';
  };

  return (
    <AppBar position="static" elevation={2} sx={{ backgroundColor: '#1976d2' }}>
      <Toolbar>
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <School sx={{ mr: 1, fontSize: 32 }} />
          <Typography
            variant="h6"
            component={Link}
            to="/profile"
            sx={{
              textDecoration: 'none',
              color: 'inherit',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            SkillSwap
          </Typography>
        </Box>

        {token && (
          <>
            {/* Desktop Navigation */}
            {!isMobile && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
               <Button color="inherit" component={Link} to="/matches" startIcon={<Group />}>
  Matches
</Button>

                <Button color="inherit" component={Link} to="/messages" startIcon={<Chat />}>
                  {/* ✅ Changed Notifications → Chat */}
                  Messages
                </Button>
                <Button color="inherit" component={Link} to="/admin" startIcon={<Settings />}>
                  Admin
                </Button>

                {/* Notifications */}
                <IconButton color="inherit" sx={{ mr: 1 }}>
                  <Badge badgeContent={notifications} color="error">
                    <Notifications />
                  </Badge>
                </IconButton>

                {/* User Menu */}
                <IconButton
                  size="large"
                  edge="end"
                  aria-label="account of current user"
                  aria-controls="primary-search-account-menu"
                  aria-haspopup="true"
                  onClick={handleProfileMenuOpen}
                  color="inherit"
                >
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.2)' }}>
                    {getInitials(user.name)}
                  </Avatar>
                </IconButton>
              </Box>
            )}

            {/* Mobile Navigation */}
            {isMobile && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton color="inherit" component={Link} to="/matches">
  <Group />
</IconButton>

                <IconButton color="inherit" component={Link} to="/messages">
                  {/* ✅ Changed to Chat icon */}
                  <Badge badgeContent={notifications} color="error">
                    <Chat />
                  </Badge>
                </IconButton>
                <IconButton
                  size="large"
                  edge="end"
                  aria-label="account of current user"
                  aria-controls="primary-search-account-menu"
                  aria-haspopup="true"
                  onClick={handleProfileMenuOpen}
                  color="inherit"
                >
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.2)' }}>
                    {getInitials(user.name)}
                  </Avatar>
                </IconButton>
              </Box>
            )}

            {/* User Dropdown Menu */}
            <Menu
              id="primary-search-account-menu"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem component={Link} to="/profile" onClick={handleClose}>
                <Person sx={{ mr: 1 }} />
                Profile
              </MenuItem>
              <MenuItem component={Link} to="/admin" onClick={handleClose}>
                <Settings sx={{ mr: 1 }} />
                Admin Panel
              </MenuItem>
              <MenuItem onClick={logout}>
                <ExitToApp sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
