// Authentication check
if (!auth.requireAuth()) {
    throw new Error("User not authenticated");
}

const me = auth.getUserId();
document.getElementById('meId').innerText = auth.getUsername();

let currentChat = null;
let ws = null;

// connect websocket
function connectWS() {
  ws = new WebSocket(`${API_CONFIG.ENDPOINTS.WS()}?user_id=${me}`);
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
  try {
    const list = await apiCall(`${API_CONFIG.ENDPOINTS.CHATS}?user_id=${me}`);
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
  } catch (error) {
    handleError(error, 'Load Chats');
  }
}
loadChats();
setInterval(loadChats, 4000);

// open chat: load history
async function openChat(uid) {
  try {
    loading.showGlobal('Loading chat history...');
    currentChat = uid;
    document.getElementById('chatHeader').innerText = 'Chat with User ' + uid;
    const msgs = await apiCall(`${API_CONFIG.ENDPOINTS.HISTORY}?user1=${me}&user2=${uid}`);
    const container = document.getElementById('messages');
    container.innerHTML = '';
    msgs.forEach(m => appendMessage(m));
    container.scrollTop = container.scrollHeight;
  } catch (error) {
    handleError(error, 'Open Chat');
  } finally {
    loading.hideGlobal();
  }
}

// append message object to UI
function appendMessage(m) {
  const container = document.getElementById('messages');
  const d = document.createElement('div');
  d.className = 'msg ' + (m.sender_id===me ? 'me' : 'other');

  if (m.is_file) {
    // fetch file info to show link
    if (m.file_id) {
      apiCall(`${API_CONFIG.ENDPOINTS.FILE}?id=${m.file_id}`)
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
  if (!currentChat) { 
    showToast('Please select a chat first', 'warning'); 
    return; 
  }
  const f = ev.target.files[0];
  if (!f) return;
  
  // Validate file size (10MB limit)
  if (f.size > 10 * 1024 * 1024) {
    showToast('File size must be less than 10MB', 'error');
    return;
  }
  
  loading.showGlobal('Uploading file...');
  const form = new FormData();
  form.append('sender_id', me);
  form.append('receiver_id', currentChat);
  form.append('file', f);

  try {
    const data = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPLOAD}`, { 
      method: 'POST', 
      body: form 
    });
    
    if (!data.ok) {
      throw new Error('File upload failed');
    }
    
    const result = await data.json();
    showToast('File uploaded successfully!', 'success');
    // server will send WS notification to both participants; chat list will refresh
    console.log('uploaded', result);
  } catch (error) {
    handleError(error, 'File Upload');
  } finally {
    loading.hideGlobal();
    // Clear file input
    ev.target.value = '';
  }
});

// helper to auto-open first chat if exists
setTimeout(async ()=> {
  const res = await apiCall(`${API_CONFIG.ENDPOINTS.CHATS}?user_id=${me}`);
  const list = await res.json();
  if (list.length && !currentChat) openChat(list[0].user_id);
}, 600);
