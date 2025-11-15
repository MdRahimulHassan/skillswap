// Simple connection: replace 'me' with your logged-in user id (from server-side)
const me = 1;               // ===> set dynamically in production
document.getElementById('meId').innerText = me;

let currentChat = null;
let ws = null;

// connect websocket
function connectWS() {
  ws = new WebSocket(`ws://${location.hostname}:8080/api/ws?user_id=${me}`);
  ws.onopen = ()=> console.log('ws open');
  ws.onmessage = (ev)=> {
    const msg = JSON.parse(ev.data);
    // update UI: if current chat, append message
    if (currentChat && (msg.sender_id===currentChat || msg.receiver_id===currentChat)) {
      appendMessage(msg);
    }
    loadChats(); // update chat list preview
  };
  ws.onclose = ()=> setTimeout(connectWS, 1500);
}
connectWS();

// load chat list
async function loadChats() {
  const res = await fetch(`${API_BASE}/chats?user_id=${me}`);
  const list = await res.json();
  const el = document.getElementById('chatList');
  el.innerHTML = '';
  list.forEach(it => {
    const d = document.createElement('div');
    d.className = 'chat-item' + (currentChat===it.user_id ? ' active':'');
    d.innerHTML = `<div><strong>User ${it.user_id}</strong><div class="meta">${it.is_file ? '[file]' : (it.last_msg||'')}</div></div>
                   <div class="meta">${new Date(it.created_at).toLocaleString()}</div>`;
    d.onclick = ()=> openChat(it.user_id);
    el.appendChild(d);
  });
}
loadChats();
setInterval(loadChats, 4000);

// open chat: load history
async function openChat(uid) {
  currentChat = uid;
  document.getElementById('chatHeader').innerText = 'Chat with User ' + uid;
  const res = await fetch(`${API_BASE}/history?user1=${me}&user2=${uid}`);
  const msgs = await res.json();
  const container = document.getElementById('messages');
  container.innerHTML = '';
  msgs.forEach(m => appendMessage(m));
  container.scrollTop = container.scrollHeight;
}

// append message object to UI
function appendMessage(m) {
  const container = document.getElementById('messages');
  const d = document.createElement('div');
  d.className = 'msg ' + (m.sender_id===me ? 'me' : 'other');

  if (m.is_file) {
    // fetch file info to show link
    if (m.file_id) {
      fetch(`${API_BASE}/file?id=${m.file_id}`)
        .then(r=>r.json())
        .then(info=>{
          d.innerHTML = `📎 <a href="${location.origin}${info.url}" target="_blank">${info.filename}</a>
                         <span class="meta">${new Date(m.created_at).toLocaleString()}</span>`;
        }).catch(()=> {
          d.innerHTML = `📎 File (id:${m.file_id}) <span class="meta">${new Date(m.created_at).toLocaleString()}</span>`;
        });
    } else {
      d.innerText = '📎 File';
    }
  } else {
    d.innerHTML = `<div>${escapeHtml(m.content || m.text || '')}</div>
                  <div class="meta">${new Date(m.created_at).toLocaleString()}</div>`;
  }
  container.appendChild(d);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(s){
  return s ? s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : '';
}

// sending message
document.getElementById('sendBtn').addEventListener('click', ()=>{
  const txt = document.getElementById('messageInput').value.trim();
  if (!txt || !currentChat) return;
  const payload = {
    type: "message",
    sender_id: me,
    receiver_id: currentChat,
    content: txt
  };
  ws.send(JSON.stringify(payload));
  document.getElementById('messageInput').value = '';
  // optimistic UI:
  appendMessage({sender_id: me, content: txt, created_at: new Date().toISOString()});
});

// file upload
const fileInput = document.getElementById('fileInput');
document.getElementById('uploadBtn').addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', async (ev)=> {
  if (!currentChat) { alert('Select a chat'); return; }
  const f = ev.target.files[0];
  if (!f) return;
  const form = new FormData();
  form.append('sender_id', me);
  form.append('receiver_id', currentChat);
  form.append('file', f);

  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form });
  const data = await res.json();
  // server will send WS notification to both participants; chat list will refresh
  console.log('uploaded', data);
});

// helper to auto-open first chat if exists
setTimeout(async ()=> {
  const res = await fetch(`${API_BASE}/chats?user_id=${me}`);
  const list = await res.json();
  if (list.length && !currentChat) openChat(list[0].user_id);
}, 600);
