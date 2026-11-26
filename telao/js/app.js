/* Telão — telas, navegação e player. */
(function () {
  'use strict';
  const T = window.Telao;
  const api = T.api;
  const store = T.store;

  const $ = (s, r) => (r || document).querySelector(s);
  const view = $('#view');
  let renderToken = 0;
  let heroTimer = null;
  let rowObserver = null;

  // Executa fn só quando o elemento chega perto da tela (economiza dados e deixa o início mais rápido).
  function lazy(el, fn) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    if (!rowObserver) {
      rowObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          rowObserver.unobserve(e.target);
          const f = e.target._lazy;
          e.target._lazy = null;
          if (f) f();
        });
      }, { rootMargin: '700px 0px' });
    }
    el._lazy = fn;
    rowObserver.observe(el);
  }

  /* ---------------- utilidades ---------------- */

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

  const ICONS = {
    play: '<path d="M8 5v14l11-7z"/>',
    plus: '<path d="M11 5h2v14h-2zM5 11h14v2H5z"/>',
    check: '<path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>',
    info: '<path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/>',
    back: '<path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/>',
    left: '<path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/>',
    right: '<path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/>',
    star: '<path d="M12 17.3 18.2 21l-1.6-7L22 9.2l-7.2-.6L12 2 9.2 8.6 2 9.2 7.5 14l-1.7 7z"/>',
    close: '<path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/>',
    ext: '<path d="M14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2z"/>',
    starO: '<path d="M22 9.2l-7.2-.6L12 2 9.2 8.6 2 9.2 7.5 14l-1.7 7L12 17.3 18.2 21l-1.6-7zM12 15.4l-3.8 2.3 1-4.3-3.3-2.9 4.4-.4L12 6.1l1.7 4 4.4.4-3.3 2.9 1 4.3z"/>',
    copy: '<path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z"/>',
    download: '<path d="M5 20h14v-2H5zM19 9h-4V3H9v6H5l7 7z"/>',
    prev: '<path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>',
    next: '<path d="M6 18l8.5-6L6 6zm10-12v12h2V6z"/>',
    search: '<path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/>',
  };
  const icon = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

  function fmtMin(m) {
    if (!m) return '';
    const h = Math.floor(m / 60);
    return h ? `${h}h ${m % 60}min` : `${m}min`;
  }

  function fmtTime(s) {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  }

  // Dentro do app Android, mantém a tela acesa enquanto um vídeo toca.
  function keepAwake(on) {
    try { if (window.Android && window.Android.manterTelaLigada) window.Android.manterTelaLigada(!!on); } catch (e) { /* ignora */ }
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // Guarda os itens desenhados na tela para os botões "Minha lista" e trailer.
  const registry = new Map();
  function reg(it) {
    const k = store.keyOf(it);
    registry.set(k, it);
    return k;
  }

  const hrefOf = (it) =>
    it.src === 'ia' ? `#/t/ia/${encodeURIComponent(it.id)}` : `#/t/tmdb/${it.type}/${it.id}`;

  /* ---------------- componentes ---------------- */

  function cardHTML(it, opts) {
    const o = opts || {};
    const href = o.href || hrefOf(it);
    // Capas do TMDB: versão menor no celular, maior em telas grandes.
    const srcset = it.poster && it.poster.includes('/w342/')
      ? ` srcset="${esc(it.poster.replace('/w342/', '/w185/'))} 185w, ${esc(it.poster)} 342w" sizes="(max-width: 860px) 34vw, 190px"`
      : '';
    const img = it.poster
      ? `<img src="${esc(it.poster)}"${srcset} alt="" loading="lazy" decoding="async">`
      : `<span class="noimg">${esc(it.title)}</span>`;
    let badge = '';
    if (it.src === 'ia') badge = '<span class="badge">Grátis aqui</span>';
    else if (it.type === 'tv' && !o.noBadge) badge = '<span class="badge alt">Série</span>';
    const bar = o.progress
      ? `<span class="pbar"><i style="width:${Math.round(Math.min(1, o.progress) * 100)}%"></i></span>`
      : '';
    const rate = it.rating && !o.progress ? `<span class="rate">${icon('star')}${it.rating.toFixed(1)}</span>` : '';
    const sub = o.sub || [it.year, (it.genres || []).slice(0, 2).join(', ')].filter(Boolean).join(' • ');
    return `<a class="card" href="${href}" data-nav title="${esc(it.title)}">
      <span class="poster">${img}${badge}${rate}${bar}</span>
      <span class="cap"><b>${esc(it.title)}</b><small>${esc(sub)}</small></span>
    </a>`;
  }

  const skeleton = (n) =>
    Array.from({ length: n }, () => '<span class="card sk"><span class="poster"></span><span class="cap"><b></b></span></span>').join('');

  function rowEl(title, opts) {
    const o = opts || {};
    const s = document.createElement('section');
    s.className = 'row';
    s.innerHTML = `<div class="row-head"><h2>${esc(title)}</h2>${
      o.more ? `<a class="more" href="${o.more}" data-nav>Ver tudo ${icon('right')}</a>` : ''
    }</div>
    <div class="row-wrap">
      <button class="arrow l" tabindex="-1" aria-label="Voltar">${icon('left')}</button>
      <div class="scroller">${skeleton(8)}</div>
      <button class="arrow r" tabindex="-1" aria-label="Avançar">${icon('right')}</button>
    </div>`;
    return s;
  }

  // Cria a fileira na hora (para manter a ordem) e preenche quando os dados chegam.
  // Se der erro ou vier vazia, a fileira some.
  function asyncRow(parent, title, loader, opts) {
    const s = rowEl(title, opts);
    parent.appendChild(s);
    const tok = renderToken;
    lazy(s, () => Promise.resolve()
      .then(loader)
      .then((items) => {
        if (tok !== renderToken) return;
        items = (items || []).filter(Boolean);
        if (!items.length) return s.remove();
        s.querySelector('.scroller').innerHTML = items.map((i) => cardHTML(i)).join('');
      })
      .catch((e) => {
        if (tok !== renderToken) return;
        console.warn(`Fileira "${title}":`, e);
        s.remove();
      }));
    return s;
  }

  function listBtn(it) {
    const on = store.inList(it);
    return `<button class="btn ghost" data-list="${esc(reg(it))}" data-nav aria-pressed="${on}">
      ${icon(on ? 'check' : 'plus')}<span>${on ? 'Na minha lista' : 'Minha lista'}</span></button>`;
  }

  function keyBanner(invalid) {
    const b = document.createElement('div');
    b.className = 'banner';
    b.innerHTML = invalid
      ? `<div><h2>A chave do TMDB não funcionou</h2>
          <p>O TMDB recusou a chave salva. Confira se copiou ela inteira em Configurações.</p></div>
         <a class="btn primary" href="#/config" data-nav>Abrir configurações</a>`
      : `<div><h2>Libere o catálogo completo</h2>
          <p>Com uma chave gratuita do TMDB, o Telão mostra praticamente todos os filmes e séries,
          com trailers e em qual serviço cada um passa no Brasil. Leva uns 2 minutos.</p></div>
         <a class="btn primary" href="#/config" data-nav>Conectar o TMDB</a>`;
    return b;
  }

  function continueRow(parent) {
    const list = store.progressList().filter((p) => p.item);
    if (!list.length) return;
    const s = rowEl('Continuar assistindo');
    s.querySelector('.scroller').innerHTML = list
      .map((p) =>
        cardHTML(p.item, {
          href: `#/assistir/${encodeURIComponent(p.item.id)}/${p.part || 0}`,
          progress: p.d ? p.t / p.d : 0,
          sub: `Parou em ${fmtTime(p.t)}`,
        })
      )
      .join('');
    parent.appendChild(s);
  }

  const loadingHTML = () => '<div class="page"><div class="spinner" aria-label="Carregando"></div></div>';

  function errorHTML(msg, extra) {
    return `<div class="page narrow empty"><h1>Algo deu errado</h1><p>${esc(msg)}</p>${extra || ''}
      <p><a class="btn ghost" href="#/" data-nav>Voltar ao início</a></p></div>`;
  }

  /* ---------------- destaque (hero) ---------------- */

  function heroHTML(it) {
    const isIa = it.src === 'ia';
    const actions = isIa
      ? `<a class="btn primary" href="#/assistir/${encodeURIComponent(it.id)}" data-nav>${icon('play')}<span>Assistir</span></a>
         <a class="btn ghost" href="${hrefOf(it)}" data-nav>${icon('info')}<span>Detalhes</span></a>`
      : `<a class="btn primary" href="${hrefOf(it)}" data-nav>${icon('info')}<span>Mais informações</span></a>
         <button class="btn ghost" data-trailer="${esc(reg(it))}" data-nav>${icon('play')}<span>Trailer</span></button>`;
    const tag = `<div class="hmeta">
        <span class="htype${isIa ? ' free' : ''}">${isIa ? 'Filme completo, grátis' : it.type === 'tv' ? 'Série' : 'Filme'}</span>
        ${it.year ? `<span>${esc(it.year)}</span>` : ''}
        ${it.rating ? `<span class="hrate">${icon('star')} ${it.rating.toFixed(1)}</span>` : ''}
        ${(it.genres || []).length ? `<span class="hgen">${esc(it.genres.join(' • '))}</span>` : ''}
      </div>`;
    return `<div class="hero-bg${isIa ? ' soft' : ''}" style="background-image:url('${esc(it.backdrop)}')"></div>
      ${isIa ? `<img class="hero-poster" src="${esc(it.poster)}" alt="">` : ''}
      <div class="hero-content">
        ${tag}
        <h1>${esc(it.title)}</h1>
        <p class="hero-ov">${esc(it.overview)}</p>
        <div class="actions">${actions}</div>
      </div>`;
  }

  function mountHero(slot, items) {
    const tok = renderToken;
    items = items.filter((i) => i && i.backdrop).slice(0, 6);
    if (!items.length) return slot.remove();
    const hero = document.createElement('section');
    hero.className = 'hero';
    hero.setAttribute('aria-label', 'Destaque');
    slot.replaceWith(hero);
    let i = 0;
    const draw = () => {
      hero.innerHTML =
        heroHTML(items[i]) +
        (items.length > 1
          ? `<button class="harrow l" data-hero="-1" tabindex="-1" aria-label="Destaque anterior">${icon('left')}</button>
             <button class="harrow r" data-hero="1" tabindex="-1" aria-label="Próximo destaque">${icon('right')}</button>
             <div class="dots">${items.map((_, j) => `<button class="${j === i ? 'on' : ''}" data-dot="${j}" tabindex="-1" aria-label="Destaque ${j + 1}"></button>`).join('')}</div>`
          : '');
    };
    draw();
    hero.addEventListener('click', (e) => {
      const a = e.target.closest('[data-hero],[data-dot]');
      if (!a) return;
      i = a.dataset.dot != null ? +a.dataset.dot : (i + +a.dataset.hero + items.length) % items.length;
      draw();
    });
    clearInterval(heroTimer);
    if (items.length > 1) {
      heroTimer = setInterval(() => {
        if (tok !== renderToken) return clearInterval(heroTimer);
        // Não troca o destaque enquanto a pessoa está nele.
        if (hero.matches(':hover') || hero.contains(document.activeElement)) return;
        i = (i + 1) % items.length;
        draw();
      }, 9000);
    }
  }

  function heroSlot(parent) {
    const s = document.createElement('div');
    s.className = 'hero hero-loading';
    parent.appendChild(s);
    return s;
  }

  /* ---------------- telas ---------------- */

  function renderHome() {
    document.title = 'Telão';
    const tok = ++renderToken;
    view.innerHTML = '';
    const slot = heroSlot(view);
    const rows = document.createElement('div');
    rows.className = 'rows';
    view.appendChild(rows);
    const hasKey = !!store.getKey();

    const iaHero = () =>
      api.iaCatList('populares').then((r) => tok === renderToken && mountHero(slot, r.items.slice(0, 6)))
        .catch(() => slot.remove());

    if (!hasKey) {
      iaHero();
      rows.appendChild(keyBanner(false));
      continueRow(rows);
      T.tv.homeRow(rows);
      api.IA_CATS.slice(0, 7).forEach((c) =>
        asyncRow(rows, c.title, () => api.iaCatList(c.key).then((r) => r.items), { more: `#/gratis/${c.key}` })
      );
      return;
    }

    api.tmdbList('/trending/all/week')
      .then((items) => tok === renderToken && mountHero(slot, items))
      .catch((e) => {
        if (tok !== renderToken) return;
        if (e.status === 401) rows.prepend(keyBanner(true));
        iaHero();
      });

    continueRow(rows);
    T.tv.homeRow(rows);
    asyncRow(rows, 'Em alta na semana', () => api.tmdbList('/trending/all/week'));
    asyncRow(rows, 'Grátis com anúncios no Brasil', () =>
      api.tmdbList('/discover/movie', {
        watch_region: 'BR', with_watch_monetization_types: 'free|ads', sort_by: 'popularity.desc',
      }, 'movie')
    );
    asyncRow(rows, 'Assista aqui, grátis', () => api.iaCatList('populares').then((r) => r.items), { more: '#/gratis' });
    asyncRow(rows, 'Filmes populares', () => api.tmdbList('/movie/popular', { region: 'BR' }, 'movie'), { more: '#/filmes' });
    asyncRow(rows, 'Séries populares', () => api.catalogPage('series', '', 'popularidade', 1).then((r) => r.items), { more: '#/series' });
    asyncRow(rows, 'Animes em alta', () => api.catalogPage('animes', '', 'popularidade', 1).then((r) => r.items), { more: '#/animes' });
    asyncRow(rows, 'Doramas em alta', () => api.catalogPage('doramas', '', 'popularidade', 1).then((r) => r.items), { more: '#/doramas' });
    asyncRow(rows, 'Nos cinemas', () => api.tmdbList('/movie/now_playing', { region: 'BR' }, 'movie'));
    asyncRow(rows, 'Produções brasileiras', () =>
      api.tmdbList('/discover/movie', { with_origin_country: 'BR', sort_by: 'popularity.desc' }, 'movie')
    );
    asyncRow(rows, 'Clássicos de graça: terror', () => api.iaCatList('terror').then((r) => r.items), { more: '#/gratis/terror' });
    asyncRow(rows, 'Os mais bem avaliados', () => api.tmdbList('/movie/top_rated', {}, 'movie'));
  }

  function renderCatalog(key, q) {
    const c = api.CATALOGS[key];
    document.title = c.title + ' · Telão';
    const tok = ++renderToken;
    view.innerHTML = '';
    const canais = key === 'filmes' || key === 'series';
    if (!store.getKey()) {
      const p = document.createElement('div');
      p.className = 'page';
      p.innerHTML = `<h1 class="ptitle">${esc(c.title)}</h1>`;
      p.appendChild(keyBanner(false));
      view.appendChild(p);
      if (canais) {
        const rows = document.createElement('div');
        rows.className = 'rows';
        view.appendChild(rows);
        T.tv.channelRow(rows, c.type);
      }
      return;
    }
    const slot = heroSlot(view);
    const rows = document.createElement('div');
    rows.className = 'rows';
    view.appendChild(rows);
    (c.trending ? api.tmdbList(c.trending, {}, c.type) : api.catalogPage(key, '', 'popularidade', 1).then((r) => r.items))
      .then((items) => tok === renderToken && mountHero(slot, items))
      .catch((e) => {
        if (tok !== renderToken) return;
        slot.remove();
        if (e.status === 401) rows.prepend(keyBanner(true));
      });
    if (canais) T.tv.channelRow(rows, c.type);

    const st = {
      genre: q.g && /^\d+$/.test(q.g) ? q.g : '',
      sort: api.SORTS.some((x) => x[0] === q.o) ? q.o : 'popularidade',
      page: 0, pages: 1, seq: 0,
    };
    const sec = document.createElement('section');
    sec.className = 'catalog';
    sec.innerHTML = `<div class="cat-head"><h2>Explorar ${esc(c.title.toLowerCase())}</h2>
        <label class="sortsel"><span>Ordenar por</span><select data-nav>${api.SORTS.map(([v, l]) =>
          `<option value="${v}"${v === st.sort ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div class="chips-nav" role="group" aria-label="Gêneros">${c.genres.map(([l, id]) => {
        const on = String(id || '') === st.genre;
        return `<button class="chip${on ? ' on' : ''}" data-genre="${id || ''}" data-nav aria-pressed="${on}">${esc(l)}</button>`;
      }).join('')}</div>
      <div class="grid">${skeleton(12)}</div>
      <div class="loadmore"></div>`;
    rows.appendChild(sec);
    const grid = $('.grid', sec);
    const more = $('.loadmore', sec);

    const load = (reset) => {
      if (reset) { st.page = 0; st.seq++; grid.innerHTML = skeleton(12); more.innerHTML = ''; }
      else more.innerHTML = '<div class="spinner"></div>';
      const mine = st.seq;
      const page = ++st.page;
      api.catalogPage(key, st.genre, st.sort, page).then((r) => {
        if (tok !== renderToken || mine !== st.seq) return;
        if (page === 1) grid.innerHTML = r.items.length ? '' : '<p class="muted">Nada encontrado com esse filtro.</p>';
        st.pages = r.pages;
        grid.insertAdjacentHTML('beforeend', r.items.map((i) => cardHTML(i, { noBadge: true })).join(''));
        more.innerHTML = page < r.pages ? '<button class="btn ghost" data-more data-nav>Carregar mais</button>' : '';
      }).catch(() => {
        if (tok !== renderToken || mine !== st.seq) return;
        st.page--;
        if (page === 1) grid.innerHTML = '';
        more.innerHTML = '<button class="btn ghost" data-more data-nav>Tentar de novo</button>';
      });
    };
    const setUrl = () => {
      const p = new URLSearchParams();
      if (st.genre) p.set('g', st.genre);
      if (st.sort !== 'popularidade') p.set('o', st.sort);
      const qs = p.toString();
      history.replaceState(null, '', `#/${key}${qs ? '?' + qs : ''}`);
    };
    sec.addEventListener('click', (e) => {
      const g = e.target.closest('[data-genre]');
      if (g) {
        st.genre = g.dataset.genre;
        sec.querySelectorAll('[data-genre]').forEach((b) => {
          const on = b === g;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', String(on));
        });
        setUrl();
        load(true);
        return;
      }
      if (e.target.closest('[data-more]')) load(false);
    });
    $('select', sec).addEventListener('change', (e) => { st.sort = e.target.value; setUrl(); load(true); });
    lazy(sec, () => load(true));
  }

  function renderFree() {
    document.title = 'Assista grátis · Telão';
    const tok = ++renderToken;
    view.innerHTML = '';
    const slot = heroSlot(view);
    const rows = document.createElement('div');
    rows.className = 'rows';
    const intro = document.createElement('p');
    intro.className = 'intro';
    intro.textContent =
      'Filmes completos que tocam aqui mesmo, de graça e dentro da lei. Vêm do acervo do Internet Archive, ' +
      'com obras em domínio público ou liberadas pelos autores. A maioria é clássico antigo, muitas vezes em inglês ou mudo.';
    rows.appendChild(intro);
    view.appendChild(rows);
    api.iaCatList('populares')
      .then((r) => tok === renderToken && mountHero(slot, r.items.slice(6, 12)))
      .catch(() => slot.remove());
    continueRow(rows);
    api.IA_CATS.forEach((c) =>
      asyncRow(rows, c.title, () => api.iaCatList(c.key).then((r) => r.items), { more: `#/gratis/${c.key}` })
    );
  }

  function renderIaGrid(key) {
    const c = api.iaCategory(key);
    if (!c) return renderNotFound();
    document.title = c.title + ' · Telão';
    const tok = ++renderToken;
    view.innerHTML = `<div class="page">
      <a class="crumb" href="#/gratis" data-nav>${icon('left')} Assista grátis</a>
      <h1 class="ptitle">${esc(c.title)}</h1>
      <p class="muted count"></p>
      <div class="grid"></div>
      <div class="loadmore"></div>
    </div>`;
    const grid = $('.grid', view);
    const more = $('.loadmore', view);
    let page = 0;
    const load = () => {
      page++;
      more.innerHTML = '<div class="spinner"></div>';
      api.iaCatList(key, page).then((r) => {
        if (tok !== renderToken) return;
        $('.count', view).textContent = `${r.total.toLocaleString('pt-BR')} filmes`;
        grid.insertAdjacentHTML('beforeend', r.items.map((i) => cardHTML(i)).join(''));
        const shown = grid.children.length;
        more.innerHTML = shown < r.total && r.items.length
          ? '<button class="btn ghost" data-nav>Carregar mais</button>'
          : '';
        const b = $('button', more);
        if (b) b.addEventListener('click', load);
      }).catch(() => {
        if (tok !== renderToken) return;
        more.innerHTML = '<p class="muted">Não deu para carregar agora. Tente de novo em instantes.</p>';
      });
    };
    load();
  }

  function renderList() {
    document.title = 'Minha lista · Telão';
    ++renderToken;
    const list = store.list();
    view.innerHTML = `<div class="page">
      <h1 class="ptitle">Minha lista</h1>
      ${list.length
        ? `<div class="grid">${list.map((i) => cardHTML(i)).join('')}</div>`
        : `<div class="empty"><p>Sua lista está vazia. Toque em <b>Minha lista</b> na página de um filme ou série para guardar aqui.</p>
           <p><a class="btn primary" href="#/" data-nav>Explorar</a></p></div>`}
    </div>`;
  }

  function renderSearch(initial) {
    document.title = 'Buscar · Telão';
    const tok = ++renderToken;
    view.innerHTML = `<div class="page">
      <h1 class="ptitle">Buscar</h1>
      <form class="bigsearch" role="search">
        ${icon('search')}
        <input type="search" placeholder="Filmes, séries, animes, doramas…" aria-label="Buscar" value="${esc(initial)}" data-nav autocomplete="off">
      </form>
      <div class="recent"></div>
      <div class="results"></div>
    </div>`;
    const input = $('.bigsearch input', view);
    const out = $('.results', view);
    const recent = $('.recent', view);
    let seq = 0;
    let current = '';

    const showRecent = () => {
      const r = store.recentSearches();
      recent.innerHTML = r.length
        ? `<div class="recent-head"><h2>Buscas recentes</h2><button class="linkbtn" data-clear-recent data-nav>Limpar</button></div>
           <div class="chips-nav">${r.map((x) => `<button class="chip" data-q="${esc(x)}" data-nav>${esc(x)}</button>`).join('')}</div>`
        : '';
    };

    const run = (q) => {
      q = q.trim();
      current = q;
      const mine = ++seq;
      history.replaceState(null, '', q ? `#/busca/${encodeURIComponent(q)}` : '#/busca');
      if (!q) {
        showRecent();
        out.innerHTML = '<p class="muted">Digite para buscar no catálogo e nos filmes grátis.</p>';
        return;
      }
      recent.innerHTML = '';
      const hasKey = !!store.getKey();
      out.innerHTML = `${hasKey ? `<section><h2>Filmes e séries</h2><div class="grid g-tmdb">${skeleton(6)}</div><div class="loadmore"></div></section>` : ''}
        <section><h2>Assista aqui, grátis</h2><div class="grid g-ia">${skeleton(6)}</div></section>
        ${hasKey ? '' : '<p class="muted">Conecte o TMDB em <a href="#/config">Configurações</a> para buscar em todos os filmes e séries.</p>'}`;
      const ok = () => mine === seq && tok === renderToken;
      if (hasKey) {
        const grid = $('.g-tmdb', out);
        const more = $('.g-tmdb + .loadmore', out);
        let page = 0;
        const loadPage = () => {
          page++;
          if (page > 1) more.innerHTML = '<div class="spinner"></div>';
          api.tmdbSearch(q, page).then((r) => {
            if (!ok()) return;
            if (page === 1) grid.innerHTML = r.items.length ? '' : '<p class="muted">Nada encontrado no catálogo.</p>';
            grid.insertAdjacentHTML('beforeend', r.items.map((i) => cardHTML(i)).join(''));
            more.innerHTML = page < r.pages ? '<button class="btn ghost" data-nav>Carregar mais</button>' : '';
            const b = $('button', more);
            if (b) b.addEventListener('click', loadPage);
          }).catch(() => {
            if (!ok()) return;
            if (page === 1) grid.innerHTML = '<p class="muted">A busca falhou. Confira sua conexão.</p>';
            else { page--; more.innerHTML = ''; }
          });
        };
        loadPage();
      }
      api.iaFind(q).then((r) => {
        if (!ok()) return;
        $('.g-ia', out).innerHTML = r.items.length
          ? r.items.map((i) => cardHTML(i)).join('')
          : '<p class="muted">Nenhum filme grátis com esse nome.</p>';
      }).catch(() => {
        if (ok()) $('.g-ia', out).innerHTML = '<p class="muted">A busca falhou. Confira sua conexão.</p>';
      });
    };

    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => run(input.value), 450);
    });
    $('.bigsearch', view).addEventListener('submit', (e) => {
      e.preventDefault();
      clearTimeout(timer);
      store.addRecentSearch(input.value);
      run(input.value);
      input.blur();
    });
    view.onclick = (e) => {
      const chip = e.target.closest('[data-q]');
      if (chip) { input.value = chip.dataset.q; store.addRecentSearch(chip.dataset.q); run(chip.dataset.q); return; }
      if (e.target.closest('[data-clear-recent]')) { store.clearRecentSearches(); showRecent(); return; }
      // Guardar a busca quando a pessoa abre um resultado.
      if (e.target.closest('.results .card') && current) store.addRecentSearch(current);
    };
    run(initial || '');
    if (!initial) input.focus();
  }

  function providersHTML(p) {
    if (!p) {
      return '<p class="muted">Ainda não há informação de onde assistir este título no Brasil.</p>';
    }
    const groups = [
      ['free', 'Grátis'], ['ads', 'Grátis com anúncios'], ['flatrate', 'Assinatura'],
      ['rent', 'Alugar'], ['buy', 'Comprar'],
    ];
    const html = groups
      .filter(([k]) => p[k] && p[k].length)
      .map(([k, label]) => `<div class="pgroup ${k === 'free' || k === 'ads' ? 'is-free' : ''}">
        <h3>${label}</h3>
        <div class="plist">${p[k].map((x) => `<a class="prov" href="${esc(p.link)}" target="_blank" rel="noopener" data-nav>
          <img src="${esc(api.img('w92', x.logo_path))}" alt="" loading="lazy"><span>${esc(x.provider_name)}</span></a>`).join('')}</div>
      </div>`)
      .join('');
    return (html || '<p class="muted">Ainda não há informação de onde assistir este título no Brasil.</p>') +
      '<p class="attr">Disponibilidade no Brasil fornecida pelo JustWatch. Os links abrem a página do título no TMDB.</p>';
  }

  async function renderTmdbDetail(type, id) {
    if (!['movie', 'tv'].includes(type) || !/^\d+$/.test(id || '')) return renderNotFound();
    const tok = ++renderToken;
    if (!store.getKey()) {
      view.innerHTML = '<div class="page"></div>';
      view.firstChild.appendChild(keyBanner(false));
      return;
    }
    view.innerHTML = loadingHTML();
    let d;
    try {
      d = await api.tmdbDetails(type, id);
    } catch (e) {
      if (tok !== renderToken) return;
      view.innerHTML = errorHTML(e.status === 404 ? 'Esse título não existe no TMDB.' : 'Não deu para carregar este título agora.');
      return;
    }
    if (tok !== renderToken) return;

    const it = api.fromTmdb(d, type);
    document.title = it.title + ' · Telão';
    const yt = api.pickTrailer(d.videos);
    const genres = (d.genres || []).map((g) => g.name);
    const meta = [
      it.year,
      type === 'movie' ? fmtMin(d.runtime) : d.number_of_seasons ? plural(d.number_of_seasons, 'temporada', 'temporadas') : '',
      d.vote_average ? `${icon('star')} ${d.vote_average.toFixed(1)}` : '',
    ].filter(Boolean);
    const cast = ((d.credits && d.credits.cast) || []).slice(0, 16);
    const director = type === 'movie'
      ? ((d.credits && d.credits.crew) || []).filter((c) => c.job === 'Director').map((c) => c.name)
      : (d.created_by || []).map((c) => c.name);
    const prov = d['watch/providers'] && d['watch/providers'].results && d['watch/providers'].results.BR;
    const seasons = type === 'tv' ? (d.seasons || []).filter((s) => s.season_number > 0 && s.episode_count) : [];

    view.innerHTML = `<article class="detail">
      <div class="dback" style="background-image:url('${esc(api.img(api.backdropSize(), d.backdrop_path))}')"></div>
      <div class="dhead">
        ${it.poster ? `<img class="dposter" src="${esc(api.img('w500', d.poster_path))}" alt="">` : '<span class="dposter noimg"></span>'}
        <div class="dinfo">
          <span class="tag">${type === 'tv' ? 'Série' : 'Filme'}</span>
          <h1>${esc(it.title)}</h1>
          <p class="meta">${meta.map((m) => `<span>${m}</span>`).join('')}</p>
          ${genres.length ? `<p class="chips">${genres.map((g) => `<span>${esc(g)}</span>`).join('')}</p>` : ''}
          <div class="actions">
            ${yt ? `<button class="btn primary" data-yt="${esc(yt)}" data-nav>${icon('play')}<span>Ver trailer</span></button>` : ''}
            ${listBtn(it)}
          </div>
        </div>
      </div>
      <div class="dbody">
        ${d.tagline ? `<p class="tagline">${esc(d.tagline)}</p>` : ''}
        <p class="overview">${esc(d.overview || 'Sinopse ainda não disponível em português.')}</p>
        ${director.length ? `<p class="muted">${type === 'movie' ? 'Direção' : 'Criação'}: ${esc(director.join(', '))}</p>` : ''}
        <section class="where" aria-labelledby="where-h">
          <h2 id="where-h">Onde assistir no Brasil</h2>
          ${providersHTML(prov)}
        </section>
        ${seasons.length ? `<section class="seasons">
          <div class="shead"><h2>Episódios</h2>
            <select aria-label="Temporada" data-nav>${seasons.map((s) =>
              `<option value="${s.season_number}">${esc(s.name || 'Temporada ' + s.season_number)}</option>`).join('')}</select>
          </div>
          <div class="eps"></div>
        </section>` : ''}
      </div>
      ${cast.length ? `<section class="row"><div class="row-head"><h2>Elenco</h2></div>
        <div class="row-wrap"><div class="scroller people">${cast.map((c) => `<div class="person">
          ${c.profile_path ? `<img src="${esc(api.img('w185', c.profile_path))}" alt="" loading="lazy">` : '<span class="noimg"></span>'}
          <b>${esc(c.name)}</b><small>${esc(c.character || '')}</small></div>`).join('')}</div></div></section>` : ''}
    </article>`;

    const recs = (d.recommendations && d.recommendations.results && d.recommendations.results.length
      ? d.recommendations.results : (d.similar && d.similar.results) || []);
    const similar = recs.map((r) => api.fromTmdb(r, type)).filter((i) => i && i.poster);
    if (similar.length) {
      const s = rowEl('Você também pode gostar');
      s.querySelector('.scroller').innerHTML = similar.map((i) => cardHTML(i)).join('');
      $('.detail', view).appendChild(s);
    }

    if (seasons.length) {
      const sel = $('.seasons select', view);
      const eps = $('.eps', view);
      const loadSeason = (n) => {
        eps.innerHTML = '<div class="spinner"></div>';
        api.tmdbSeason(id, n).then((s) => {
          if (tok !== renderToken) return;
          eps.innerHTML = (s.episodes || []).map((e) => `<div class="ep">
            ${e.still_path ? `<img src="${esc(api.img('w300', e.still_path))}" alt="" loading="lazy">` : '<span class="noimg"></span>'}
            <div><b>${e.episode_number}. ${esc(e.name)}</b>
            <small>${[e.air_date ? new Date(e.air_date + 'T12:00').toLocaleDateString('pt-BR') : '', fmtMin(e.runtime)].filter(Boolean).join(' · ')}</small>
            <p>${esc(e.overview || '')}</p></div></div>`).join('') || '<p class="muted">Sem episódios cadastrados.</p>';
        }).catch(() => {
          if (tok === renderToken) eps.innerHTML = '<p class="muted">Não deu para carregar os episódios.</p>';
        });
      };
      sel.addEventListener('change', () => loadSeason(sel.value));
      loadSeason(sel.value);
    }
  }

  async function renderIaDetail(id) {
    if (!id) return renderNotFound();
    const tok = ++renderToken;
    view.innerHTML = loadingHTML();
    let d;
    try {
      d = await api.iaDetails(id);
    } catch (e) {
      if (tok !== renderToken) return;
      view.innerHTML = errorHTML('Não deu para carregar este filme agora.');
      return;
    }
    if (tok !== renderToken) return;
    const it = d.item;
    document.title = it.title + ' · Telão';
    const prog = store.getProgress(id);
    const enc = encodeURIComponent(id);
    const playable = d.videos.length > 0;
    const resume = playable && prog && prog.t > 10;
    const meta = [it.year, d.runtime, d.creator].filter(Boolean);

    view.innerHTML = `<article class="detail">
      <div class="dback soft" style="background-image:url('${esc(it.backdrop)}')"></div>
      <div class="dhead">
        <img class="dposter" src="${esc(it.poster)}" alt="">
        <div class="dinfo">
          <span class="tag free">Filme completo, grátis</span>
          <h1>${esc(it.title)}</h1>
          ${meta.length ? `<p class="meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</p>` : ''}
          ${d.subjects.length ? `<p class="chips">${d.subjects.map((g) => `<span>${esc(g)}</span>`).join('')}</p>` : ''}
          <div class="actions">
            ${playable
              ? resume
                ? `<a class="btn primary" href="#/assistir/${enc}/${prog.part || 0}" data-nav>${icon('play')}<span>Continuar de ${fmtTime(prog.t)}</span></a>
                   <a class="btn ghost" href="#/assistir/${enc}/0/inicio" data-nav><span>Do início</span></a>`
                : `<a class="btn primary" href="#/assistir/${enc}" data-nav>${icon('play')}<span>Assistir</span></a>`
              : ''}
            ${listBtn(it)}
          </div>
          ${playable ? '' : '<p class="muted">Este item não tem um vídeo que o navegador consiga tocar.</p>'}
        </div>
      </div>
      <div class="dbody">
        ${d.videos.length > 1 ? `<section><h2>Partes</h2><div class="parts">${d.videos.map((v, i) =>
          `<a class="btn ghost" href="#/assistir/${enc}/${i}" data-nav>${icon('play')}<span>Parte ${i + 1}</span></a>`).join('')}</div></section>` : ''}
        ${it.overview ? `<p class="overview pre">${esc(it.overview)}</p>` : ''}
        <p class="muted small">Do acervo do Internet Archive. A descrição original costuma estar em inglês.
          <a href="${esc(api.iaPage(id))}" target="_blank" rel="noopener">Ver a página do filme no archive.org ${icon('ext')}</a></p>
      </div>
    </article>`;
  }

  async function renderPlayer(id, part, fromStart) {
    if (!id) return renderNotFound();
    const tok = ++renderToken;
    document.body.classList.add('is-player');
    const enc = encodeURIComponent(id);
    view.innerHTML = `<div class="player">
      <div class="pbar-top">
        <a class="iconbtn" href="#/t/ia/${enc}" aria-label="Voltar">${icon('back')}</a>
        <div class="ptitle-s">Carregando…</div>
      </div>
      <video controls playsinline preload="metadata"></video>
      <div class="pmsg" hidden></div>
    </div>`;
    const video = $('video', view);
    const title = $('.ptitle-s', view);
    const msg = $('.pmsg', view);

    let d;
    try {
      d = await api.iaDetails(id);
    } catch (e) {
      if (tok !== renderToken) return;
      title.textContent = 'Erro';
      msg.hidden = false;
      msg.innerHTML = 'Não deu para carregar este filme agora.';
      return;
    }
    if (tok !== renderToken) return;
    const f = d.videos[part];
    if (!f) {
      msg.hidden = false;
      msg.innerHTML = `Este filme não tem um vídeo que o navegador consiga tocar.
        <a href="${esc(api.iaPage(id))}" target="_blank" rel="noopener">Abrir no archive.org</a>`;
      title.textContent = d.item.title;
      return;
    }
    document.title = d.item.title + ' · Telão';
    title.textContent = d.item.title + (d.videos.length > 1 ? ` · Parte ${part + 1} de ${d.videos.length}` : '');
    video.poster = d.item.poster;
    video.src = api.iaFileUrl(id, f.name);

    const prog = store.getProgress(id);
    if (!fromStart && prog && (prog.part || 0) === part && prog.t > 10 && (!prog.d || prog.t < prog.d * 0.95)) {
      video.addEventListener('loadedmetadata', () => { video.currentTime = prog.t; }, { once: true });
      toast(`Retomando de ${fmtTime(prog.t)}`);
    }

    const save = () => {
      if (tok !== renderToken) return;
      const t = video.currentTime;
      const dur = isFinite(video.duration) ? video.duration : 0;
      if (t < 5) return;
      if (dur && t / dur > 0.95 && part >= d.videos.length - 1) store.clearProgress(id);
      else store.setProgress(d.item, { t, d: dur, part });
    };
    let last = 0;
    video.addEventListener('timeupdate', () => {
      if (Math.abs(video.currentTime - last) < 5) return;
      last = video.currentTime;
      save();
    });
    video.addEventListener('pause', () => { save(); keepAwake(false); });
    video.addEventListener('playing', () => keepAwake(true));
    video.addEventListener('ended', () => {
      if (part < d.videos.length - 1) {
        store.setProgress(d.item, { t: 0, d: 0, part: part + 1 });
        location.hash = `#/assistir/${enc}/${part + 1}`;
      } else {
        store.clearProgress(id);
        toast('Fim do filme');
      }
    });
    video.addEventListener('error', () => {
      msg.hidden = false;
      msg.innerHTML = `O vídeo não carregou. O archive.org às vezes fica lento; tente de novo daqui a pouco ou
        <a href="${esc(api.iaPage(id))}" target="_blank" rel="noopener">abra o filme no site deles</a>.`;
    });
    window.addEventListener('pagehide', save, { once: true });
    video.play().catch(() => { /* o navegador pode exigir um toque antes de tocar */ });
    video.focus();
  }

  function renderConfig() {
    document.title = 'Configurações · Telão';
    ++renderToken;
    const key = store.getKey();
    view.innerHTML = `<div class="page narrow">
      <h1 class="ptitle">Configurações</h1>

      <section class="panel">
        <h2>Catálogo completo (TMDB)</h2>
        <p>O TMDB é um banco de dados aberto de filmes e séries. A chave é gratuita e fica salva só neste navegador.</p>
        <ol class="steps">
          <li>Crie uma conta em <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener">themoviedb.org</a>.</li>
          <li>Vá em <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">Configurações → API</a> e peça uma chave para uso pessoal.</li>
          <li>Copie a <b>Chave da API</b> ou o <b>Token de leitura da API</b> e cole aqui.</li>
        </ol>
        <form class="keyform">
          <label for="tmdbkey">Chave ou token do TMDB</label>
          <input id="tmdbkey" type="password" autocomplete="off" spellcheck="false" value="${esc(key)}" data-nav>
          <div class="actions">
            <button class="btn primary" type="submit" data-nav>Salvar e testar</button>
            ${key ? '<button class="btn ghost" type="button" data-act="rmkey" data-nav>Remover chave</button>' : ''}
          </div>
          <p class="status" role="status">${key ? 'Chave salva.' : ''}</p>
        </form>
      </section>

      <section class="panel">
        <h2>Seus dados</h2>
        <p>Minha lista e o "Continuar assistindo" ficam salvos neste aparelho.</p>
        <div class="actions">
          <button class="btn ghost" type="button" data-act="clrprog" data-nav>Limpar "Continuar assistindo"</button>
          <button class="btn ghost" type="button" data-act="clrlist" data-nav>Esvaziar Minha lista</button>
        </div>
      </section>

      <section class="panel">
        <h2>Sobre o Telão</h2>
        <p>O Telão só usa fontes legais. O catálogo, os trailers e as informações de onde assistir vêm do
          <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>, com dados de disponibilidade do
          <a href="https://www.justwatch.com/br" target="_blank" rel="noopener">JustWatch</a>. Os filmes que tocam aqui
          dentro vêm do <a href="https://archive.org/details/feature_films" target="_blank" rel="noopener">Internet Archive</a>.</p>
        <p class="muted small">Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.</p>
      </section>
    </div>`;

    const form = $('.keyform', view);
    const status = $('.status', view);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = $('#tmdbkey').value.trim();
      if (!val) { status.textContent = 'Cole a chave antes de salvar.'; return; }
      status.textContent = 'Testando…';
      try {
        await api.testKey(val);
        store.setKey(val);
        api.clearCache();
        status.textContent = 'Tudo certo! O catálogo completo está liberado.';
        toast('TMDB conectado');
        setTimeout(() => { location.hash = '#/'; }, 900);
      } catch (err) {
        status.textContent = err.status === 401
          ? 'O TMDB recusou essa chave. Confira se copiou ela inteira.'
          : 'Não consegui falar com o TMDB. Confira sua conexão e tente de novo.';
      }
    });
  }

  function renderMore() {
    ++renderToken;
    document.title = 'Mais · Telão';
    const links = [
      ['#/animes', 'Animes', 'Séries japonesas de animação'],
      ['#/doramas', 'Doramas', 'Séries coreanas'],
      ['#/tv', 'TV ao vivo', 'Canais abertos e gratuitos'],
      ['#/gratis', 'Assista grátis', 'Filmes completos em domínio público'],
      ['#/busca', 'Buscar', 'Filmes, séries e clássicos'],
      ['#/config', 'Configurações', 'Chave do TMDB e seus dados'],
    ];
    view.innerHTML = `<div class="page narrow"><h1 class="ptitle">Mais</h1>
      <nav class="morelist" aria-label="Mais seções">${links.map(([h, t, d]) =>
        `<a href="${h}" data-nav><span><b>${t}</b><small>${d}</small></span>${icon('right')}</a>`).join('')}</nav></div>`;
  }

  function renderNotFound() {
    ++renderToken;
    document.title = 'Não encontrado · Telão';
    view.innerHTML = `<div class="page narrow empty"><h1>Página não encontrada</h1>
      <p><a class="btn primary" href="#/" data-nav>Voltar ao início</a></p></div>`;
  }

  /* ---------------- trailer (janela) ---------------- */

  let modalReturn = null;
  function openTrailer(ytKey) {
    closeModal();
    modalReturn = document.activeElement;
    const m = document.createElement('div');
    m.className = 'modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-label', 'Trailer');
    m.innerHTML = `<div class="modal-box">
      <button class="iconbtn mclose" data-close data-nav aria-label="Fechar">${icon('close')}</button>
      <div class="frame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytKey)}?autoplay=1&rel=0"
        title="Trailer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
    </div>`;
    document.body.appendChild(m);
    document.body.classList.add('has-modal');
    $('.mclose', m).focus();
  }

  function closeModal() {
    const m = $('.modal');
    if (!m) return false;
    m.remove();
    document.body.classList.remove('has-modal');
    if (modalReturn && document.contains(modalReturn)) modalReturn.focus();
    modalReturn = null;
    return true;
  }

  async function trailerFor(it) {
    try {
      const d = await api.tmdbDetails(it.type, it.id);
      const yt = api.pickTrailer(d.videos);
      if (yt) openTrailer(yt);
      else toast('Esse título ainda não tem trailer');
    } catch (e) {
      toast('Não deu para carregar o trailer');
    }
  }

  /* ---------------- eventos globais ---------------- */

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-list],[data-trailer],[data-yt],[data-close],[data-act],.arrow,.modal');
    if (!t) return;
    if (t.dataset.act) {
      const act = t.dataset.act;
      if (act === 'rmkey') { store.setKey(''); api.clearCache(); toast('Chave removida'); renderConfig(); }
      if (act === 'clrprog') { store.clearAllProgress(); toast('Histórico limpo'); }
      if (act === 'clrlist') { store.clearList(); toast('Lista esvaziada'); }
      return;
    }
    if (t.matches('.modal')) { if (e.target === t) closeModal(); return; }
    if (t.dataset.close != null) return closeModal();
    if (t.dataset.yt) return openTrailer(t.dataset.yt);
    if (t.dataset.trailer) {
      const it = registry.get(t.dataset.trailer);
      if (it) trailerFor(it);
      return;
    }
    if (t.dataset.list) {
      const it = registry.get(t.dataset.list);
      if (!it) return;
      const on = store.toggleList(it);
      t.setAttribute('aria-pressed', String(on));
      t.innerHTML = `${icon(on ? 'check' : 'plus')}<span>${on ? 'Na minha lista' : 'Minha lista'}</span>`;
      toast(on ? 'Adicionado à Minha lista' : 'Removido da Minha lista');
      return;
    }
    if (t.classList.contains('arrow')) {
      const sc = t.parentElement.querySelector('.scroller');
      sc.scrollBy({ left: (t.classList.contains('l') ? -1 : 1) * sc.clientWidth * 0.85, behavior: 'smooth' });
    }
  });

  // Imagem que não carregou vira um cartão com o nome do título.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || img.dataset.failed) return;
    img.dataset.failed = '1';
    if (img.closest('.poster')) {
      const ph = document.createElement('span');
      ph.className = 'noimg';
      ph.textContent = (img.closest('[title]') || {}).title || '';
      img.replaceWith(ph);
    } else {
      img.style.visibility = 'hidden';
    }
  }, true);

  const top = $('#top');
  const onScroll = () => top.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });

  /* Navegação por setas, para usar com o controle remoto da TV ou o teclado. */
  const DIRS = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' };

  function isVisible(el) {
    if (!el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  }

  function moveFocus(dir) {
    const scope = $('.modal') || document;
    const items = [...scope.querySelectorAll('[data-nav]')].filter(isVisible);
    const a = document.activeElement;
    if (!a || !items.includes(a)) {
      const first = items.find((el) => view.contains(el)) || items[0];
      if (first) { first.focus(); first.scrollIntoView({ block: 'center', inline: 'nearest' }); }
      return true;
    }
    const r = a.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of items) {
      if (el === a) continue;
      const b = el.getBoundingClientRect();
      const dx = b.left + b.width / 2 - cx;
      const dy = b.top + b.height / 2 - cy;
      let main, cross;
      if (dir === 'r') { if (b.left < r.right - 4) continue; main = dx; cross = Math.abs(dy); }
      else if (dir === 'l') { if (b.right > r.left + 4) continue; main = -dx; cross = Math.abs(dy); }
      else if (dir === 'd') { if (b.top < r.bottom - 4) continue; main = dy; cross = Math.abs(dx); }
      else { if (b.bottom > r.top + 4) continue; main = -dy; cross = Math.abs(dx); }
      const horizontal = dir === 'l' || dir === 'r';
      const score = main + cross * (horizontal ? 4 : 0.8);
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (!best) return false;
    best.focus({ preventScroll: true });
    best.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    return true;
  }

  document.addEventListener('keydown', (e) => {
    const a = document.activeElement;
    const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
    const isBack = e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack' ||
      e.keyCode === 461 || e.keyCode === 10009 || (e.key === 'Backspace' && !typing);

    if (isBack) {
      if (closeModal()) { e.preventDefault(); return; }
      if (typing && e.key === 'Escape') { a.blur(); return; }
      if (location.hash && location.hash !== '#/' && history.length > 1) {
        e.preventDefault();
        history.back();
      }
      return;
    }

    const dir = DIRS[e.key];
    if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.body.classList.contains('is-player')) return; // setas controlam o vídeo
    if (typing && (a.tagName === 'SELECT' || dir === 'l' || dir === 'r')) return;
    if (moveFocus(dir)) e.preventDefault();
  });

  /* ---------------- rotas ---------------- */

  function setActive(sec) {
    document.querySelectorAll('[data-sec]').forEach((el) => {
      const on = el.dataset.sec === sec || (!!sec && !!el.dataset.also && el.dataset.also.split(' ').includes(sec));
      el.classList.toggle('active', on);
      if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
  }

  function router() {
    clearInterval(heroTimer);
    closeModal();
    T.tv.stop();
    keepAwake(false);
    if (rowObserver) rowObserver.disconnect();
    view.onclick = null;
    document.body.classList.remove('is-player');
    const [raw, qs] = location.hash.replace(/^#\/?/, '').split('?');
    const query = {};
    new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
    const parts = raw.split('/').filter(Boolean).map((s) => {
      try { return decodeURIComponent(s); } catch (e) { return s; }
    });
    const sec = parts[0] || '';
    setActive(['filmes', 'series', 'animes', 'doramas', 'gratis', 'tv', 'lista', 'config', 'mais', 'busca'].includes(sec) ? sec : sec === '' ? '' : null);
    window.scrollTo(0, 0);
    onScroll();

    switch (sec) {
      case '': return renderHome();
      case 'filmes': case 'series': case 'animes': case 'doramas': return renderCatalog(sec, query);
      case 'mais': return renderMore();
      case 'gratis': return parts[1] ? renderIaGrid(parts[1]) : renderFree();
      case 'lista': return renderList();
      case 'tv':
        if (parts[1] === 'ver') return T.tv.player(parts[2], parts[3]);
        if (parts[1] === 'adicionar') return T.tv.add();
        return T.tv.home(parts[1]);
      case 'busca': return renderSearch(parts.slice(1).join('/'));
      case 't':
        if (parts[1] === 'ia') return renderIaDetail(parts[2]);
        if (parts[1] === 'tmdb') return renderTmdbDetail(parts[2], parts[3]);
        return renderNotFound();
      case 'assistir': return renderPlayer(parts[1], Math.max(0, parseInt(parts[2], 10) || 0), parts[3] === 'inicio');
      case 'config': return renderConfig();
      default: return renderNotFound();
    }
  }

  // Funções compartilhadas com a TV ao vivo (tv.js).
  T.ui = {
    view, $, esc, icon, toast, keepAwake,
    lazy,
    token: () => renderToken,
    newToken: () => ++renderToken,
    isCurrent: (t) => t === renderToken,
  };

  window.addEventListener('hashchange', router);
  router();
})();
