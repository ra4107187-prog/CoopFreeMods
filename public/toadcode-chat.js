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
  function md(src) {
    var s = esc(src);
    var parts = s.split(fence);
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        var code = parts[i].replace(/^\w*\n/, '').replace(/^\n+|\n+$/g, '');
        out += '<div class="ia-code-wrap">' +
          '<button type="button" class="ia-copy-btn" data-copy="1">Copiar código</button>' +
          '<pre><code>' + code + '</code></pre></div>';
      } else {
        var t = parts[i];
        var reInline = new RegExp(tick + '([^' + tick + ']+)' + tick, 'g');
        t = t.replace(reInline, '<code>$1</code>');
        t = t.replace(/^### (.+)$/gm, '<h4>$1</h4>');
        t = t.replace(/^## (.+)$/gm, '<h3>$1</h3>');
        t = t.replace(/^# (.+)$/gm, '<h3>$1</h3>');
        t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/^(?:- |\* )(.+)$/gm, '<li>$1</li>');
        t = t.replace(/(?:<li>[\s\S]*?<\/li>\n?)+/g, function(m){ return '<ul>' + m + '</ul>'; });
        t = t.replace(/\n\n/g, '</p><p>');
        t = t.replace(/\n/g, '<br>');
        out += t;
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
          navigator.clipboard.writeText(text).then(ok).catch(function(){
            fallbackCopy(text); ok();
          });
        } else {
          fallbackCopy(text); ok();
        }
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
