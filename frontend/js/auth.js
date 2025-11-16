// Authentication Management System

class AuthManager {
    constructor() {
        this.storageKey = 'skillswap_auth';
        this.init();
    }

    init() {
        // Check for existing session
        const auth = this.getAuth();
        if (auth && !this.isTokenValid(auth)) {
            this.clearAuth();
        }
    }

    // Get current authentication data
    getAuth() {
        try {
            const authData = localStorage.getItem(this.storageKey);
            return authData ? JSON.parse(authData) : null;
        } catch (error) {
            console.error('Error parsing auth data:', error);
            this.clearAuth();
            return null;
        }
    }

    // Set authentication data
    setAuth(userData) {
        const authData = {
            user_id: userData.user_id,
            username: userData.username,
            email: userData.email || null,
            authenticated: true,
            loginTime: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        };

        localStorage.setItem(this.storageKey, JSON.stringify(authData));
        
        // Also maintain backward compatibility with existing keys
        localStorage.setItem("user_id", userData.user_id);
        localStorage.setItem("username", userData.username);
        localStorage.setItem("authenticated", "true");
    }

    // Clear authentication data
    clearAuth() {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem("user_id");
        localStorage.removeItem("username");
        localStorage.removeItem("authenticated");
    }

    // Check if user is authenticated
    isAuthenticated() {
        const auth = this.getAuth();
        return auth && auth.authenticated && this.isTokenValid(auth);
    }

    // Check if token is still valid (not expired)
    isTokenValid(auth) {
        if (!auth || !auth.expiresAt) return false;
        return new Date(auth.expiresAt) > new Date();
    }

    // Get current user ID
    getUserId() {
        const auth = this.getAuth();
        return auth ? auth.user_id : null;
    }

    // Get current username
    getUsername() {
        const auth = this.getAuth();
        return auth ? auth.username : null;
    }

    // Redirect to login if not authenticated
    requireAuth() {
        if (!this.isAuthenticated()) {
            showToast('Please login to continue', 'warning');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return false;
        }
        return true;
    }

    // Logout user
    logout() {
        this.clearAuth();
        showToast('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }

    // Refresh session (extend expiration)
    refreshSession() {
        const auth = this.getAuth();
        if (auth) {
            auth.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            this.setAuth(auth);
        }
    }
}

// Global auth manager instance
const auth = new AuthManager();

// Authentication check function for backward compatibility
function checkAuthentication() {
    if (!auth.requireAuth()) {
        return null;
    }
    
    return {
        userId: auth.getUserId(),
        username: auth.getUsername()
    };
}

// Enhanced logout function
function logout() {
    auth.logout();
}

// Auto-refresh session every 30 minutes
setInterval(() => {
    if (auth.isAuthenticated()) {
        auth.refreshSession();
    }
}, 30 * 60 * 1000);

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager, auth, checkAuthentication, logout };
}