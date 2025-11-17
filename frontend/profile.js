// Profile Management System - Fixed Version
// Handles profile loading, editing, and skill management

// Global variables
let currentProfile = null;

// Initialize profile when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (!auth.requireAuth()) {
        return;
    }
    
    // Update profile button with username
    const username = auth.getUsername();
    const profileBtn = document.getElementById("profileBtn");
    if (profileBtn) {
        profileBtn.textContent = username;
    }
    
    loadProfile();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Modal close buttons
    const closeButtons = document.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = btn.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
    
    // Profile photo upload
    const photoInput = document.getElementById('photoUpload');
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoUpload);
    }
    
    // Save profile button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfile);
    }
    
    // Edit profile button
    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
        editBtn.addEventListener('click', openEditModal);
    }
    
    // Skill modal buttons
    const addSkillBtns = document.querySelectorAll('.add-skill-btn');
    addSkillBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.dataset.type || 'have';
            openSkillModal(type);
        });
    });
    
    // Save skill button
    const saveSkillBtn = document.getElementById('saveSkillBtn');
    if (saveSkillBtn) {
        saveSkillBtn.addEventListener('click', saveSkill);
    }
}

// Load profile data
async function loadProfile() {
    try {
        loading.showGlobal('Loading profile...');
        
        const userId = auth.getUserId();
        const user = await apiCall(`${API_CONFIG.ENDPOINTS.PROFILE}?user_id=${userId}`);
        
        currentProfile = user;
        
        // Hide loading state and show content
        hideLoadingState();
        showProfileContent();
        
        // Update profile header
        updateProfileHeader(user);
        
        // Update skills sections
        updateSkillsSection('skillsHave', user.skills_have);
        updateSkillsSection('skillsWant', user.skills_want);
        
        // Update stats
        updateProfileStats(user);
        
    } catch (error) {
        hideLoadingState();
        handleError(error, 'Load Profile');
    }
}

// Update profile header information
function updateProfileHeader(user) {
    const profilePhoto = document.getElementById('profilePhoto');
    const profileName = document.getElementById('profileName');
    const profileUsername = document.getElementById('profileUsername');
    const joinDate = document.getElementById('joinDate');
    
    if (profilePhoto) {
        profilePhoto.src = user.profile_photo || 'static/images/default.svg';
    }
    
    if (profileName) {
        profileName.textContent = user.name || 'No Name';
    }
    
    if (profileUsername) {
        profileUsername.textContent = '@' + user.username;
    }
    
    if (joinDate && user.created_at) {
        const date = new Date(user.created_at);
        joinDate.textContent = 'Member since ' + date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long' 
        });
    }
    
    // Update online status
    updateOnlineStatus(user.id);
}

// Update profile statistics
function updateProfileStats(user) {
    // These would be calculated from actual data
    const exchangesCount = document.getElementById('exchangesCount');
    const ratingCount = document.getElementById('ratingCount');
    const conversationsCount = document.getElementById('conversationsCount');
    const responseRate = document.getElementById('responseRate');
    
    // For now, set placeholder values
    if (exchangesCount) exchangesCount.textContent = '0';
    if (ratingCount) ratingCount.textContent = '4.8';
    if (conversationsCount) conversationsCount.textContent = '0';
    if (responseRate) responseRate.textContent = '95%';
}

// Update online status
async function updateOnlineStatus(userId) {
    try {
        const statusData = await apiCall(`${API_CONFIG.ENDPOINTS.USERS_ONLINE}?ids=${userId}`);
        const statusElement = document.getElementById('onlineStatus');
        
        if (statusElement && statusData && statusData.length > 0) {
            const isOnline = statusData[0].online;
            const statusDot = statusElement.querySelector('.status-dot');
            const statusText = statusElement.querySelector('.status-text');
            
            if (statusDot && statusText) {
                if (isOnline) {
                    statusDot.style.background = '#28a745';
                    statusText.textContent = 'Online';
                    statusElement.style.background = 'rgba(40, 167, 69, 0.1)';
                    statusElement.style.borderColor = 'rgba(40, 167, 69, 0.2)';
                } else {
                    statusDot.style.background = '#6c757d';
                    statusText.textContent = 'Offline';
                    statusElement.style.background = 'rgba(108, 117, 125, 0.1)';
                    statusElement.style.borderColor = 'rgba(108, 117, 125, 0.2)';
                }
            }
        }
    } catch (error) {
        console.error('Error updating online status:', error);
    }
}

