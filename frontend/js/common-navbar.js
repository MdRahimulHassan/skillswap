/**
 * Common Navbar Component for SkillSwap
 * Provides consistent navigation across all pages
 */

class CommonNavbar {
    constructor() {
        this.currentPage = this.getCurrentPage();
        this.username = '';
        this.init();
    }

    init() {
        this.setupNavbar();
        this.setupActiveState();
        this.setupMobileMenu();
        this.setupUserDisplay();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'dashboard.html';
        return filename.replace('.html', '');
    }

    setupNavbar() {
        // Create navbar HTML if it doesn't exist
        if (!document.querySelector('.navbar')) {
            const navbarHTML = `
                <div class="navbar">
                    <div class="logo">SkillSwap</div>
                    
                    <div class="hamburger" onclick="commonNavbar.toggleMobileMenu()">
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                    
                    <div class="nav-links" id="navLinks">
                        <a href="dashboard.html" data-page="dashboard">
                            <i class="fas fa-home"></i> Dashboard
                        </a>
                        <a href="profile.html" data-page="profile">
                            <i class="fas fa-user"></i> Profile
                        </a>
                        <a href="chat.html" data-page="chat">
                            <i class="fas fa-comments"></i> Messages
                        </a>
                        <a href="my-skills.html" data-page="my-skills">
                            <i class="fas fa-graduation-cap"></i> My Skills
                        </a>
                        <a href="find-skills.html" data-page="find-skills">
                            <i class="fas fa-search"></i> Find Skills
                        </a>
                        <a href="find-resources.html" data-page="find-resources">
                            <i class="fas fa-folder"></i> Resources
                        </a>
                        <a href="p2p-dashboard.html" data-page="p2p-dashboard">
                            <i class="fas fa-network-wired"></i> P2P Network
                        </a>
                        <a href="#" onclick="commonNavbar.logout()" class="logout-link">
                            <i class="fas fa-sign-out-alt"></i> Logout
                        </a>
                    </div>
                    
                    <button class="profile-btn" id="profileBtn" onclick="window.location.href='profile.html'">
                        My Profile
                    </button>
                </div>
            `;
            
            // Insert navbar at the beginning of body
            document.body.insertAdjacentHTML('afterbegin', navbarHTML);
        }
    }

    setupActiveState() {
        // Remove existing active classes
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.remove('active');
        });

        // Add active class to current page
        const currentPageLink = document.querySelector(`[data-page="${this.currentPage}"]`);
        if (currentPageLink) {
            currentPageLink.classList.add('active');
        }

        // Special handling for chat.html (messages)
        if (this.currentPage === 'chat') {
            const chatLink = document.querySelector('[data-page="chat"]');
            if (chatLink) chatLink.classList.add('active');
        }
    }

    setupMobileMenu() {
        // Mobile menu toggle is handled by onclick in HTML
        // Add touch support for better mobile experience
        const hamburger = document.querySelector('.hamburger');
        if (hamburger) {
            hamburger.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.toggleMobileMenu();
            });
        }

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            const navbar = document.querySelector('.navbar');
            const navLinks = document.getElementById('navLinks');
            
            if (navbar && !navbar.contains(e.target) && navLinks.classList.contains('mobile-open')) {
                navLinks.classList.remove('mobile-open');
            }
        });
    }

    setupUserDisplay() {
        // Try to get username from auth or localStorage
        this.updateProfileButton();
        
        // Listen for auth changes
        if (window.auth) {
            // Update when auth is available
            setTimeout(() => this.updateProfileButton(), 100);
        }
    }

    updateProfileButton() {
        const profileBtn = document.getElementById('profileBtn');
        if (!profileBtn) return;

        let username = '';
        
        // Try to get username from various sources
        if (window.auth && window.auth.getUsername) {
            username = window.auth.getUsername();
        } else if (typeof localStorage !== 'undefined') {
            username = localStorage.getItem('username') || '';
        }

        if (username) {
            profileBtn.textContent = username;
            this.username = username;
        }
    }

    toggleMobileMenu() {
        const navLinks = document.getElementById('navLinks');
        if (navLinks) {
            navLinks.classList.toggle('mobile-open');
        }
    }

    logout() {
        // Use auth logout if available, otherwise redirect to login
        if (window.auth && window.auth.logout) {
            window.auth.logout();
        } else {
            // Clear localStorage and redirect
            if (typeof localStorage !== 'undefined') {
                localStorage.clear();
            }
            window.location.href = 'login.html';
        }
    }

    // Public method to update active state when navigating
    setActivePage(pageName) {
        this.currentPage = pageName;
        this.setupActiveState();
    }

    // Public method to update username
    updateUsername(username) {
        this.username = username;
        this.updateProfileButton();
    }
}

// Initialize common navbar when DOM is ready
let commonNavbar;

document.addEventListener('DOMContentLoaded', () => {
    commonNavbar = new CommonNavbar();
    
    // Make it globally available
    window.commonNavbar = commonNavbar;
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading
} else {
    // DOM is already loaded
    if (!window.commonNavbar) {
        commonNavbar = new CommonNavbar();
        window.commonNavbar = commonNavbar;
    }
}