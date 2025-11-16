// Enhanced Chat System with User Search and Proper Error Handling

// Debug logging function
function debugLog(message, data = null) {
    if (data) {
        console.log(`[Chat Debug] ${message}:`, data);
    } else {
        console.log(`[Chat Debug] ${message}`);
    }
}

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
            
            const displayName = it.name || it.username || `User ${it.user_id}`;
            const avatarText = (it.username || 'U')[0].toUpperCase();
            const profilePhoto = it.profile_photo ? `<img src="${it.profile_photo}" alt="${displayName}" class="chat-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : '';
            const avatarFallback = `<div class="chat-avatar-fallback">${avatarText}</div>`;
            
            d.innerHTML = `
                <div class="chat-item-content">
                    <div class="chat-item-header">
                        <div class="chat-avatar-container">
                            ${profilePhoto}
                            ${avatarFallback}
                            <div class="online-status" title="Checking status..."></div>
                        </div>
                        <div class="chat-item-info">
                            <strong>${escapeHtml(displayName)}</strong>
                            <div class="chat-username">@${it.username || 'user' + it.user_id}</div>
                        </div>
                    </div>
                    <div class="chat-preview">
                        <div class="meta">${it.is_file ? '📎 File' : (it.last_msg || 'No messages yet')}</div>
                        <div class="meta">${new Date(it.created_at).toLocaleString()}</div>
                    </div>
                </div>
            `;
            d.onclick = () => openChat(it.user_id);
            el.appendChild(d);
        });
        
        debugLog('Chat list rendered');
        
        // Update online status
        updateOnlineStatus(list);
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
            // Try to get user info from the chat list first
            const chatItem = document.querySelector(`.chat-item[onclick="openChat(${uid})"]`);
            if (chatItem) {
                const userName = chatItem.querySelector('strong')?.textContent;
                headerEl.innerHTML = `
                    <div class="chat-header-info">
                        <div class="chat-header-avatar">${userName ? userName[0].toUpperCase() : 'U'}</div>
                        <div>
                            <div class="chat-header-name">${userName || 'User ' + uid}</div>
                            <div class="chat-header-status">Click to see profile</div>
                        </div>
                    </div>
                `;
            } else {
                headerEl.innerText = 'Chat with User ' + uid;
            }
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

// Update online status for chat list users
async function updateOnlineStatus(chatList) {
    try {
        if (!Array.isArray(chatList) || chatList.length === 0) return;
        
        const userIds = chatList.map(chat => chat.user_id).join(',');
        const statusData = await apiCall(`${API_CONFIG.ENDPOINTS.USERS_ONLINE}?ids=${userIds}`);
        
        // Create a map for quick lookup
        const statusMap = {};
        statusData.forEach(status => {
            statusMap[status.user_id] = status.online;
        });
        
        // Update chat list items
        chatList.forEach(chat => {
            const chatItem = document.querySelector(`.chat-item[onclick="openChat(${chat.user_id})"]`);
            if (chatItem) {
                const statusIndicator = chatItem.querySelector('.online-status');
                if (statusIndicator) {
                    const isOnline = statusMap[chat.user_id] || false;
                    statusIndicator.className = `online-status ${isOnline ? 'online' : 'offline'}`;
                    statusIndicator.title = isOnline ? 'Online' : 'Offline';
                    
                    // Add visual enhancement for online users
                    if (isOnline) {
                        chatItem.classList.add('user-online');
                        chatItem.classList.remove('user-offline');
                    } else {
                        chatItem.classList.add('user-offline');
                        chatItem.classList.remove('user-online');
                    }
                }
            }
        });
        
        // Update online users count in sidebar
        updateOnlineUsersCount(statusData);
        
    } catch (error) {
        console.error('Error updating online status:', error);
    }
}

// Update online users count in sidebar
function updateOnlineUsersCount(statusData) {
    const onlineCount = statusData.filter(status => status.online).length;
    const totalCount = statusData.length;
    
    // Update or create online status indicator in sidebar
    let statusIndicator = document.getElementById('onlineStatusIndicator');
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'onlineStatusIndicator';
        statusIndicator.className = 'online-status-indicator';
        
        // Insert after the "You:" element
        const meElement = document.getElementById('meId');
        if (meElement && meElement.parentNode) {
            meElement.parentNode.insertBefore(statusIndicator, meElement.nextSibling);
        }
    }
    
    statusIndicator.innerHTML = `
        <span class="online-dot"></span>
        <span class="online-text">${onlineCount} of ${totalCount} users online</span>
    `;
    
    // Add styles if not present
    if (!document.querySelector('#online-status-styles')) {
        const style = document.createElement('style');
        style.id = 'online-status-styles';
        style.textContent = `
            .online-status-indicator {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                color: var(--muted, #888);
                margin: 8px 0;
                padding: 4px 8px;
                background: rgba(40, 167, 69, 0.1);
                border-radius: 12px;
                border: 1px solid rgba(40, 167, 69, 0.2);
            }
            .online-dot {
                width: 8px;
                height: 8px;
                background: #28a745;
                border-radius: 50%;
                animation: pulse-green 2s infinite;
            }
            .user-online {
                border-left: 3px solid #28a745 !important;
                background: rgba(40, 167, 69, 0.02);
            }
            .user-offline {
                opacity: 0.7;
            }
            .user-online .chat-avatar-fallback {
                box-shadow: 0 0 0 2px rgba(40, 167, 69, 0.3);
            }
            @keyframes pulse-green {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }
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

// File upload with progress indicator
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
    
    debugLog('Uploading file', { fileName: file.name, size: file.size });
    
    // Create progress indicator
    const progressId = 'upload_' + Date.now();
    showUploadProgress(progressId, file.name);
    
    const form = new FormData();
    form.append('sender_id', me);
    form.append('receiver_id', currentChat);
    form.append('file', file);
    
    // Create XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            updateUploadProgress(progressId, percentComplete);
        }
    });
    
    // Handle completion
    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            try {
                const result = JSON.parse(xhr.responseText);
                debugLog('File uploaded successfully', result);
                showToast('File uploaded successfully!', 'success');
                hideUploadProgress(progressId);
                // Server will send WS notification to both participants
            } catch (error) {
                debugLog('Error parsing upload response', error);
                showToast('Upload completed but response was invalid', 'warning');
                hideUploadProgress(progressId);
            }
        } else {
            debugLog('Upload failed with status', xhr.status);
            showToast(`Upload failed: ${xhr.statusText}`, 'error');
            hideUploadProgress(progressId);
        }
    });
    
    // Handle errors
    xhr.addEventListener('error', () => {
        debugLog('File upload error', 'Network error');
        handleError(new Error('Network error during upload'), 'File Upload');
        hideUploadProgress(progressId);
    });
    
    // Handle abort
    xhr.addEventListener('abort', () => {
        debugLog('File upload cancelled');
        showToast('Upload cancelled', 'info');
        hideUploadProgress(progressId);
    });
    
    // Send request
    xhr.open('POST', `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPLOAD}`);
    xhr.send(form);
    
    // Clear file input
    event.target.value = '';
}

