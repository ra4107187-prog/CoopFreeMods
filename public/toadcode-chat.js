(function(){
  var chat = document.getElementById('iaChat');
  var form = document.getElementById('iaForm');
  var input = document.getElementById('iaInput');
  var send = document.getElementById('iaSend');
  var fileInput = document.getElementById('iaFile');
  var attachList = document.getElementById('iaAttachList');
  var clearMem = document.getElementById('iaClearMem');
  var histList = document.getElementById('iaHistoryList');
  var newChatBtn = document.getElementById('iaNewChat');
  if (!chat || !form) return;

  var SESS_KEY = 'cfm_toadcode_sessions';
  var CUR_KEY = 'cfm_toadcode_current';
  var history = [];
  var sessionId = null;
  var sessions = [];
  var pendingFiles = [];
  var fence = String.fromCharCode(96,96,96);
  var tick = String.fromCharCode(96);

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function loadSessions() {
    try {
      sessions = JSON.parse(localStorage.getItem(SESS_KEY) || '[]');
      if (!Array.isArray(sessions)) sessions = [];
    } catch (e) { sessions = []; }
  }
  function saveSessions() {
    try {
      // keep last 30 sessions
      sessions = sessions.slice(0, 30);
      localStorage.setItem(SESS_KEY, JSON.stringify(sessions));
      localStorage.setItem(CUR_KEY, sessionId || '');
    } catch (e) {}
  }
  function titleFromHistory(h) {
    var u = (h || []).find(function(m){ return m.role === 'user'; });
    var t = u ? String(u.content).replace(/\s+/g, ' ').trim() : 'Chat nuevo';
    if (t.length > 42) t = t.slice(0, 42) + '…';
    return t || 'Chat nuevo';
  }
  function persistCurrent() {
    if (!sessionId) return;
    var idx = sessions.findIndex(function(s){ return s.id === sessionId; });
    var entry = {
      id: sessionId,
      title: titleFromHistory(history),
      updated: Date.now(),
      messages: history.slice(-40)
    };
    if (idx >= 0) sessions[idx] = entry;
    else sessions.unshift(entry);
    sessions.sort(function(a, b){ return (b.updated || 0) - (a.updated || 0); });
    saveSessions();
    renderHistoryList();
  }
  function renderHistoryList() {
    if (!histList) return;
    if (!sessions.length) {
      histList.innerHTML = '<p style="color:#6b7280;font-size:11px;margin:0;">Sin chats guardados</p>';
      return;
    }
    histList.innerHTML = sessions.map(function(s) {
      var active = s.id === sessionId ? ' active' : '';
      var d = '';
      try { d = new Date(s.updated).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch(e) {}
      return '<button type="button" class="ia-hist-item' + active + '" data-id="' + esc(s.id) + '">' +
        esc(s.title || 'Chat') +
        '<span class="ia-hist-date">' + esc(d) + '</span></button>';
    }).join('');
    histList.querySelectorAll('.ia-hist-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        openSession(btn.getAttribute('data-id'));
      });
    });
  }
  function clearChatDom() {
    chat.innerHTML = '';
  }
  function openSession(id) {
    var s = sessions.find(function(x){ return x.id === id; });
    if (!s) return;
    sessionId = id;
    history = (s.messages || []).slice();
    clearChatDom();
    if (!history.length) {
      addSys('¡Hola! Soy ToadCode. Preguntame por Lua, mods, o por la web.');
    } else {
      history.forEach(function(m) {
        if (m.role === 'user') addUser(m.content, true);
        else if (m.role === 'assistant') addBot(m.content, true);
      });
      addSys('Chat restaurado del historial.');
    }
    saveSessions();
    renderHistoryList();
    chat.scrollTop = chat.scrollHeight;
  }
  function startNewChat() {
    sessionId = 's' + Date.now();
    history = [];
    clearChatDom();
    addSys('¡Hola! Soy ToadCode. Preguntame por Lua, mods, o por la web.');
    sessions.unshift({ id: sessionId, title: 'Chat nuevo', updated: Date.now(), messages: [] });
    saveSessions();
    renderHistoryList();
  }

  function parseTable(block) {
    var lines = block.trim().split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
    if (lines.length < 2) return null;
    if (lines[0].indexOf('|') < 0) return null;
    var rows = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\|?[\s\-:|]+\|?$/.test(line)) continue;
      var cells = line.split('|');
      if (cells[0].trim() === '') cells.shift();
      if (cells.length && cells[cells.length-1].trim() === '') cells.pop();
      if (!cells.length) continue;
      rows.push(cells.map(function(c){ return c.trim(); }));
    }
    if (rows.length < 1) return null;
    var html = '<div class="ia-table-wrap"><table>';
    rows.forEach(function(cells, ri) {
      html += '<tr>';
      cells.forEach(function(c) {
        var tag = ri === 0 ? 'th' : 'td';
        html += '<' + tag + '>' + formatInline(c) + '</' + tag + '>';
      });
      html += '</tr>';
    });
    html += '</table></div>';
    return html;
  }
  function formatInline(t) {
    var reInline = new RegExp(tick + '([^' + tick + ']+)' + tick, 'g');
    t = t.replace(reInline, '<code>$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    t = t.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    return t;
  }
  function formatTextBlock(t) {
    var lines = t.split('\n');
    var out = [];
    var buf = [];
    function flushText() {
      if (!buf.length) return;
      var chunk = buf.join('\n');
      buf = [];
      chunk = chunk.replace(/^---+$/gm, '<hr class="ia-hr">');
      chunk = chunk.replace(/^### (.+)$/gm, '<h4>$1</h4>');
      chunk = chunk.replace(/^## (.+)$/gm, '<h3>$1</h3>');
      chunk = chunk.replace(/^# (.+)$/gm, '<h3>$1</h3>');
      chunk = chunk.replace(/^(\d+\.\s+.+)$/gm, '<h4>$1</h4>');
      chunk = chunk.replace(/^(?:- |\* )(.+)$/gm, '<li>$1</li>');
      chunk = chunk.replace(/(?:<li>[\s\S]*?<\/li>\n?)+/g, function(m){ return '<ul>' + m + '</ul>'; });
      chunk = formatInline(chunk);
      chunk = chunk.replace(/\n\n+/g, '</p><p>');
      chunk = chunk.replace(/\n/g, '<br>');
      out.push('<p>' + chunk + '</p>');
    }
    var mode = 'text';
    var tableBuf = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var isTableLine = line.indexOf('|') >= 0 && (line.match(/\|/g) || []).length >= 2;
      if (isTableLine) {
        if (mode === 'text') { flushText(); mode = 'table'; tableBuf = []; }
        tableBuf.push(line);
      } else {
        if (mode === 'table') {
          var th = parseTable(tableBuf.join('\n'));
          if (th) out.push(th);
          else buf = buf.concat(tableBuf);
          tableBuf = [];
          mode = 'text';
        }
        buf.push(line);
      }
    }
    if (mode === 'table' && tableBuf.length) {
      var th2 = parseTable(tableBuf.join('\n'));
      if (th2) out.push(th2);
      else buf = buf.concat(tableBuf);
    }
    flushText();
    return out.join('');
  }
  function md(src) {
    var s = esc(src);
    var parts = s.split(fence);
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        var code = parts[i].replace(/^\w*\n/, '').replace(/^\n+|\n+$/g, '');
        out += '<div class="ia-code-wrap">' +
          '<button type="button" class="ia-copy-btn">Copiar código</button>' +
          '<pre><code>' + code + '</code></pre></div>';
      } else {
        out += formatTextBlock(parts[i]);
      }
    }
    return out;
  }
  function bindCopy(root) {
    var btns = root.querySelectorAll('.ia-copy-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function() {
        var btn = this;
        var pre = btn.parentNode && btn.parentNode.querySelector('code');
        var text = pre ? pre.textContent : '';
        function ok() {
          var old = btn.textContent;
          btn.textContent = '¡Copiado!';
          btn.classList.add('copied');
          setTimeout(function(){ btn.textContent = old; btn.classList.remove('copied'); }, 1500);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(ok).catch(function(){ fallbackCopy(text); ok(); });
        } else { fallbackCopy(text); ok(); }
      });
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
  function addUser(text, skipScroll) {
    var d = document.createElement('div');
    d.className = 'ia-msg user';
    d.textContent = text.length > 2000 ? text.slice(0, 2000) + '…' : text;
    chat.appendChild(d);
    if (!skipScroll) chat.scrollTop = chat.scrollHeight;
  }
  function addBot(text, skipScroll) {
    var d = document.createElement('div');
    d.className = 'ia-msg bot';
    d.innerHTML = '<div class="ia-name">🍄 ToadCode</div>' + md(text);
    chat.appendChild(d);
    bindCopy(d);
    if (!skipScroll) chat.scrollTop = chat.scrollHeight;
  }
  function addSys(text) {
    var d = document.createElement('div');
    d.className = 'ia-msg sys';
    d.textContent = text;
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
    return d;
  }
  function renderAttachList() {
    if (!attachList) return;
    if (!pendingFiles.length) {
      attachList.style.display = 'none';
      attachList.innerHTML = '';
      return;
    }
    attachList.style.display = 'flex';
    attachList.innerHTML = pendingFiles.map(function(f, idx) {
      return '<span style="background:#1f2937;border:1px solid #374151;border-radius:999px;padding:4px 10px;font-size:12px;color:#e5e7eb;">' +
        esc(f.name) + ' <button type="button" data-rm="' + idx + '" style="background:none;border:none;color:#f87171;cursor:pointer;font-weight:bold;">×</button></span>';
    }).join('');
    attachList.querySelectorAll('[data-rm]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        pendingFiles.splice(parseInt(btn.getAttribute('data-rm'), 10), 1);
        renderAttachList();
      });
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      var files = Array.prototype.slice.call(fileInput.files || []);
      fileInput.value = '';
      files.forEach(function(file) {
        if (file.size > 80 * 1024) {
          addSys('"' + file.name + '" es muy grande (máx. 80 KB).');
          return;
        }
        var reader = new FileReader();
        reader.onload = function() {
          var text = String(reader.result || '');
          if (text.indexOf('\0') >= 0) {
            addSys('"' + file.name + '" parece binario; solo texto/Lua.');
            return;
          }
          pendingFiles.push({ name: file.name, content: text.slice(0, 60000) });
          renderAttachList();
        };
        reader.readAsText(file);
      });
    });
  }
  if (clearMem) {
    clearMem.addEventListener('click', function() {
      if (sessionId) {
        sessions = sessions.filter(function(s){ return s.id !== sessionId; });
        saveSessions();
      }
      startNewChat();
      addSys('Chat actual borrado del historial.');
    });
  }
  if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var text = (input.value || '').trim();
    if (!text && !pendingFiles.length) return;
    if (!sessionId) {
      sessionId = 's' + Date.now();
    }
    var payload = text;
    if (pendingFiles.length) {
      var parts = pendingFiles.map(function(f) {
        return '--- Archivo: ' + f.name + ' ---\n' + f.content;
      });
      payload = (text ? text + '\n\n' : '') + parts.join('\n\n');
    }
    input.value = '';
    pendingFiles = [];
    renderAttachList();
    addUser(payload);
    history.push({ role: 'user', content: payload });
    persistCurrent();
    send.disabled = true;
    var thinking = addSys('ToadCode está pensando…');
    try {
      var res = await fetch('/api/ia-mods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-16) })
      });
      var data = await res.json();
      if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
      if (!res.ok) addBot(data.error || 'Error al consultar la IA.');
      else {
        var reply = data.reply || '(sin respuesta)';
        history.push({ role: 'assistant', content: reply });
        persistCurrent();
        addBot(reply);
      }
    } catch (err) {
      if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
      addBot('No se pudo conectar con ToadCode.');
    }
    send.disabled = false;
    input.focus();
  });

  // init
  loadSessions();
  // migrate old single history if any
  try {
    var old = localStorage.getItem('cfm_toadcode_history');
    if (old && !sessions.length) {
      var arr = JSON.parse(old);
      if (Array.isArray(arr) && arr.length) {
        sessions.push({
          id: 's' + Date.now(),
          title: titleFromHistory(arr),
          updated: Date.now(),
          messages: arr
        });
        saveSessions();
        localStorage.removeItem('cfm_toadcode_history');
      }
    }
  } catch (e) {}

  var cur = null;
  try { cur = localStorage.getItem(CUR_KEY); } catch (e) {}
  if (cur && sessions.some(function(s){ return s.id === cur; })) {
    openSession(cur);
  } else if (sessions.length) {
    openSession(sessions[0].id);
  } else {
    startNewChat();
  }
})();
