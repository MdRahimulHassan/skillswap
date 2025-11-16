// Use authenticated user ID instead of URL parameter for security
async function loadProfile() {
    // Check authentication first
    if (!auth.requireAuth()) {
        return;
    }
    
    const userId = auth.getUserId();
    if (!userId) {
        showToast('User not authenticated', 'error');
        hideLoadingState();
        return;
    }

    try {
        loading.showGlobal('Loading profile...');
        
        const user = await apiCall(`${API_CONFIG.ENDPOINTS.PROFILE}?id=${userId}`);

        // Hide loading state and show content
        hideLoadingState();
        showProfileContent();

        // Update profile header
        document.getElementById("profilePhoto").src = user.profile_photo || "static/images/default.svg";
        document.getElementById("profileName").textContent = user.name || "No Name";
        document.getElementById("profileUsername").textContent = user.username;
        
        // Update join date
        if (user.created_at) {
            const joinDate = new Date(user.created_at).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long' 
            });
            document.getElementById("joinDate").textContent = joinDate;
        }
        
        // Update online status
        updateProfileOnlineStatus(userId);

        // Update skills sections
        updateSkillsSection('skillsHave', user.skills_have);
        updateSkillsSection('skillsWant', user.skills_want);

        // Pre-fill edit form (simple version)
        const editNameEl = document.getElementById("editName");
        const editPhotoEl = document.getElementById("editPhoto");
        const editSkillsHaveEl = document.getElementById("editSkillsHave");
        const editSkillsWantEl = document.getElementById("editSkillsWant");
        
        if (editNameEl) editNameEl.value = user.name || "";
        if (editPhotoEl) editPhotoEl.value = user.profile_photo || "";
        if (editSkillsHaveEl) editSkillsHaveEl.value = user.skills_have || "";
        if (editSkillsWantEl) editSkillsWantEl.value = user.skills_want || "";
        
        // Pre-fill modal edit form
        const modalEditName = document.getElementById("editName");
        const modalEditBio = document.getElementById("editBio");
        const modalEditLocation = document.getElementById("editLocation");
        
        if (modalEditName) modalEditName.value = user.name || "";
        if (modalEditBio) modalEditBio.value = user.bio || "";
        if (modalEditLocation) modalEditLocation.value = user.location || "";
        
    } catch (error) {
        hideLoadingState();
        handleError(error, 'Load Profile');
    }
}

function hideLoadingState() {
    const loadingState = document.getElementById("loadingState");
    if (loadingState) {
        loadingState.style.display = "none";
    }
    loading.hideGlobal();
}

function showProfileContent() {
    const profileContent = document.getElementById("profileContent");
    if (profileContent) {
        profileContent.style.display = "block";
    }
}

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
        skillEl.className = 'skill-item';
        skillEl.innerHTML = `
            <span class="skill-name">${skill}</span>
            <button class="skill-remove" onclick="removeSkill('${skill}', '${containerId}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(skillEl);
    });
}

// Modal functions
function openEditModal() {
    const modal = document.getElementById("editModal");
    if (modal) {
        modal.style.display = "block";
    }
}

function closeEditModal() {
    const modal = document.getElementById("editModal");
    if (modal) {
        modal.style.display = "none";
    }
}

function openSkillModal(type) {
    const modal = document.getElementById("skillModal");
    const title = document.getElementById("skillModalTitle");
    if (modal && title) {
        title.textContent = type === 'have' ? 'Add Skill I Have' : 'Add Skill I Want';
        modal.style.display = "block";
        modal.dataset.type = type;
    }
}

function closeSkillModal() {
    const modal = document.getElementById("skillModal");
    if (modal) {
        modal.style.display = "none";
        // Clear form
        document.getElementById("skillName").value = '';
        document.getElementById("skillLevel").value = 'beginner';
        document.getElementById("skillDescription").value = '';
    }
}

function saveProfile() {
    const userId = auth.getUserId();
    if (!userId) {
        showToast('User not authenticated', 'error');
        return;
    }

    // Validate form
    const validation = validateForm('editModal', {
        editName: ['required', 'minLength:2']
    });

    if (!validation.valid) {
        showToast('Please fix form errors', 'error');
        return;
    }

    loading.showGlobal('Saving profile...');

    try {
        const formData = new FormData();
        formData.append("id", userId);
        formData.append("name", document.getElementById("editName").value);
        formData.append("profile_photo", document.getElementById("editPhoto").value || "");
        formData.append("skills_have", document.getElementById("editSkillsHave").value || "");
        formData.append("skills_want", document.getElementById("editSkillsWant").value || "");

        fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROFILE_UPDATE}`, {
            method: "POST",
            body: formData
        }).then(res => {
            if(res.ok) {
                showToast("Profile updated successfully!", 'success');
                closeEditModal();
                loadProfile(); // Reload the updated data
            } else {
                throw new Error('Failed to update profile');
            }
        }).catch(error => {
            handleError(error, 'Update Profile');
        }).finally(() => {
            loading.hideGlobal();
        });
    } catch (error) {
        loading.hideGlobal();
        handleError(error, 'Update Profile');
    }
}