// Show upload progress indicator
function showUploadProgress(progressId, fileName) {
    const progressHtml = `
        <div id="${progressId}" class="upload-progress">
            <div class="upload-progress-header">
                <span class="upload-filename">${escapeHtml(fileName)}</span>
                <button class="upload-cancel" onclick="cancelUpload('${progressId}')">×</button>
            </div>
            <div class="upload-progress-bar">
                <div class="upload-progress-fill" style="width: 0%"></div>
            </div>
            <div class="upload-progress-text">0%</div>
        </div>
    `;
    
    // Create or find progress container
    let progressContainer = document.getElementById('uploadProgressContainer');
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.id = 'uploadProgressContainer';
        progressContainer.className = 'upload-progress-container';
        
        // Add styles if not present
        if (!document.querySelector('#upload-progress-styles')) {
            const style = document.createElement('style');
            style.id = 'upload-progress-styles';
            style.textContent = `
                .upload-progress-container {
                    position: fixed;
                    bottom: 80px;
                    right: 20px;
                    z-index: 1000;
                    max-width: 300px;
                }
                .upload-progress {
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                .upload-progress-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .upload-filename {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #333;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    flex: 1;
                }
                .upload-cancel {
                    background: none;
                    border: none;
                    color: #666;
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                }
                .upload-cancel:hover {
                    background: #f0f0f0;
                    color: #333;
                }
                .upload-progress-bar {
                    width: 100%;
                    height: 6px;
                    background: #f0f0f0;
                    border-radius: 3px;
                    overflow: hidden;
                    margin-bottom: 4px;
                }
                .upload-progress-fill {
                    height: 100%;
                    background: #4e54c8;
                    transition: width 0.3s ease;
                    border-radius: 3px;
                }
                .upload-progress-text {
                    font-size: 0.8rem;
                    color: #666;
                    text-align: center;
                }
                @media (max-width: 768px) {
                    .upload-progress-container {
                        bottom: 20px;
                        right: 10px;
                        left: 10px;
                        max-width: none;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(progressContainer);
    }
    
    progressContainer.insertAdjacentHTML('beforeend', progressHtml);
}

// Update upload progress
function updateUploadProgress(progressId, percentComplete) {
    const progressElement = document.getElementById(progressId);
    if (!progressElement) return;
    
    const fillElement = progressElement.querySelector('.upload-progress-fill');
    const textElement = progressElement.querySelector('.upload-progress-text');
    
    if (fillElement) {
        fillElement.style.width = percentComplete + '%';
    }
    
    if (textElement) {
        textElement.textContent = Math.round(percentComplete) + '%';
    }
}

// Hide upload progress
function hideUploadProgress(progressId) {
    const progressElement = document.getElementById(progressId);
    if (progressElement) {
        progressElement.remove();
    }
    
    // Remove container if empty
    const container = document.getElementById('uploadProgressContainer');
    if (container && container.children.length === 0) {
        container.remove();
    }
}

// Cancel upload (placeholder for future implementation)
function cancelUpload(progressId) {
    hideUploadProgress(progressId);
    showToast('Upload cancelled', 'info');
}

// Mobile sidebar functionality
function toggleMobileSidebar() {
    const overlay = document.getElementById('mobileSidebarOverlay');
    const sidebar = document.getElementById('mobileSidebar');
    
    if (overlay && sidebar) {
        overlay.style.display = overlay.style.display === 'block' ? 'none' : 'block';
        sidebar.classList.toggle('active');
    }
}

function closeMobileSidebar() {
    const overlay = document.getElementById('mobileSidebarOverlay');
    const sidebar = document.getElementById('mobileSidebar');
    
    if (overlay && sidebar) {
        overlay.style.display = 'none';
        sidebar.classList.remove('active');
    }
}

function createMobileSidebar() {
    // Create mobile sidebar overlay
    const overlay = document.createElement('div');
    overlay.id = 'mobileSidebarOverlay';
    overlay.onclick = closeMobileSidebar;
    
    // Create mobile sidebar
    const sidebar = document.createElement('div');
    sidebar.id = 'mobileSidebar';
    
    // Clone sidebar content from desktop sidebar
    const desktopSidebar = document.querySelector('.sidebar');
    if (desktopSidebar) {
        const sidebarContent = desktopSidebar.cloneNode(true);
        
        // Create header
        const header = document.createElement('div');
        header.className = 'mobile-sidebar-header';
        header.innerHTML = `
            <span>SkillSwap Chat</span>
            <button class="mobile-sidebar-close" onclick="closeMobileSidebar()">×</button>
        `;
        
        sidebar.appendChild(header);
        sidebar.appendChild(sidebarContent);
    }
    
    document.body.appendChild(overlay);
    document.body.appendChild(sidebar);
    
    // Add mobile menu toggle to navigation
    const nav = document.querySelector('.top-nav .nav-links');
    if (nav && !document.getElementById('mobileChatMenuToggle')) {
        const toggle = document.createElement('button');
        toggle.id = 'mobileChatMenuToggle';
        toggle.className = 'mobile-menu-toggle';
        toggle.innerHTML = '☰';
        toggle.onclick = toggleMobileSidebar;
        nav.parentNode.insertBefore(toggle, nav);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing chat');
    
    // Initialize authentication first
    initializeAuth();
    
    // Create mobile sidebar for responsive design
    if (window.innerWidth <= 800) {
        createMobileSidebar();
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 800) {
            if (!document.getElementById('mobileSidebar')) {
                createMobileSidebar();
            }
        } else {
            closeMobileSidebar();
        }
    });
    
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