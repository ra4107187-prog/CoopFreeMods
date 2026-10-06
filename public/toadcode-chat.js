(function(){
  var chat = document.getElementById('iaChat');
  var form = document.getElementById('iaForm');
  var input = document.getElementById('iaInput');
  var send = document.getElementById('iaSend');
  if (!chat || !form) return;
  var history = [];
  var fence = String.fromCharCode(96,96,96);
  var tick = String.fromCharCode(96);

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function parseTable(block) {
    var lines = block.trim().split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
    if (lines.length < 2) return null;
    if (lines[0].indexOf('|') < 0) return null;
    var rows = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\|?[\s\-:|]+\|?$/.test(line)) continue; // separator
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
    // literal br from models
    t = t.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    t = t.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    return t;
  }

  function formatTextBlock(t) {
    // tables: consecutive lines with |
    var lines = t.split('\n');
    var out = [];
    var buf = [];
    function flushText() {
      if (!buf.length) return;
      var chunk = buf.join('\n');
      buf = [];
      // hr
      chunk = chunk.replace(/^---+$/gm, '<hr class="ia-hr">');
      chunk = chunk.replace(/^### (.+)$/gm, '<h4>$1</h4>');
      chunk = chunk.replace(/^## (.+)$/gm, '<h3>$1</h3>');
      chunk = chunk.replace(/^# (.+)$/gm, '<h3>$1</h3>');
      // numbered headers like "2. Title"
      chunk = chunk.replace(/^(\d+\.\s+.+)$/gm, '<h4>$1</h4>');
      // lists
      chunk = chunk.replace(/^(?:- |\* )(.+)$/gm, '<li>$1</li>');
      chunk = chunk.replace(/(?:<li>[\s\S]*?<\/li>\n?)+/g, function(m){ return '<ul>' + m + '</ul>'; });
      chunk = formatInline(chunk);
      chunk = chunk.replace(/\n\n+/g, '</p><p>');
      chunk = chunk.replace(/\n/g, '<br>');
      out.push('<p>' + chunk + '</p>');
    }
    function flushTable() {
      if (!buf.length) return;
      var html = parseTable(buf.join('\n'));
      buf = [];
      if (html) out.push(html);
      else {
        // wasn't a table, treat as text
        buf = [arguments[0]]; // no
      }
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
  function addUser(text) {
    var d = document.createElement('div');
    d.className = 'ia-msg user';
    d.textContent = text;
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
  }
  function addBot(text) {
    var d = document.createElement('div');
    d.className = 'ia-msg bot';
    d.innerHTML = '<div class="ia-name">🍄 ToadCode</div>' + md(text);
    chat.appendChild(d);
    bindCopy(d);
    chat.scrollTop = chat.scrollHeight;
  }
  function addSys(text) {
    var d = document.createElement('div');
    d.className = 'ia-msg sys';
    d.textContent = text;
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
    return d;
  }
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    addUser(text);
    history.push({ role: 'user', content: text });
    send.disabled = true;
    var thinking = addSys('ToadCode está pensando…');
    try {
      var res = await fetch('/api/ia-mods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-12) })
      });
      var data = await res.json();
      if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
      if (!res.ok) addBot(data.error || 'Error al consultar la IA.');
      else {
        var reply = data.reply || '(sin respuesta)';
        history.push({ role: 'assistant', content: reply });
        addBot(reply);
      }
    } catch (err) {
      if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
      addBot('No se pudo conectar con ToadCode.');
    }
    send.disabled = false;
    input.focus();
  });
})();