function saveSkill() {
    const skillName = document.getElementById("skillName").value.trim();
    const skillLevel = document.getElementById("skillLevel").value;
    const modal = document.getElementById("skillModal");
    const type = modal ? modal.dataset.type : 'have';
    
    if (!skillName) {
        showToast('Please enter a skill name', 'error');
        return;
    }

    const userId = auth.getUserId();
    if (!userId) {
        showToast('User not authenticated', 'error');
        return;
    }

    loading.showGlobal('Adding skill...');

    try {
        // Get current skills
        const currentSkillsEl = document.getElementById(type === 'have' ? 'editSkillsHave' : 'editSkillsWant');
        const currentSkills = currentSkillsEl ? currentSkillsEl.value : '';
        const skillsArray = currentSkills ? currentSkills.split(',').map(s => s.trim()).filter(s => s) : [];
        
        // Add new skill if not already present
        if (!skillsArray.includes(skillName)) {
            skillsArray.push(skillName);
        }
        
        const updatedSkills = skillsArray.join(', ');

        const formData = new FormData();
        formData.append("id", userId);
        formData.append("name", document.getElementById("editName").value || "");
        formData.append("profile_photo", document.getElementById("editPhoto").value || "");
        formData.append("skills_have", type === 'have' ? updatedSkills : (document.getElementById("editSkillsHave")?.value || ""));
        formData.append("skills_want", type === 'want' ? updatedSkills : (document.getElementById("editSkillsWant")?.value || ""));

        fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROFILE_UPDATE}`, {
            method: "POST",
            body: formData
        }).then(res => {
            if(res.ok) {
                showToast(`Skill "${skillName}" added successfully!`, 'success');
                closeSkillModal();
                loadProfile(); // Reload the updated data
            } else {
                throw new Error('Failed to add skill');
            }
        }).catch(error => {
            handleError(error, 'Add Skill');
        }).finally(() => {
            loading.hideGlobal();
        });
    } catch (error) {
        loading.hideGlobal();
        handleError(error, 'Add Skill');
    }
}

function removeSkill(skillName, type) {
    if (!confirm(`Remove "${skillName}" from your skills?`)) {
        return;
    }

    const userId = auth.getUserId();
    if (!userId) {
        showToast('User not authenticated', 'error');
        return;
    }

    loading.showGlobal('Removing skill...');

    try {
        // Get current skills and remove the specified one
        const currentSkillsEl = document.getElementById(type === 'skillsHave' ? 'editSkillsHave' : 'editSkillsWant');
        const currentSkills = currentSkillsEl ? currentSkillsEl.value : '';
        const skillsArray = currentSkills ? currentSkills.split(',').map(s => s.trim()).filter(s => s) : [];
        
        const updatedSkills = skillsArray.filter(skill => skill !== skillName).join(', ');

        const formData = new FormData();
        formData.append("id", userId);
        formData.append("name", document.getElementById("editName").value || "");
        formData.append("profile_photo", document.getElementById("editPhoto").value || "");
        formData.append("skills_have", type === 'skillsHave' ? updatedSkills : (document.getElementById("editSkillsHave")?.value || ""));
        formData.append("skills_want", type === 'skillsWant' ? updatedSkills : (document.getElementById("editSkillsWant")?.value || ""));

        fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROFILE_UPDATE}`, {
            method: "POST",
            body: formData
        }).then(res => {
            if(res.ok) {
                showToast(`Skill "${skillName}" removed successfully!`, 'success');
                loadProfile(); // Reload the updated data
            } else {
                throw new Error('Failed to remove skill');
            }
        }).catch(error => {
            handleError(error, 'Remove Skill');
        }).finally(() => {
            loading.hideGlobal();
        });
    } catch (error) {
        loading.hideGlobal();
        handleError(error, 'Remove Skill');
    }
}

