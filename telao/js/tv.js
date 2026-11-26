/* Telão — TV ao vivo.
 *
 *  Lê listas M3U (o mesmo formato que o VLC abre). As listas prontas vêm do
 *  projeto IPTV-org (github.com/iptv-org/iptv), que reúne canais transmitidos
 *  de graça e publicamente na internet. Também dá para adicionar uma lista
 *  própria por endereço ou por arquivo.
 *
 *  Os canais tocam com o player do navegador (HLS nativo) ou com o hls.js.
 *  O que o navegador não consegue tocar pode ser aberto no VLC.
 */
(function () {
  'use strict';
  const T = (window.Telao = window.Telao || {});
  const store = T.store;
  const ui = () => T.ui;

  const IPTV = 'https://iptv-org.github.io/iptv/';
  const PRESETS = [
    { id: 'br', name: 'Brasil', url: IPTV + 'countries/br.m3u' },
    { id: 'pt', name: 'Em português', url: IPTV + 'languages/por.m3u' },
    { id: 'pt-pt', name: 'Portugal', url: IPTV + 'countries/pt.m3u' },
    { id: 'news', name: 'Notícias', url: IPTV + 'categories/news.m3u' },
    { id: 'kids', name: 'Infantil', url: IPTV + 'categories/kids.m3u' },
    { id: 'music', name: 'Música', url: IPTV + 'categories/music.m3u' },
    { id: 'doc', name: 'Documentários', url: IPTV + 'categories/documentary.m3u' },
    { id: 'all', name: 'Mundo todo', url: IPTV + 'index.m3u' },
  ];

  const GROUPS = {
    animation: 'Animação', auto: 'Carros', business: 'Negócios', classic: 'Clássicos', comedy: 'Comédia',
    cooking: 'Culinária', culture: 'Cultura', documentary: 'Documentários', education: 'Educação',
    entertainment: 'Entretenimento', family: 'Família', general: 'Variedades', interactive: 'Interativo',
    kids: 'Infantil', legislative: 'Legislativo', lifestyle: 'Estilo de vida', movies: 'Filmes', music: 'Música',
    news: 'Notícias', outdoor: 'Natureza', public: 'Públicos', relax: 'Relaxar', religious: 'Religiosos',
    science: 'Ciência', series: 'Séries', shop: 'Compras', sports: 'Esportes', travel: 'Viagem',
    weather: 'Clima', undefined: 'Outros', '': 'Outros',
  };
  const LABELS = { 'not 24/7': 'Nem sempre no ar', 'geo-blocked': 'Bloqueio regional' };
  const trGroup = (g) => GROUPS[String(g || '').trim().toLowerCase()] || String(g).trim();

  /* ---------------- leitura de M3U ---------------- */

  function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function splitExtinf(line) {
    // "#EXTINF:-1 tvg-id="x" group-title="A, B",Nome do canal"
    // O nome começa depois da primeira vírgula que não está entre aspas.
    let q = false;
    for (let i = 8; i < line.length; i++) {
      const c = line[i];
      if (c === '"') q = !q;
      else if (c === ',' && !q) return [line.slice(0, i), line.slice(i + 1)];
    }
    return [line, ''];
  }

  function makeChannel(cur, url) {
    let name = (cur && cur.name) || url;
    let quality = '';
    const labels = [];
    name = name.replace(/\s*\((\d{3,4}[pi])\)/i, (_, qq) => { quality = qq; return ''; });
    name = name.replace(/\s*\[([^\]]+)\]/g, (_, l) => { labels.push(LABELS[l.toLowerCase()] || l); return ''; }).trim();
    const a = (cur && cur.attrs) || {};
    const groups = String(a['group-title'] || (cur && cur.grp) || '').split(';').map(trGroup).filter(Boolean);
    const ref = (cur && cur.ref) || '';
    const ua = (cur && cur.ua) || '';
    return {
      id: hash(url),
      name: name || 'Canal sem nome',
      logo: a['tvg-logo'] || '',
      tvgId: a['tvg-id'] || '',
      group: groups[0] || 'Outros',
      quality,
      labels,
      url,
      ref,
      ua,
      needsVlc: !!(ref || ua) || !/^https?:\/\//i.test(url) || /\.(mpd|ts)(\?|$)/i.test(url),
    };
  }

  function parseM3U(text) {
    const out = [];
    const seen = new Set();
    let cur = null;
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('#EXTINF')) {
        const [head, name] = splitExtinf(line);
        const attrs = {};
        head.replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => { attrs[k.toLowerCase()] = v; });
        cur = { attrs, name: name.trim() };
      } else if (line.startsWith('#EXTVLCOPT:')) {
        cur = cur || {};
        const opt = line.slice(11);
        if (/^http-referrer=/i.test(opt)) cur.ref = opt.split('=').slice(1).join('=');
        if (/^http-user-agent=/i.test(opt)) cur.ua = opt.split('=').slice(1).join('=');
      } else if (line.startsWith('#EXTGRP:')) {
        cur = cur || {};
        cur.grp = line.slice(8);
      } else if (!line.startsWith('#')) {
        const ch = makeChannel(cur, line);
        if (!seen.has(ch.id)) { seen.add(ch.id); out.push(ch); }
        cur = null;
      }
    }
    return out;
  }

  function toM3U(chs) {
    const q = (s) => String(s || '').replace(/"/g, "'");
    return '#EXTM3U\n' + chs.map((c) =>
      `#EXTINF:-1 tvg-id="${q(c.tvgId)}" tvg-logo="${q(c.logo)}" group-title="${q(c.group)}",${c.name}\n` +
      (c.ref ? `#EXTVLCOPT:http-referrer=${c.ref}\n` : '') +
      (c.ua ? `#EXTVLCOPT:http-user-agent=${c.ua}\n` : '') +
      c.url
    ).join('\n') + '\n';
  }

  /* ---------------- listas ---------------- */

  const loaded = new Map();
  const allLists = () => PRESETS.concat(store.tvLists());

  function listInfo(id) {
    if (id === 'fav') return { id, name: 'Favoritos' };
    if (id === 'rec') return { id, name: 'Vistos por último' };
    return allLists().find((l) => l.id === id) || null;
  }

  function getList(id) {
    if (id === 'fav') return Promise.resolve(store.tvFavs());
    if (id === 'rec') return Promise.resolve(store.tvRecent());
    const l = listInfo(id);
    if (!l) return Promise.reject(Object.assign(new Error('Lista não encontrada'), { code: 'NOLIST' }));
    if (loaded.has(id)) return loaded.get(id);
    let p;
    if (l.text != null) p = Promise.resolve(parseM3U(l.text));
    else {
      p = fetch(l.url).then((r) => {
        if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
        return r.text();
      }).then((t) => {
        if (!/#EXTINF/i.test(t)) throw Object.assign(new Error('Não é M3U'), { code: 'NOTM3U' });
        return parseM3U(t);
      });
    }
    loaded.set(id, p);
    p.catch(() => loaded.delete(id));
    return p;
  }

  /* ---------------- VLC, copiar e baixar ---------------- */

  const isAndroid = () => /Android/i.test(navigator.userAgent);
  const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

  function vlcHref(ch) {
    if (isAndroid()) {
      const m = ch.url.match(/^([a-z][\w+.-]*):\/\/(.*)$/i);
      if (m) {
        return `intent://${m[2]}#Intent;scheme=${m[1]};package=org.videolan.vlc;type=video/*;` +
          `S.title=${encodeURIComponent(ch.name)};end`;
      }
    }
    if (isIOS()) return `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(ch.url)}`;
    return null;
  }

  // Dentro do app Android (window.Android), salva pelo "Salvar como" do sistema.
  // Devolve true quando o arquivo foi baixado direto pelo navegador.
  function download(name, text) {
    if (window.Android && window.Android.salvarArquivo) {
      window.aoSalvarArquivo = (ok) => ui().toast(ok ? 'Arquivo salvo. Abra ele no VLC.' : 'O arquivo não foi salvo');
      window.Android.salvarArquivo(text, name, 'audio/x-mpegurl');
      return false;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'audio/x-mpegurl' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return true;
  }

  async function copy(text) {
    if (window.Android && window.Android.copiar) {
      ui().toast(window.Android.copiar(text) ? 'Link copiado' : 'Não deu para copiar');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      ui().toast('Link copiado');
    } catch (e) {
      window.prompt('Copie o link:', text);
    }
  }

  const fileName = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').toLowerCase();

  function openInVlc(ch) {
    if (window.Android && window.Android.abrirNoVlc) {
      const r = window.Android.abrirNoVlc(ch.url, ch.name);
      if (r === 'loja') ui().toast('Instale o VLC para assistir este canal');
      return;
    }
    const h = vlcHref(ch);
    if (h) { location.href = h; return; }
    if (download(`${fileName(ch.name)}.m3u`, toM3U([ch]))) ui().toast('Arquivo baixado. Abra ele no VLC.');
  }

  /* ---------------- tela: lista de canais ---------------- */

  const PAGE = 120;

  function tileHTML(ch, listId) {
    const { esc } = ui();
    const initials = ch.name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
    return `<a class="ch" href="#/tv/ver/${encodeURIComponent(listId)}/${ch.id}" data-nav title="${esc(ch.name)}">
      <span class="chlogo">${ch.logo
        ? `<img src="${esc(ch.logo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
        : `<span class="chini">${esc(initials)}</span>`}</span>
      <span class="chtxt"><b>${esc(ch.name)}</b>
      <small>${esc([ch.group, ch.quality].filter(Boolean).join(' · '))}</small>
      ${ch.needsVlc ? '<span class="lbl vlc">Só no VLC</span>' : ch.labels.length ? `<span class="lbl">${esc(ch.labels[0])}</span>` : ''}</span>
    </a>`;
  }

  function homeRow(parent) {
    const favs = store.tvFavs();
    if (!favs.length) return;
    const s = document.createElement('section');
    s.className = 'row';
    s.innerHTML = `<div class="row-head"><h2>Seus canais</h2><a class="more" href="#/tv" data-nav>TV ao vivo</a></div>
      <div class="row-wrap"><div class="scroller chrow">${favs.map((c) => tileHTML(c, 'fav')).join('')}</div></div>`;
    parent.appendChild(s);
  }

  function renderHome(listId) {
    const U = ui();
    const { esc, icon, view } = U;
    const tok = U.newToken();
    document.title = 'TV ao vivo · Telão';
    const favs = store.tvFavs();
    const recent = store.tvRecent();
    if (!listId) listId = store.tvLastList();
    let info = listInfo(listId);
    if (!info || (listId === 'fav' && !favs.length)) { listId = 'br'; info = listInfo('br'); }
    if (listId !== 'fav' && listId !== 'rec') store.setTvLastList(listId);
    const custom = store.tvLists();

    const chip = (l, label) =>
      `<a class="chip${l.id === listId ? ' on' : ''}" href="#/tv/${encodeURIComponent(l.id)}" data-nav${l.id === listId ? ' aria-current="true"' : ''}>${label || esc(l.name)}</a>`;

    view.innerHTML = `<div class="page tvpage">
      <h1 class="ptitle">TV ao vivo</h1>
      <nav class="chips-nav" aria-label="Listas de canais">
        ${favs.length ? chip({ id: 'fav' }, `${icon('star')} Favoritos`) : ''}
        ${PRESETS.map((l) => chip(l)).join('')}
        ${custom.map((l) => chip(l)).join('')}
        <a class="chip add" href="#/tv/adicionar" data-nav>${icon('plus')} Adicionar lista</a>
      </nav>
      ${recent.length && listId !== 'rec' ? `<section class="row tvrecent"><div class="row-head"><h2>Vistos por último</h2></div>
        <div class="row-wrap"><div class="scroller chrow">${recent.map((c) => tileHTML(c, 'rec')).join('')}</div></div></section>` : ''}
      <div class="tvtools">
        <label class="filter">${icon('search')}<input type="search" placeholder="Filtrar canais" aria-label="Filtrar canais" data-nav></label>
        <select aria-label="Categoria" data-nav><option value="">Todas as categorias</option></select>
        <button class="btn ghost sm" data-tvact="dl" data-nav>${icon('download')}<span>Baixar lista (.m3u)</span></button>
        ${info.url ? `<button class="btn ghost sm" data-tvact="copylist" data-nav>${icon('copy')}<span>Copiar link da lista</span></button>` : ''}
        ${custom.some((l) => l.id === listId) ? `<button class="btn ghost sm" data-tvact="rmlist" data-nav>${icon('close')}<span>Remover lista</span></button>` : ''}
      </div>
      <p class="muted count"></p>
      <div class="chgrid"><div class="spinner"></div></div>
      <div class="loadmore"></div>

      <details class="panel vlchelp">
        <summary>Como assistir no VLC</summary>
        <ol class="steps">
          <li>Instale o <a href="https://www.videolan.org/vlc/" target="_blank" rel="noopener">VLC</a> (computador, Android, iPhone ou TV Android).</li>
          <li>No computador: <b>Mídia → Abrir fluxo de rede</b>, cole o link da lista e clique em <b>Reproduzir</b>.
            No celular: <b>Rede → Fluxo</b> e cole o mesmo link.</li>
          <li>Ou clique em <b>Baixar lista (.m3u)</b> e abra o arquivo no VLC.</li>
          <li>Dentro de um canal no Telão, o botão <b>Abrir no VLC</b> manda só aquele canal pro VLC.</li>
        </ol>
      </details>
      <p class="muted small">Listas prontas do projeto <a href="https://github.com/iptv-org/iptv" target="_blank" rel="noopener">IPTV-org</a>,
        que reúne canais transmitidos de graça e publicamente na internet. O Telão não hospeda nenhum canal.
        Alguns podem estar fora do ar ou bloqueados fora do país de origem.</p>
    </div>`;

    const grid = U.$('.chgrid', view);
    const more = U.$('.loadmore', view);
    const count = U.$('.count', view);
    const input = U.$('.filter input', view);
    const sel = U.$('.tvtools select', view);
    let all = [];
    let shown = [];
    let limit = PAGE;

    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const g = sel.value;
      shown = all.filter((c) => (!g || c.group === g) && (!q || c.name.toLowerCase().includes(q)));
      count.textContent = `${shown.length.toLocaleString('pt-BR')} ${shown.length === 1 ? 'canal' : 'canais'}`;
      grid.innerHTML = shown.length
        ? shown.slice(0, limit).map((c) => tileHTML(c, listId)).join('')
        : '<p class="muted">Nenhum canal com esse filtro.</p>';
      more.innerHTML = shown.length > limit ? `<button class="btn ghost" data-nav>Mostrar mais ${Math.min(PAGE, shown.length - limit)}</button>` : '';
      const b = U.$('button', more);
      if (b) b.addEventListener('click', () => { limit += PAGE; draw(); });
    };

    getList(listId).then((chs) => {
      if (!U.isCurrent(tok)) return;
      all = chs;
      const counts = {};
      chs.forEach((c) => { counts[c.group] = (counts[c.group] || 0) + 1; });
      sel.innerHTML += Object.keys(counts).sort((a, b) => counts[b] - counts[a])
        .map((g) => `<option value="${esc(g)}">${esc(g)} (${counts[g]})</option>`).join('');
      draw();
      let t;
      input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { limit = PAGE; draw(); }, 200); });
      sel.addEventListener('change', () => { limit = PAGE; draw(); });
    }).catch((e) => {
      if (!U.isCurrent(tok)) return;
      count.textContent = '';
      grid.innerHTML = `<div class="panel"><p><b>Não deu para abrir esta lista.</b></p><p class="muted">${
        e.code === 'NOTM3U' ? 'O endereço não devolveu uma lista M3U.'
          : info.url && !info.url.startsWith(IPTV)
            ? 'O servidor dessa lista pode não permitir leitura pelo navegador. Baixe o arquivo .m3u e use "Abrir arquivo" em Adicionar lista, ou abra o link direto no VLC.'
            : 'Confira sua conexão e tente de novo.'}</p></div>`;
    });

    view.onclick = (e) => {
      const b = e.target.closest('[data-tvact]');
      if (!b) return;
      const act = b.dataset.tvact;
      if (act === 'dl') {
        if (!all.length) return;
        if (download(`telao-${fileName(info.name)}.m3u`, toM3U(shown.length ? shown : all))) U.toast('Lista baixada. Abra no VLC.');
      }
      if (act === 'copylist') copy(info.url);
      if (act === 'rmlist' && confirm(`Remover a lista "${info.name}"?`)) {
        store.removeTvList(listId);
        loaded.delete(listId);
        store.setTvLastList('br');
        location.hash = '#/tv/br';
      }
    };
  }

  /* ---------------- tela: adicionar lista ---------------- */

  function renderAdd() {
    const U = ui();
    const { icon, view } = U;
    U.newToken();
    document.title = 'Adicionar lista · Telão';
    view.innerHTML = `<div class="page narrow">
      <a class="crumb" href="#/tv" data-nav>${icon('left')} TV ao vivo</a>
      <h1 class="ptitle">Adicionar lista de canais</h1>
      <section class="panel">
        <h2>Pelo endereço</h2>
        <p class="muted">Cole o link de uma lista M3U ou M3U8, o mesmo que você colaria no VLC.</p>
        <form class="keyform" id="addurl">
          <label for="lname">Nome da lista</label>
          <input id="lname" required maxlength="40" placeholder="Ex.: Canais da cidade" data-nav>
          <label for="lurl" style="margin-top:14px">Endereço (link)</label>
          <input id="lurl" type="url" required placeholder="https://…/lista.m3u" data-nav>
          <div class="actions"><button class="btn primary" type="submit" data-nav>Adicionar</button></div>
          <p class="status" role="status"></p>
        </form>
      </section>
      <section class="panel">
        <h2>Por arquivo</h2>
        <p class="muted">Escolha um arquivo .m3u salvo no aparelho.</p>
        <form class="keyform" id="addfile">
          ${window.Android && window.Android.abrirArquivo
            ? `<button class="btn ghost" type="button" id="lpick" data-nav>${icon('download')}<span>Escolher arquivo</span></button>`
            : '<input id="lfile" type="file" accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain" data-nav>'}
          <p class="status" role="status"></p>
        </form>
      </section>
      <p class="muted small">Use só listas de canais que você tem direito de assistir.</p>
    </div>`;

    const finish = (list, statusEl) => {
      const saved = store.addTvList(list);
      if (!saved && list.text != null) {
        // Grande demais para guardar: fica só até fechar o app.
        statusEl.textContent = 'A lista é grande demais para ficar salva; ela fica disponível até você fechar o Telão.';
      }
      location.hash = `#/tv/${encodeURIComponent(list.id)}`;
    };

    U.$('#addurl', view).addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = U.$('#lname', view).value.trim();
      const url = U.$('#lurl', view).value.trim();
      const st = U.$('#addurl .status', view);
      st.textContent = 'Abrindo a lista…';
      const list = { id: 'u' + Date.now().toString(36), name, url };
      try {
        const r = await fetch(url);
        const t = await r.text();
        if (!/#EXTINF/i.test(t)) { st.textContent = 'Esse endereço não parece ser uma lista M3U.'; return; }
        loaded.set(list.id, Promise.resolve(parseM3U(t)));
        finish(list, st);
      } catch (err) {
        st.textContent = 'O navegador não conseguiu ler esse endereço (o servidor pode bloquear). ' +
          'Baixe o arquivo e use a opção "Por arquivo", ou abra o link direto no VLC.';
      }
    });

    const st = U.$('#addfile .status', view);
    const fromText = (text, name) => {
      text = String(text || '');
      if (!/#EXTINF/i.test(text)) { st.textContent = 'Esse arquivo não parece ser uma lista M3U.'; return; }
      const list = { id: 'f' + Date.now().toString(36), name, text };
      loaded.set(list.id, Promise.resolve(parseM3U(text)));
      finish(list, st);
    };
    const pick = U.$('#lpick', view);
    if (pick) {
      // App Android: o seletor de arquivos vem do sistema, pela ponte.
      pick.addEventListener('click', () => {
        window.aoAbrirArquivo = () => fromText(window.Android.pegarArquivoAberto(), 'Lista do aparelho');
        window.Android.abrirArquivo();
      });
    } else {
      U.$('#lfile', view).addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => fromText(rd.result, f.name.replace(/\.m3u8?$/i, ''));
        rd.readAsText(f);
      });
    }
  }

  /* ---------------- tela: assistir canal ---------------- */

  let hls = null;
  let watchdog = null;
  let liveVideo = null;

  function stop() {
    clearTimeout(watchdog);
    if (hls) { try { hls.destroy(); } catch (e) { /* ignora */ } hls = null; }
    if (liveVideo) {
      liveVideo.onplaying = liveVideo.onerror = liveVideo.onpause = null;
      liveVideo.pause();
      liveVideo.removeAttribute('src');
      try { liveVideo.load(); } catch (e) { /* ignora */ }
      liveVideo = null;
    }
  }

  const MSGS = {
    vlc: 'Este canal precisa de ajustes que o navegador não permite (endereço ou cabeçalhos especiais). Ele funciona no VLC.',
    mixed: 'Este canal só transmite por http, que o navegador bloqueia quando o Telão está num site https. Abra no VLC ou use o Telão aberto direto do arquivo.',
    error: 'O canal não respondeu. Ele pode estar fora do ar, bloqueado fora do país de origem ou não liberar a reprodução no navegador. Tente no VLC.',
  };

  function play(video, ch, tok, view) {
    const U = ui();
    stop();
    liveVideo = video;
    const msg = U.$('.live-msg', view);
    const load = U.$('.live-loading', view);
    const fail = (kind) => {
      if (!U.isCurrent(tok)) return;
      stop();
      load.hidden = true;
      msg.hidden = false;
      msg.innerHTML = `<p>${MSGS[kind] || MSGS.error}</p>
        <div class="actions"><button class="btn primary" data-liveact="vlc" data-nav>${U.icon('ext')}<span>Abrir no VLC</span></button>
        <button class="btn ghost" data-liveact="next" data-nav>${U.icon('next')}<span>Próximo canal</span></button></div>`;
    };
    if (ch.needsVlc) return fail('vlc');

    let url = ch.url;
    const mixed = location.protocol === 'https:' && /^http:/i.test(url);
    if (mixed) url = 'https:' + url.slice(5); // tenta a versão segura do mesmo endereço
    const direct = /\.(mp4|webm|ogv|mp3|aac|m4a)(\?|$)/i.test(url);
    const native = !!video.canPlayType('application/vnd.apple.mpegurl');
    const hlsOk = !!(window.Hls && window.Hls.isSupported());
    const attempts = direct ? ['direct'] : native ? ['native'].concat(hlsOk ? ['hls'] : []) : hlsOk ? ['hls', 'native'] : ['native'];
    let i = 0;

    const next = () => {
      if (!U.isCurrent(tok)) return;
      clearTimeout(watchdog);
      if (hls) { try { hls.destroy(); } catch (e) { /* ignora */ } hls = null; }
      const a = attempts[i++];
      if (!a) return fail(mixed ? 'mixed' : 'error');
      video.removeAttribute('src');
      watchdog = setTimeout(next, 20000);
      if (a === 'hls') {
        hls = new window.Hls({ maxBufferLength: 20, liveDurationInfinity: true, manifestLoadingMaxRetry: 1, levelLoadingMaxRetry: 2 });
        hls.on(window.Hls.Events.ERROR, (_, d) => { if (d.fatal) next(); });
        hls.loadSource(url);
        hls.attachMedia(video);
      } else {
        video.src = url;
      }
      const p = video.play();
      if (p && p.catch) {
        p.catch((err) => {
          if (err && err.name === 'NotAllowedError' && U.isCurrent(tok)) {
            // O navegador quer um toque antes de tocar com som.
            clearTimeout(watchdog);
            load.hidden = true;
            msg.hidden = false;
            msg.innerHTML = `<button class="btn primary" data-liveact="tap" data-nav>${U.icon('play')}<span>Toque para assistir</span></button>`;
          }
        });
      }
    };

    video.onpause = () => U.keepAwake(false);
    video.onplaying = () => {
      U.keepAwake(true);
      clearTimeout(watchdog);
      load.hidden = true;
      msg.hidden = true;
    };
    video.onerror = () => { if (!hls) next(); };
    next();
  }

  async function renderPlayer(listId, chId) {
    const U = ui();
    const { esc, icon, view } = U;
    const tok = U.newToken();
    document.body.classList.add('is-live');
    view.innerHTML = '<div class="page"><div class="spinner"></div></div>';

    let chs;
    try {
      chs = await getList(listId);
    } catch (e) {
      if (!U.isCurrent(tok)) return;
      view.innerHTML = '<div class="page narrow empty"><h1>Lista indisponível</h1><p>Não deu para abrir esta lista de canais.</p><p><a class="btn ghost" href="#/tv" data-nav>Voltar</a></p></div>';
      return;
    }
    if (!U.isCurrent(tok)) return;
    const idx = chs.findIndex((c) => c.id === chId);
    if (idx < 0) {
      view.innerHTML = '<div class="page narrow empty"><h1>Canal não encontrado</h1><p>Ele pode ter saído da lista.</p><p><a class="btn ghost" href="#/tv" data-nav>Ver canais</a></p></div>';
      return;
    }
    const ch = chs[idx];
    document.title = ch.name + ' · TV ao vivo · Telão';
    store.pushTvRecent(ch);
    const fav = store.isTvFav(ch);
    const vlc = vlcHref(ch) ? 'Abrir no VLC' : 'Baixar para o VLC';

    // Em listas enormes, mostra só uma janela de canais em volta do atual.
    const from = chs.length > 600 ? Math.max(0, idx - 200) : 0;
    const side = chs.slice(from, from + 600);
    const base = `#/tv/ver/${encodeURIComponent(listId)}/`;

    view.innerHTML = `<div class="live">
      <div class="live-main">
        <div class="live-video">
          <video controls playsinline autoplay></video>
          <div class="live-loading"><div class="spinner"></div></div>
          <div class="live-msg" hidden></div>
          <span class="onair">AO VIVO</span>
        </div>
        <div class="live-bar">
          <a class="iconbtn" href="#/tv/${encodeURIComponent(listId === 'rec' || listId === 'fav' ? '' : listId)}" data-nav aria-label="Voltar para os canais">${icon('back')}</a>
          <span class="chlogo sm">${ch.logo ? `<img src="${esc(ch.logo)}" alt="" referrerpolicy="no-referrer">` : ''}</span>
          <div class="live-title"><h1>${esc(ch.name)}</h1>
            <small>${esc([ch.group, ch.quality].concat(ch.labels).filter(Boolean).join(' · '))}</small></div>
        </div>
        <div class="actions live-actions">
          <button class="btn ghost" data-liveact="prev" data-nav aria-label="Canal anterior">${icon('prev')}<span>Anterior</span></button>
          <button class="btn ghost" data-liveact="next" data-nav aria-label="Próximo canal">${icon('next')}<span>Próximo</span></button>
          <button class="btn ghost" data-liveact="fav" data-nav aria-pressed="${fav}">${icon(fav ? 'star' : 'starO')}<span>${fav ? 'Favorito' : 'Favoritar'}</span></button>
          <button class="btn ghost" data-liveact="vlc" data-nav>${icon('ext')}<span>${vlc}</span></button>
          <button class="btn ghost" data-liveact="copy" data-nav>${icon('copy')}<span>Copiar link</span></button>
        </div>
      </div>
      <aside class="live-list" aria-label="Outros canais">
        <label class="filter">${icon('search')}<input type="search" placeholder="Trocar de canal" aria-label="Procurar canal" data-nav></label>
        <div class="zap">${side.map((c) => `<a href="${base}${c.id}" data-nav data-zap class="${c.id === ch.id ? 'on' : ''}"${c.id === ch.id ? ' aria-current="true"' : ''}>
          <span class="chlogo xs">${c.logo ? `<img src="${esc(c.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>
          <span><b>${esc(c.name)}</b><small>${esc(c.group)}</small></span></a>`).join('')}</div>
      </aside>
    </div>`;

    const video = U.$('video', view);
    const zap = (d) => {
      const n = chs[(idx + d + chs.length) % chs.length];
      if (n) location.replace(base + n.id);
    };

    const cur = U.$('.zap .on', view);
    if (cur) cur.scrollIntoView({ block: 'center' });
    window.scrollTo(0, 0);

    const filter = U.$('.live-list input', view);
    filter.addEventListener('input', () => {
      const q = filter.value.trim().toLowerCase();
      view.querySelectorAll('[data-zap]').forEach((a) => {
        a.hidden = !!q && !a.textContent.toLowerCase().includes(q);
      });
    });

    view.onclick = (e) => {
      const z = e.target.closest('[data-zap]');
      if (z) { e.preventDefault(); location.replace(z.getAttribute('href')); return; }
      const b = e.target.closest('[data-liveact]');
      if (!b) return;
      const act = b.dataset.liveact;
      if (act === 'prev') zap(-1);
      if (act === 'next') zap(1);
      if (act === 'vlc') openInVlc(ch);
      if (act === 'copy') copy(ch.url);
      if (act === 'tap') { U.$('.live-msg', view).hidden = true; play(video, ch, tok, view); }
      if (act === 'fav') {
        const on = store.toggleTvFav(ch);
        b.setAttribute('aria-pressed', String(on));
        b.innerHTML = `${icon(on ? 'star' : 'starO')}<span>${on ? 'Favorito' : 'Favoritar'}</span>`;
        U.toast(on ? 'Canal salvo nos favoritos' : 'Canal removido dos favoritos');
      }
    };
    T.tv.zap = zap;
    play(video, ch, tok, view);
  }

  // Botões de canal do controle remoto (e PageUp/PageDown no teclado).
  document.addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('is-live') || !T.tv.zap) return;
    const a = document.activeElement;
    if (a && a.tagName === 'INPUT') return;
    if (e.key === 'ChannelUp' || e.key === 'PageUp' || e.keyCode === 427) { e.preventDefault(); T.tv.zap(-1); }
    if (e.key === 'ChannelDown' || e.key === 'PageDown' || e.keyCode === 428) { e.preventDefault(); T.tv.zap(1); }
  });

  T.tv = {
    home: renderHome,
    add: renderAdd,
    player: renderPlayer,
    homeRow,
    stop() { stop(); T.tv.zap = null; document.body.classList.remove('is-live'); },
    parseM3U, // exposto para testes
    zap: null,
  };
})();
