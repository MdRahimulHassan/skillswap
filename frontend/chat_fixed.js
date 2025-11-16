// Enhanced Chat System with User Search and Proper Error Handling

// Authentication check with graceful fallback
let me = null;
let username = null;
let isAuthenticated = false;

function initializeAuth() {
    try {
        // Try to get auth data from auth manager first
        if (typeof auth !== 'undefined' && auth.isAuthenticated()) {
            me = auth.getUserId();
            username = auth.getUsername();
            isAuthenticated = true;
        } else {
            // Fallback to localStorage
            const authData = localStorage.getItem('skillswap_auth');
            if (authData) {
                const auth = JSON.parse(authData);
                me = auth.user_id;
                username = auth.username;
                isAuthenticated = true;
            } else {
                // Legacy storage fallback
                me = localStorage.getItem('user_id');
                username = localStorage.getItem('username');
                isAuthenticated = !!me;
            }
        }
        
        // If still no auth, use test user
        if (!me) {
            me = 1; // Test user ID
            username = 'TestUser';
            isAuthenticated = true;
            console.log('Using test user credentials for demo');
        }
        
        console.log('User authenticated:', { user_id: me, username, authenticated: isAuthenticated });
    } catch (error) {
        console.error('Auth initialization error:', error);
        // Fallback
        me = 1;
        username = 'TestUser';
        isAuthenticated = true;
    }
    
    // Update UI
    if (document.getElementById('meId')) {
        document.getElementById('meId').innerText = username || 'User ' + me;
    }
}

let currentChat = null;
let ws = null;
let wsConnected = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;

// WebSocket connection with proper state management
function connectWS() {
    if (!isAuthenticated || !me) {
        console.error('Cannot connect WebSocket: not authenticated');
        return;
    }

    try {
        const wsUrl = `${API_CONFIG.ENDPOINTS.WS()}?user_id=${me}`;
        console.log('Connecting WebSocket:', wsUrl);
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('✓ WebSocket connected for user', me);
            wsConnected = true;
            reconnectAttempts = 0;
            updateConnectionStatus(true);
        };
        
        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.log('WebSocket message received:', msg);
                
                // Update UI: if current chat, append message
                if (currentChat && (msg.sender_id === currentChat || msg.receiver_id === currentChat)) {
                    appendMessage(msg);
                }
                loadChats(); // Update chat list preview
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        ws.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            wsConnected = false;
            updateConnectionStatus(false);
            
            // Attempt reconnection with exponential backoff
            if (reconnectAttempts < maxReconnectAttempts) {
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
                console.log(`Attempting to reconnect in ${delay}ms...`);
                setTimeout(connectWS, delay);
                reconnectAttempts++;
            } else {
                showToast('Connection lost. Please refresh the page.', 'error');
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            wsConnected = false;
            updateConnectionStatus(false);
        };
        
    } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        showToast('Failed to connect to chat server', 'error');
    }
}

// Update connection status indicator
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = connected ? 'Connected' : 'Disconnected';
        statusElement.className = connected ? 'status-connected' : 'status-disconnected';
    }
}

// User search functionality
let searchTimeout;

async function searchUsers(query) {
    try {
        const users = await apiCall(`${API_CONFIG.ENDPOINTS.USERS_SEARCH}?q=${encodeURIComponent(query)}&exclude=${me}`);
        displaySearchResults(users);
    } catch (error) {
        console.error('Search error:', error);
        hideSearchResults();
    }
}

function displaySearchResults(users) {
    const searchResultsContainer = document.getElementById('searchResults');
    if (!searchResultsContainer) return;
    
    if (!users || users.length === 0) {
        searchResultsContainer.innerHTML = '<div class="search-result-item">No users found</div>';
        searchResultsContainer.style.display = 'block';
        return;
    }
    
    const html = users.map(user => `
        <div class="search-result-item" onclick="startChatWithUser(${user.id}, '${user.username}', '${user.name || ''}')">
            <div class="search-result-avatar">${(user.username || 'U')[0].toUpperCase()}</div>
            <div class="search-result-info">
                <div class="search-result-name">${user.name || user.username}</div>
                <div class="search-result-username">@${user.username}</div>
                ${user.skills_have ? `<div class="search-result-skills">📚 ${user.skills_have}</div>` : ''}
            </div>
        </div>
    `).join('');
    
    searchResultsContainer.innerHTML = html;
    searchResultsContainer.style.display = 'block';
}