// Legacy edit button functionality (for compatibility)
document.getElementById("editBtn")?.addEventListener("click", () => {
    const editForm = document.getElementById("editForm");
    if (editForm) {
        editForm.classList.toggle("hidden");
    }
});

document.getElementById("saveBtn")?.addEventListener("click", async () => {
    const userId = auth.getUserId();
    if (!userId) {
        showToast('User not authenticated', 'error');
        return;
    }

    // Validate form
    const validation = validateForm('editForm', {
        editName: ['required', 'minLength:2'],
        editSkillsHave: ['maxLength:500'],
        editSkillsWant: ['maxLength:500']
    });

    if (!validation.valid) {
        showToast('Please fix form errors', 'error');
        return;
    }

    loading.show('saveBtn', 'Saving...');

    try {
        const formData = new FormData();
        formData.append("id", userId);
        formData.append("name", document.getElementById("editName").value);
        formData.append("profile_photo", document.getElementById("editPhoto").value);
        formData.append("skills_have", document.getElementById("editSkillsHave").value);
        formData.append("skills_want", document.getElementById("editSkillsWant").value);

        const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROFILE_UPDATE}`, {
            method: "POST",
            body: formData
        });

        if(res.ok) {
            showToast("Profile updated successfully!", 'success');
            document.getElementById("editForm").classList.add('hidden');
            loadProfile(); // Reload the updated data
        } else {
            throw new Error('Failed to update profile');
        }
    } catch (error) {
        handleError(error, 'Update Profile');
    } finally {
        loading.hide('saveBtn');
    }
});

// Additional helper functions
function toggleMobileMenu() {
    const navLinks = document.querySelector(".nav-links");
    if (navLinks) {
        navLinks.classList.toggle("mobile-open");
    }
}

function logout() {
    auth.logout();
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

function triggerPhotoUpload() {
    const photoInput = document.getElementById("photoUpload");
    if (photoInput) {
        photoInput.click();
    }
}

function handlePhotoUpload(event) {
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

    loading.showGlobal('Uploading profile photo...');

    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('photo', file);

    fetch(`${API_CONFIG.BASE_URL}/api/profile/photo`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }
        return response.json();
    })
    .then(result => {
        if (result.status === 'success') {
            showToast('Profile photo updated successfully!', 'success');
            
            // Update the profile photo in the UI
            const profilePhoto = document.getElementById('profilePhoto');
            if (profilePhoto) {
                profilePhoto.src = result.photo_url;
            }
            
            // Reload profile to get updated data
            loadProfile();
        } else {
            showToast(result.message || 'Upload failed', 'error');
        }
    })
    .catch(error => {
        handleError(error, 'Photo Upload');
    })
    .finally(() => {
        loading.hideGlobal();
        // Clear file input
        event.target.value = '';
    });
}

// Close modals when clicking outside
window.onclick = function(event) {
    const editModal = document.getElementById("editModal");
    const skillModal = document.getElementById("skillModal");
    
    if (event.target === editModal) {
        closeEditModal();
    }
    if (event.target === skillModal) {
        closeSkillModal();
    }
}

// Update profile online status
async function updateProfileOnlineStatus(userId) {
    try {
        const statusData = await apiCall(`${API_CONFIG.ENDPOINTS.USERS_ONLINE}?ids=${userId}`);
        if (statusData && statusData.length > 0) {
            const isOnline = statusData[0].online;
            const statusElement = document.getElementById('onlineStatus');
            if (statusElement) {
                const statusDot = statusElement.querySelector('.status-dot');
                const statusText = statusElement.querySelector('.status-text');
                
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
        console.error('Error updating profile online status:', error);
    }
}

// Initialize profile when page loads
document.addEventListener('DOMContentLoaded', loadProfile);
