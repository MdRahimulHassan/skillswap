const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("id") || 1; // default to 1 if not provided

async function loadProfile() {
    const res = await fetch(`/api/profile?id=${userId}`);
    const user = await res.json();

    document.getElementById("profilePhoto").src = user.profile_photo || "/static/images/default.png";
    document.getElementById("name").textContent = user.name || "No Name";
    document.getElementById("username").textContent = "@" + user.username;
    document.getElementById("skillsHave").textContent = user.skills_have || "None";
    document.getElementById("skillsWant").textContent = user.skills_want || "None";

    // Pre-fill edit form
    document.getElementById("editName").value = user.name || "";
    document.getElementById("editPhoto").value = user.profile_photo || "";
    document.getElementById("editSkillsHave").value = user.skills_have || "";
    document.getElementById("editSkillsWant").value = user.skills_want || "";
}

document.getElementById("editBtn").onclick = () => {
    document.getElementById("editForm").classList.toggle("hidden");
};

document.getElementById("saveBtn").onclick = async () => {
    const formData = new FormData();
    formData.append("id", userId);
    formData.append("name", document.getElementById("editName").value);
    formData.append("profile_photo", document.getElementById("editPhoto").value);
    formData.append("skills_have", document.getElementById("editSkillsHave").value);
    formData.append("skills_want", document.getElementById("editSkillsWant").value);

    const res = await fetch("/api/profile/update", {
        method: "POST",
        body: formData
    });

    if(res.ok) {
        alert("Profile updated!");
        loadProfile(); // Reload the updated data
    } else {
        alert("Failed to update profile");
    }
};

window.onload = loadProfile;