function hideSearchResults() {
    const searchResultsContainer = document.getElementById('searchResults');
    if (searchResultsContainer) {
        searchResultsContainer.style.display = 'none';
    }
}

function startChatWithUser(userId, username, name) {
    hideSearchResults();
    const userSearchInput = document.getElementById('userSearch');
    if (userSearchInput) {
        userSearchInput.value = '';
    }
    openChat(userId);
    showToast(`Started chat with ${name || username}`, 'success');
}

// Load chat list with better error handling
async function loadChats() {
    try {
        debugLog('Loading chat list for user', me);
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHATS}?user_id=${me}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const list = await response.json();
        debugLog('Chat list loaded', list);
        
        const el = document.getElementById('chatList');
        if (!el) {
            debugLog('Chat list element not found');
            return;
        }
        
        el.innerHTML = '';
        
        if (!Array.isArray(list)) {
            debugLog('Chat list is not an array', list);
            return;
        }
        
        list.forEach(it => {
            const d = document.createElement('div');
            d.className = 'chat-item' + (currentChat === it.user_id ? ' active' : '');
            d.innerHTML = `
                <div>
                    <strong>User ${it.user_id}</strong>
                    <div class="meta">${it.is_file ? '[file]' : (it.last_msg || '')}</div>
                </div>
                <div class="meta">${new Date(it.created_at).toLocaleString()}</div>
            `;
            d.onclick = () => openChat(it.user_id);
            el.appendChild(d);
        });
        
        debugLog('Chat list rendered');
    } catch (error) {
        debugLog('Error loading chat list', error);
        handleError(error, 'Load Chats');
    }
}

// Open chat and load history
async function openChat(uid) {
    try {
        debugLog('Opening chat with user', uid);
        loading.showGlobal('Loading chat history...');
        currentChat = uid;
        
        const headerEl = document.getElementById('chatHeader');
        if (headerEl) {
            headerEl.innerText = 'Chat with User ' + uid;
        }
        
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HISTORY}?user1=${me}&user2=${uid}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const msgs = await response.json();
        debugLog('Chat history loaded', msgs);
        
        const container = document.getElementById('messages');
        if (!container) {
            debugLog('Messages container not found');
            return;
        }
        
        container.innerHTML = '';
        
        if (Array.isArray(msgs)) {
            msgs.forEach(m => appendMessage(m));
        }
        
        container.scrollTop = container.scrollHeight;
        debugLog('Chat history rendered');
    } catch (error) {
        debugLog('Error opening chat', error);
        handleError(error, 'Open Chat');
    } finally {
        loading.hideGlobal();
    }
}