// Update skills section
function updateSkillsSection(containerId, skillsText) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!skillsText || skillsText.trim() === '') {
        container.innerHTML = '<p class="no-skills">No skills added yet</p>';
        return;
    }
    
    // Split skills by comma and create skill elements
    const skills = skillsText.split(',').map(skill => skill.trim()).filter(skill => skill);
    skills.forEach(skill => {
        const skillEl = document.createElement('div');
        skillEl.className = 'skill-tag';
        skillEl.innerHTML = `
            <div class="skill-info">
                <div class="skill-name">${escapeHtml(skill)}</div>
            </div>
            <div class="skill-actions">
                <button class="skill-remove" onclick="removeSkill('${escapeHtml(skill)}', '${containerId}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        container.appendChild(skillEl);
    });
}

// Modal functions
function openEditModal() {
    const modal = document.getElementById('editModal');
    if (!modal || !currentProfile) return;
    
    // Pre-fill form with current data
    const editName = document.getElementById('editName');
    const editBio = document.getElementById('editBio');
    const editLocation = document.getElementById('editLocation');
    const editAvailability = document.getElementById('editAvailability');
    const editLinkedIn = document.getElementById('editLinkedIn');
    const editGithub = document.getElementById('editGithub');
    
    if (editName) editName.value = currentProfile.name || '';
    if (editBio) editBio.value = currentProfile.bio || '';
    if (editLocation) editLocation.value = currentProfile.location || '';
    if (editAvailability) editAvailability.value = currentProfile.availability || 'Available';
    if (editLinkedIn) editLinkedIn.value = currentProfile.linkedin || '';
    if (editGithub) editGithub.value = currentProfile.github || '';
    
    modal.style.display = 'block';
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function openSkillModal(type) {
    const modal = document.getElementById('skillModal');
    const title = document.getElementById('skillModalTitle');
    
    if (modal && title) {
        title.textContent = type === 'have' ? 'Add Skill I Have' : 'Add Skill I Want';
        modal.dataset.type = type;
        modal.style.display = 'block';
        
        // Clear form
        const skillName = document.getElementById('skillName');
        const skillLevel = document.getElementById('skillLevel');
        const skillDescription = document.getElementById('skillDescription');
        
        if (skillName) skillName.value = '';
        if (skillLevel) skillLevel.value = 'beginner';
        if (skillDescription) skillDescription.value = '';
    }
}

function closeSkillModal() {
    const modal = document.getElementById('skillModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Save profile
async function saveProfile() {
    if (!currentProfile) return;
    
    const userId = auth.getUserId();
    if (!userId) {
        showToast('User not authenticated', 'error');
        return;
    }
    
    // Get form data
    const formData = new FormData();
    formData.append('id', userId);
    formData.append('name', document.getElementById('editName')?.value || '');
    formData.append('bio', document.getElementById('editBio')?.value || '');
    formData.append('location', document.getElementById('editLocation')?.value || '');
    formData.append('availability', document.getElementById('editAvailability')?.value || 'Available');
    formData.append('linkedin', document.getElementById('editLinkedIn')?.value || '');
    formData.append('github', document.getElementById('editGithub')?.value || '');
    
    try {
        loading.showGlobal('Saving profile...');
        
        const response = await apiCall(API_CONFIG.ENDPOINTS.PROFILE_UPDATE, {
            method: 'POST',
            body: formData
        });
        
        if (response.status === 'success') {
            showToast('Profile updated successfully!', 'success');
            closeEditModal();
            loadProfile(); // Reload profile data
        } else {
            showToast(response.message || 'Failed to update profile', 'error');
        }
    } catch (error) {
        handleError(error, 'Update Profile');
    } finally {
        loading.hideGlobal();
    }
}

// Save skill
async function saveSkill() {
    const modal = document.getElementById('skillModal');
    if (!modal) return;
    
    const skillName = document.getElementById('skillName')?.value?.trim();
    const skillLevel = document.getElementById('skillLevel')?.value || 'beginner';
    const skillDescription = document.getElementById('skillDescription')?.value || '';
    const type = modal.dataset.type || 'have';
    
    if (!skillName) {
        showToast('Please enter a skill name', 'error');
        return;
    }
    
    const userId = auth.getUserId();
    if (!userId) {
        showToast('User not authenticated', 'error');
        return;
    }
    
    try {
        loading.showGlobal('Adding skill...');
        
        // Get current skills
        const currentSkills = type === 'have' ? 
            (currentProfile?.skills_have || '') : 
            (currentProfile?.skills_want || '');
        
        const skillsArray = currentSkills ? currentSkills.split(',').map(s => s.trim()).filter(s => s) : [];
        
        // Add new skill if not already present
        if (!skillsArray.includes(skillName)) {
            skillsArray.push(skillName);
        }
        
        const updatedSkills = skillsArray.join(', ');
        
        const formData = new FormData();
        formData.append('id', userId);
        formData.append(type === 'have' ? 'skills_have' : 'skills_want', updatedSkills);
        
        const response = await apiCall(API_CONFIG.ENDPOINTS.PROFILE_UPDATE, {
            method: 'POST',
            body: formData
        });
        
        if (response.status === 'success') {
            showToast(`Skill "${skillName}" added successfully!`, 'success');
            closeSkillModal();
            loadProfile(); // Reload profile data
        } else {
            showToast(response.message || 'Failed to add skill', 'error');
        }
    } catch (error) {
        handleError(error, 'Add Skill');
    } finally {
        loading.hideGlobal();
    }
}

// Remove skill
async function removeSkill(skillName, type) {
    if (!confirm(`Remove "${skillName}" from your ${type} skills?`)) {
        return;
    }
    
    const userId = auth.getUserId();
    if (!userId) {
        showToast('User not authenticated', 'error');
        return;
    }
    
    try {
        loading.showGlobal('Removing skill...');
        
        // Get current skills and remove specified one
        const currentSkills = type === 'skillsHave' ? 
            (currentProfile?.skills_have || '') : 
            (currentProfile?.skills_want || '');
        
        const skillsArray = currentSkills ? currentSkills.split(',').map(s => s.trim()).filter(s => s) : [];
        const updatedSkills = skillsArray.filter(skill => skill !== skillName).join(', ');
        
        const formData = new FormData();
        formData.append('id', userId);
        formData.append(type === 'skillsHave' ? 'skills_have' : 'skills_want', updatedSkills);
        
        const response = await apiCall(API_CONFIG.ENDPOINTS.PROFILE_UPDATE, {
            method: 'POST',
            body: formData
        });
        
        if (response.status === 'success') {
            showToast(`Skill "${skillName}" removed successfully!`, 'success');
            loadProfile(); // Reload profile data
        } else {
            showToast(response.message || 'Failed to remove skill', 'error');
        }
    } catch (error) {
        handleError(error, 'Remove Skill');
    } finally {
        loading.hideGlobal();
    }
}

// Handle photo upload
async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        return;
    }
    
    const userId = auth.getUserId();
    if (!userId) {
        showToast('User not authenticated', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('photo', file);
    
    try {
        loading.showGlobal('Uploading profile photo...');
        
        const response = await apiCall('/api/profile/photo', {
            method: 'POST',
            body: formData
        });
        
        if (response.status === 'success') {
            showToast('Profile photo updated successfully!', 'success');
            
            // Update profile photo in UI
            const profilePhoto = document.getElementById('profilePhoto');
            if (profilePhoto) {
                profilePhoto.src = response.photo_url;
            }
            
            // Reload profile to get updated data
            loadProfile();
        } else {
            showToast(response.message || 'Upload failed', 'error');
        }
    } catch (error) {
        handleError(error, 'Photo Upload');
    } finally {
        loading.hideGlobal();
        // Clear file input
        event.target.value = '';
    }
}

// Utility functions
function hideLoadingState() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.style.display = 'none';
    }
    loading.hideGlobal();
}

function showProfileContent() {
    const profileContent = document.getElementById('profileContent');
    if (profileContent) {
        profileContent.style.display = 'block';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function triggerPhotoUpload() {
    const photoInput = document.getElementById('photoUpload');
    if (photoInput) {
        photoInput.click();
    }
}

function startChat() {
    window.location.href = 'chat.html';
}

function shareProfile() {
    const profileUrl = window.location.href;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(profileUrl).then(() => {
            showToast('Profile link copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Failed to copy profile link', 'error');
        });
    } else {
        showToast('Profile URL: ' + profileUrl, 'info');
    }
}

function editAbout() {
    openEditModal();
}

// Logout function
function logout() {
    auth.logout();
}

// Export functions for global access
window.profileFunctions = {
    loadProfile,
    saveProfile,
    openEditModal,
    closeEditModal,
    openSkillModal,
    closeSkillModal,
    saveSkill,
    removeSkill,
    handlePhotoUpload,
    triggerPhotoUpload
};