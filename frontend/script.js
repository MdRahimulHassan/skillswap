async function login() {
  const res = await fetch("http://localhost:8080/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: document.getElementById("email").value,
      password: document.getElementById("password").value
    })
  })
const token = localStorage.getItem("token")

fetch("http://localhost:8080/api/me", {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${token}`
  }
})

  const data = await res.json()
  if (data.success) {
    localStorage.setItem("token", data.token)
    alert("Logged in!")
  } else {
    alert("Invalid login")
  }
}
