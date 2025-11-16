// Use authenticated user ID instead of URL parameter for security
const userId = auth.getUserId();

async function loadProfile() {
    try {
        loading.showGlobal('Loading profile...');
        
        const user = await apiCall(`${API_CONFIG.ENDPOINTS.PROFILE}?id=${userId}`);

        document.getElementById("profilePhoto").src = user.profile_photo || "static/images/default.svg";
        document.getElementById("name").textContent = user.name || "No Name";
        document.getElementById("username").textContent = "@" + user.username;
        document.getElementById("skillsHave").textContent = user.skills_have || "None";
        document.getElementById("skillsWant").textContent = user.skills_want || "None";

        // Pre-fill edit form
        document.getElementById("editName").value = user.name || "";
        document.getElementById("editPhoto").value = user.profile_photo || "";
        document.getElementById("editSkillsHave").value = user.skills_have || "";
        document.getElementById("editSkillsWant").value = user.skills_want || "";
        
    } catch (error) {
        handleError(error, 'Load Profile');
    } finally {
        loading.hideGlobal();
    }
}

document.getElementById("editBtn").onclick = () => {
    document.getElementById("editForm").classList.toggle("hidden");
};

document.getElementById("saveBtn").onclick = async () => {
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
};

window.onload = loadProfile;
