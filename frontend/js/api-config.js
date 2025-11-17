// Centralized API Configuration
const API_CONFIG = {
    BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8080/api' 
        : '/api',
    
    // API Endpoints
    ENDPOINTS: {
        LOGIN: '/login',
        SIGNUP: '/signup',
        PROFILE: '/profile',
        PROFILE_UPDATE: '/profile/update',
        PROFILE_PHOTO: '/profile/photo',
        CHATS: '/chats',
        HISTORY: '/history',
        UPLOAD: '/upload',
        FILE: '/file',
        USERS_SEARCH: '/users/search',
        USERS_ONLINE: '/users/online',
        DASHBOARD_STATS: '/dashboard/stats',
        SKILLS_ADD: '/skills/add',
        SKILLS_REMOVE: '/skills/remove',
        SKILLS_SEARCH: '/skills/search',
        SKILLS_USER: '/skills/user',
        // P2P Endpoints
        P2P_RESOURCE_CREATE: '/p2p/resource/create',
        P2P_RESOURCES: '/p2p/resources',
        P2P_RESOURCE: (id) => `/p2p/resource/${id}`,
        P2P_SWARM_STATS: (id) => `/p2p/swarm/${id}/stats`,
        P2P_SWARM_PEERS: (id) => `/p2p/swarm/${id}/peers`,
        P2P_ANNOUNCE: '/p2p/announce',
        P2P_REQUEST: '/p2p/request',
        P2P_REQUESTS: '/p2p/requests',
        P2P_REQUEST_RESPOND: '/p2p/request/respond',
        P2P_PIECE: (resourceId, pieceIndex) => `/p2p/piece/${resourceId}/${pieceIndex}`,
        
        // P2P Connection Management Endpoints
        P2P_CONNECTIONS: '/p2p/connections',
        P2P_CONNECTIONS_RESPOND: '/p2p/connections/respond',
        P2P_CONNECTIONS_SKILLS: '/p2p/connections/skills',
        P2P_CONNECTIONS_CHECK: '/p2p/connections/check',
        
        // Skill Resource Management Endpoints
        SKILL_RESOURCES: '/skills/resources',
        SKILL_RESOURCES_ALL: '/skills/resources/all',
        WS: () => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'localhost:8080'
                : window.location.host;
            return `${protocol}//${host}/api/ws`;
        },
        P2P_WS: () => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'localhost:8080'
                : window.location.host;
            return `${protocol}//${host}/api/p2p/ws`;
        }
    }
};

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_CONFIG, apiCall };
}