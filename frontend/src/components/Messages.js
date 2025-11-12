import React, { useState, useEffect } from 'react';

function Messages() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [selectedNav, setSelectedNav] = useState('Message');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const mockConversations = [
      {
        id: 1,
        user: { name: 'Courtney Henry' },
        lastMessage: 'What time do you close?',
        timestamp: new Date().toISOString(),
        unread: 1,
        status: 'Just now',
        messages: []
      },
      {
        id: 2,
        user: { name: 'Kristin Watson' },
        lastMessage: 'thank you for the reminder!',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        unread: 1,
        status: '1 min ago',
        messages: []
      },
      {
        id: 3,
        user: { name: 'Ronald Richards' },
        lastMessage: 'I wanted to let you know that..',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        unread: 1,
        status: '2 min ago',
        messages: []
      },
      {
        id: 4,
        user: { name: 'Brooklyn Simmons' },
        lastMessage: 'typing...',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        unread: 0,
        status: '3 min ago',
        typing: true,
        messages: [
          { id: 1, text: 'Hi Dr. Alex, thank you for the reminder! I\'ll be there at 8:30am Let me know if I need to bring anything specific.*', sender: 'Brooklyn Simmons', timestamp: new Date(Date.now() - 300000).toISOString() },
          { id: 2, text: 'I wanted to let you know that we\'ve received your lab results. preventive measures during our next appointment.*', sender: 'Brooklyn Simmons', timestamp: new Date(Date.now() - 240000).toISOString() },
          { id: 3, text: 'Hi Brooklyn Simmons, I wanted to let you know that we\'ve received your lab results. Everything looks good, but I\'d like to discuss a few preventive measures during our next appointment.*', sender: 'You', timestamp: new Date(Date.now() - 120000).toISOString() },
          { id: 4, text: 'Thank you, Dr. Alex I appreciate the update. Can I schedule a time to discuss it?*', sender: 'Brooklyn Simmons', timestamp: new Date(Date.now() - 180000).toISOString() }
        ]
      },
      {
        id: 5,
        user: { name: 'Robert Fox' },
        lastMessage: 'I wanted to let you know that..',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        unread: 0,
        status: 'Yesterday',
        messages: []
      }
    ];
    setConversations(mockConversations);
    setSelectedConversation(mockConversations[3]);
  }, []);

  const navigationItems = [
    { icon: '🏠', label: 'Dashboard' },
    { icon: '👥', label: 'Patients' },
    { icon: '💬', label: 'Message' },
    { icon: '📅', label: 'Scheduling' },
    { icon: '👨‍👩‍👧‍👦', label: 'Teams' },
    { icon: '📄', label: 'Medical Records' },
    { icon: '📊', label: 'Reports' },
    { icon: '💳', label: 'Billing & Payments' }
  ];

  const bottomNavItems = [
    { icon: '❓', label: 'Help' },
    { icon: '🔔', label: 'Notification' },
    { icon: '⚙️', label: 'Settings' }
  ];

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        ? { ...c, messages: [...c.messages, message], lastMessage: newMessage }
        : c
    );
    setConversations(updatedConversations);
    setSelectedConversation(prev => ({
      ...prev,
      messages: [...prev.messages, message]
    }));
    setNewMessage('');
  };

  const filteredConversations = activeTab === 0 
    ? conversations.filter(c => c.unread > 0 || c.typing)
    : conversations.filter(c => c.unread === 0 && !c.typing);

  const searchFilteredConversations = filteredConversations.filter(c =>
    c.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={styles.container}>
      {/* Left Sidebar Navigation */}
      {!isMobile && (
        <div style={styles.sidebar}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>+</div>
            <div style={styles.logoText}>MedTrackr</div>
          </div>

          <div style={styles.navSection}>
            {navigationItems.map((item) => (
              <div
                key={item.label}
                onClick={() => setSelectedNav(item.label)}
                style={{
                  ...styles.navItem,
                  ...(selectedNav === item.label ? styles.navItemActive : {})
                }}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span style={styles.navLabel}>{item.label}</span>
              </div>
            ))}
          </div>

          <div style={styles.bottomNav}>
            {bottomNavItems.map((item) => (
              <div key={item.label} style={styles.navItem}>
                <span style={styles.navIcon}>{item.icon}</span>
                <span style={styles.navLabel}>{item.label}</span>
              </div>
            ))}
          </div>

          <div style={styles.userProfile}>
            <div style={styles.avatar}>TW</div>
            <div style={{flex: 1}}>
              <div style={styles.userName}>Theresa Webb</div>
              <div style={styles.userRole}>Admin</div>
            </div>
            <span style={styles.settingsIcon}>⚙️</span>
          </div>
        </div>
      )}

      {/* Messages Section */}
      <div style={styles.messagesContainer}>
        {/* Conversations List */}
        {(!isMobile || !selectedConversation) && (
          <div style={styles.conversationsList}>
            <div style={styles.conversationsHeader}>
              <div style={styles.headerTop}>
                <h2 style={styles.title}>Messages</h2>
                <button style={styles.iconButton}>⋮</button>
              </div>

              <div style={styles.searchContainer}>
                <input
                  type="text"
                  placeholder="Search patients"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.searchInput}
                />
                <span style={styles.filterIcon}>⚙</span>
              </div>

              <div style={styles.tabs}>
                <button
                  onClick={() => setActiveTab(0)}
                  style={{...styles.tab, ...(activeTab === 0 ? styles.tabActive : {})}}
                >
                  Active
                </button>
                <button
                  onClick={() => setActiveTab(1)}
                  style={{...styles.tab, ...(activeTab === 1 ? styles.tabActive : {})}}
                >
                  Inactive
                </button>
              </div>
            </div>

            <div style={styles.conversationsScroll}>
              {searchFilteredConversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  style={{
                    ...styles.conversationItem,
                    ...(selectedConversation?.id === conv.id ? styles.conversationItemActive : {})
                  }}
                >
                  <div style={styles.conversationAvatar}>
                    {getInitials(conv.user.name)}
                  </div>
                  <div style={styles.conversationContent}>
                    <div style={styles.conversationTop}>
                      <span style={styles.conversationName}>{conv.user.name}</span>
                      <span style={styles.conversationTime}>{conv.status}</span>
                    </div>
                    <div style={styles.conversationBottom}>
                      <span style={{
                        ...styles.conversationMessage,
                        ...(conv.typing ? {color: '#4C6FFF', fontStyle: 'italic'} : {})
                      }}>
                        {conv.lastMessage}
                      </span>
                      {conv.unread > 0 && <div style={styles.unreadDot} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Area */}
        {(!isMobile || selectedConversation) && (
          <div style={styles.chatArea}>
            {selectedConversation ? (
              <>
                <div style={styles.chatHeader}>
                  {isMobile && (
                    <button
                      onClick={() => setSelectedConversation(null)}
                      style={styles.backButton}
                    >
                      ←
                    </button>
                  )}
                  <div style={styles.chatHeaderAvatar}>
                    {getInitials(selectedConversation.user.name)}
                  </div>
                  <div style={{flex: 1}}>
                    <div style={{display: 'flex', alignItems: 'center'}}>
                      <span style={styles.chatHeaderName}>{selectedConversation.user.name}</span>
                      <span style={styles.visitBadge}>Visit 2</span>
                    </div>
                    <div style={styles.chatHeaderSubtext}>Last visit Sep 16, 2024</div>
                  </div>
                  <button style={styles.iconButton}>⋮</button>
                </div>

                <div style={styles.messagesArea}>
                  <div style={styles.dateBadge}>Today, Nov 16</div>

                  {selectedConversation.messages.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        ...styles.messageWrapper,
                        ...(msg.sender === 'You' ? {flexDirection: 'row-reverse'} : {})
                      }}
                    >
                      {msg.sender !== 'You' && (
                        <div style={styles.messageAvatar}>
                          {getInitials(msg.sender)}
                        </div>
                      )}
                      <div style={{maxWidth: '70%'}}>
                        {msg.sender !== 'You' && (
                          <div style={styles.messageHeader}>
                            <span style={styles.messageSender}>{msg.sender}</span>
                            <span style={styles.messageTime}>{formatTime(msg.timestamp)}</span>
                          </div>
                        )}
                        <div
                          style={{
                            ...styles.messageBubble,
                            ...(msg.sender === 'You' ? styles.messageBubbleYou : styles.messageBubbleThem)
                          }}
                        >
                          {msg.text}
                        </div>
                        {msg.sender === 'You' && (
                          <div style={styles.messageFooter}>
                            <span style={styles.messageTime}>{formatTime(msg.timestamp)}</span>
                            <span style={styles.messageSender}>You</span>
                            <div style={styles.messageAvatarSmall}>DA</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <div style={styles.newMessageDivider}>
                    <div style={styles.dividerLine} />
                    <span style={styles.dividerText}>New Message</span>
                    <div style={styles.dividerLine} />
                  </div>
                </div>

                <div style={styles.inputArea}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    style={styles.messageInput}
                  />
                  <div style={styles.inputActions}>
                    <button style={styles.actionButton}>😊</button>
                    <button style={styles.actionButton}>📎</button>
                    <button style={styles.actionButton}>🖼️</button>
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      style={{
                        ...styles.sendButton,
                        ...(newMessage.trim() ? {} : styles.sendButtonDisabled)
                      }}
                    >
                      ✈️
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={styles.emptyState}>
                Select a conversation to start chatting
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  sidebar: {
    width: 280,
    backgroundColor: 'white',
    borderRight: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: 'column',
    padding: 16
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 24,
    paddingLeft: 8
  },
  logoIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#4C6FFF',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: 24,
    fontWeight: 700,
    marginRight: 12
  },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1a1a1a'
  },
  navSection: {
    flex: 1
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    marginBottom: 4,
    borderRadius: 8,
    cursor: 'pointer',
    color: '#666',
    transition: 'all 0.2s'
  },
  navItemActive: {
    backgroundColor: '#f0f4ff',
    color: '#4C6FFF',
    fontWeight: 600
  },
  navIcon: {
    marginRight: 16,
    fontSize: 20
  },
  navLabel: {
    fontSize: 15
  },
  bottomNav: {
    borderTop: '1px solid #e0e0e0',
    paddingTop: 16
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    cursor: 'pointer'
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    backgroundColor: '#E8EFFE',
    color: '#4C6FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    marginRight: 12
  },
  userName: {
    fontSize: 14,
    fontWeight: 600
  },
  userRole: {
    fontSize: 12,
    color: '#999'
  },
  settingsIcon: {
    fontSize: 18,
    color: '#999'
  },
  messagesContainer: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  },
  conversationsList: {
    width: 380,
    backgroundColor: 'white',
    borderRight: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: 'column'
  },
  conversationsHeader: {
    padding: 24,
    paddingBottom: 16
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0
  },
  iconButton: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    color: '#666'
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 16
  },
  searchInput: {
    width: '100%',
    padding: '10px 40px 10px 12px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#f9f9f9',
    fontSize: 14,
    outline: 'none'
  },
  filterIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 18,
    color: '#666'
  },
  tabs: {
    display: 'flex',
    borderBottom: '2px solid #e0e0e0',
    marginTop: 16
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    background: 'none',
    border: 'none',
    fontSize: 14,
    fontWeight: 500,
    color: '#666',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: -2
  },
  tabActive: {
    color: '#1a1a1a',
    fontWeight: 600,
    borderBottom: '2px solid #4C6FFF'
  },
  conversationsScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: 8
  },
  conversationItem: {
    display: 'flex',
    padding: 12,
    marginBottom: 4,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  conversationItemActive: {
    backgroundColor: '#f9f9f9'
  },
  conversationAvatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    backgroundColor: '#E8EFFE',
    color: '#4C6FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    marginRight: 12,
    flexShrink: 0
  },
  conversationContent: {
    flex: 1,
    minWidth: 0
  },
  conversationTop: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  conversationName: {
    fontWeight: 600,
    fontSize: 15
  },
  conversationTime: {
    fontSize: 12,
    color: '#999'
  },
  conversationBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  conversationMessage: {
    fontSize: 13,
    color: '#666',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 200
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#4C6FFF',
    marginLeft: 8
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white'
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #e0e0e0'
  },
  backButton: {
    background: 'none',
    border: 'none',
    fontSize: 24,
    cursor: 'pointer',
    marginRight: 12,
    color: '#666'
  },
  chatHeaderAvatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: '#E8EFFE',
    color: '#4C6FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    marginRight: 16
  },
  chatHeaderName: {
    fontWeight: 600,
    fontSize: 16,
    marginRight: 8
  },
  visitBadge: {
    padding: '2px 8px',
    backgroundColor: '#E8F5FF',
    color: '#0088FF',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600
  },
  chatHeaderSubtext: {
    fontSize: 13,
    color: '#999'
  },
  messagesArea: {
    flex: 1,
    padding: 24,
    overflowY: 'auto',
    backgroundColor: '#fafafa'
  },
  dateBadge: {
    textAlign: 'center',
    marginBottom: 24
  },
  dateText: {
    display: 'inline-block',
    padding: '6px 16px',
    backgroundColor: '#2D3648',
    color: 'white',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500
  },
  messageWrapper: {
    display: 'flex',
    marginBottom: 24,
    alignItems: 'flex-start'
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: '#E8EFFE',
    color: '#4C6FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: 14,
    marginRight: 12,
    flexShrink: 0
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 4
  },
  messageSender: {
    fontSize: 14,
    fontWeight: 600,
    marginRight: 8
  },
  messageTime: {
    fontSize: 12,
    color: '#999'
  },
  messageBubble: {
    padding: 16,
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 1.6
  },
  messageBubbleThem: {
    backgroundColor: '#f0f0f0',
    color: '#1a1a1a',
    borderTopLeftRadius: 0
  },
  messageBubbleYou: {
    backgroundColor: '#4C6FFF',
    color: 'white',
    borderTopRightRadius: 0
  },
  messageFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 8
  },
  messageAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    backgroundColor: '#E8EFFE',
    color: '#4C6FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 600
  },
  newMessageDivider: {
    display: 'flex',
    alignItems: 'center',
    margin: '24px 0'
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FF6B6B'
  },
  dividerText: {
    margin: '0 16px',
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: 500
  },
  inputArea: {
    padding: 16,
    borderTop: '1px solid #e0e0e0',
    display: 'flex',
    alignItems: 'center'
  },
  messageInput: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 12,
    border: 'none',
    backgroundColor: '#f9f9f9',
    fontSize: 14,
    outline: 'none',
    marginRight: 8
  },
  inputActions: {
    display: 'flex',
    gap: 8
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 18,
    color: '#666'
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#4C6FFF',
    color: 'white',
    cursor: 'pointer',
    fontSize: 16
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed'
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    backgroundColor: '#fafafa'
  }
};

export default Messages;