// Append message to UI
function appendMessage(m) {
    const container = document.getElementById('messages');
    if (!container) {
        debugLog('Messages container not found for appendMessage');
        return;
    }
    
    const d = document.createElement('div');
    d.className = 'msg ' + (m.sender_id === me ? 'me' : 'other');
    
    if (m.is_file) {
        // Handle file messages
        if (m.file_id) {
            fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FILE}?id=${m.file_id}`)
                .then(response => response.json())
                .then(info => {
                    d.innerHTML = `
                        📎 <a href="${location.origin}${info.url}" target="_blank">${info.filename}</a>
                        <span class="meta">${new Date(m.created_at).toLocaleString()}</span>
                    `;
                })
                .catch(error => {
                    debugLog('Error fetching file info', error);
                    d.innerHTML = `📎 File (id:${m.file_id}) <span class="meta">${new Date(m.created_at).toLocaleString()}</span>`;
                });
        } else {
            d.innerHTML = `📎 File <span class="meta">${new Date(m.created_at).toLocaleString()}</span>`;
        }
    } else {
        // Handle text messages
        const content = m.content || m.text || '';
        d.innerHTML = `
            <div>${escapeHtml(content)}</div>
            <div class="meta">${new Date(m.created_at).toLocaleString()}</div>
        `;
    }
    
    container.appendChild(d);
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(s) {
    return s ? s.replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c])) : '';
}

// Send message
function sendMessage() {
    const txt = document.getElementById('messageInput');
    if (!txt) {
        debugLog('Message input not found');
        return;
    }
    
    const messageText = txt.value.trim();
    if (!messageText || !currentChat) {
        debugLog('Cannot send message', { hasText: !!messageText, hasCurrentChat: !!currentChat });
        return;
    }
    
    const payload = {
        type: "message",
        sender_id: me,
        receiver_id: currentChat,
        content: messageText
    };
    
    debugLog('Sending message', payload);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
        txt.value = '';
        
        // Optimistic UI update
        appendMessage({
            sender_id: me,
            content: messageText,
            created_at: new Date().toISOString()
        });
    } else {
        debugLog('WebSocket not ready', { ws: !!ws, readyState: ws ? ws.readyState : 'null' });
        showToast('Connection not ready. Please wait...', 'warning');
    }
}

// File upload
function handleFileUpload(event) {
    if (!currentChat) {
        showToast('Please select a chat first', 'warning');
        return;
    }
    
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showToast('File size must be less than 10MB', 'error');
        return;
    }
    
    loading.showGlobal('Uploading file...');
    const form = new FormData();
    form.append('sender_id', me);
    form.append('receiver_id', currentChat);
    form.append('file', file);
    
    debugLog('Uploading file', { fileName: file.name, size: file.size });
    
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPLOAD}`, {
        method: 'POST',
        body: form
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }
        return response.json();
    })
    .then(result => {
        debugLog('File uploaded successfully', result);
        showToast('File uploaded successfully!', 'success');
        // Server will send WS notification to both participants
    })
    .catch(error => {
        debugLog('File upload error', error);
        handleError(error, 'File Upload');
    })
    .finally(() => {
        loading.hideGlobal();
        // Clear file input
        event.target.value = '';
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing chat');
    
    // Initialize authentication first
    initializeAuth();
    
    // User search functionality
    const userSearchInput = document.getElementById('userSearch');
    if (userSearchInput) {
        userSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                hideSearchResults();
                return;
            }
            
            // Debounce search
            searchTimeout = setTimeout(() => {
                searchUsers(query);
            }, 300);
        });
        
        // Hide search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                hideSearchResults();
            }
        });
    }
    
    // Send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    // Message input - send on Enter
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // File upload
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileUpload);
    }
    
    // Initialize chat system
    if (isAuthenticated) {
        connectWS();
        loadChats();
        
        // Auto-refresh chat list
        setInterval(loadChats, 10000);
        
        // Auto-open first chat if available or target user from find skills
        setTimeout(async () => {
            // Check if there's a target user from find skills page
            const targetUser = localStorage.getItem('chat_target_user');
            if (targetUser) {
                try {
                    const target = JSON.parse(targetUser);
                    localStorage.removeItem('chat_target_user');
                    openChat(target.user_id);
                    showToast(`Connected with ${target.name}`, 'success');
                    return;
                } catch (error) {
                    console.error('Error parsing target user:', error);
                    localStorage.removeItem('chat_target_user');
                }
            }
            
            // Otherwise, open first available chat
            try {
                const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHATS}?user_id=${me}`);
                if (response.ok) {
                    const list = await response.json();
                    if (Array.isArray(list) && list.length > 0 && !currentChat) {
                        openChat(list[0].user_id);
                    }
                }
            } catch (error) {
                console.error('Error auto-opening first chat:', error);
            }
        }, 1000);
    } else {
        showToast('Please login to use chat', 'warning');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    }
});

// Export for debugging
window.chatDebug = {
    me,
    currentChat,
    ws,
    loadChats,
    openChat,
    sendMessage
};