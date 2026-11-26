/* Telão — acesso às fontes de dados.
 *
 *  TMDB (themoviedb.org): catálogo de filmes e séries, trailers e
 *  "onde assistir" no Brasil (dados do JustWatch). Precisa de uma chave
 *  gratuita, que o usuário cola em Configurações.
 *
 *  Internet Archive (archive.org): filmes em domínio público ou com licença
 *  livre, que tocam inteiros dentro do app. Não precisa de chave.
 */
(function () {
  'use strict';
  const T = (window.Telao = window.Telao || {});

  const TMDB = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p/';
  const IA = 'https://archive.org';
  const cache = new Map();

  /* Cache guardado no aparelho: as listas abrem na hora quando o app é aberto de novo. */
  const PC_KEY = 'telao.cache';
  let pc = null;
  let pcTimer = null;
  function pcLoad() {
    if (pc) return pc;
    try { pc = JSON.parse(localStorage.getItem(PC_KEY) || '{}') || {}; } catch (e) { pc = {}; }
    return pc;
  }
  function pcSave() {
    clearTimeout(pcTimer);
    pcTimer = setTimeout(() => {
      const ks = Object.keys(pc).sort((a, b) => pc[b].t - pc[a].t);
      ks.slice(80).forEach((k) => delete pc[k]);
      try { localStorage.setItem(PC_KEY, JSON.stringify(pc)); } catch (e) { /* sem espaço: segue sem cache */ }
    }, 400);
  }
  function persisted(key, ttl, make) {
    const c = pcLoad()[key];
    if (c && Date.now() - c.t < ttl) return Promise.resolve(c.v);
    return make().then((v) => {
      pcLoad()[key] = { t: Date.now(), v };
      pcSave();
      return v;
    });
  }
  const HOUR = 3600 * 1000;

  // Tamanho da imagem de fundo conforme a tela (celular baixa uma versão menor).
  const backdropSize = () => ((window.innerWidth || 1280) * (window.devicePixelRatio || 1) <= 1000 ? 'w780' : 'w1280');

  function cached(key, make) {
    if (cache.has(key)) return cache.get(key);
    const p = make();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
    return p;
  }

  async function getJSON(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) {
      const err = new Error(`HTTP ${r.status}`);
      err.status = r.status;
      throw err;
    }
    return r.json();
  }

  /* ---------------- TMDB ---------------- */

  function tmdbRequest(path, params, key) {
    if (!key) {
      const err = new Error('Sem chave do TMDB');
      err.code = 'NO_KEY';
      return Promise.reject(err);
    }
    const url = new URL(TMDB + path);
    url.searchParams.set('language', 'pt-BR');
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null && v !== '') url.searchParams.set(k, v);
    }
    const headers = { accept: 'application/json' };
    // Aceita os dois formatos que o TMDB fornece: o "token de leitura"
    // (começa com eyJ) e a "chave da API" curta.
    if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
    else url.searchParams.set('api_key', key);
    return { url: url.toString(), headers };
  }

  function tmdb(path, params) {
    const req = tmdbRequest(path, params, T.store.getKey());
    if (req instanceof Promise) return req;
    return cached(req.url, () => getJSON(req.url, { headers: req.headers }));
  }

  // Usado em Configurações para testar uma chave antes de salvar.
  function testKey(key) {
    const req = tmdbRequest('/configuration', {}, String(key || '').trim());
    if (req instanceof Promise) return req;
    return getJSON(req.url, { headers: req.headers });
  }

  // Nomes dos gêneros do TMDB em português (filmes e séries), para mostrar nas capas.
  const GENRE_NAMES = {
    28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime', 99: 'Documentário', 18: 'Drama',
    10751: 'Família', 14: 'Fantasia', 36: 'História', 27: 'Terror', 10402: 'Música', 9648: 'Mistério',
    10749: 'Romance', 878: 'Ficção científica', 10770: 'Filme para TV', 53: 'Suspense', 10752: 'Guerra',
    37: 'Faroeste', 10759: 'Ação e aventura', 10762: 'Infantil', 10763: 'Notícias', 10764: 'Reality',
    10765: 'Ficção e fantasia', 10766: 'Novela', 10767: 'Talk show', 10768: 'Guerra e política',
  };

  /* Catálogos com filtro de gênero e ordem (abas Filmes, Séries, Animes e Doramas). */
  const CATALOGS = {
    filmes: {
      title: 'Filmes', type: 'movie', trending: '/trending/movie/week', base: {},
      genres: [['Todos'], ['Ação', 28], ['Aventura', 12], ['Comédia', 35], ['Drama', 18], ['Ficção científica', 878],
        ['Terror', 27], ['Suspense', 53], ['Romance', 10749], ['Animação', 16], ['Família', 10751], ['Documentário', 99]],
    },
    series: {
      title: 'Séries', type: 'tv', trending: '/trending/tv/week', base: { without_genres: '16' },
      genres: [['Todas'], ['Drama', 18], ['Crime', 80], ['Ficção e fantasia', 10765], ['Ação e aventura', 10759],
        ['Mistério', 9648], ['Comédia', 35], ['Reality', 10764], ['Documentário', 99]],
    },
    animes: {
      title: 'Animes', type: 'tv', base: { with_genres: '16', with_original_language: 'ja' },
      genres: [['Todos'], ['Ação e aventura', 10759], ['Comédia', 35], ['Drama', 18], ['Ficção e fantasia', 10765],
        ['Mistério', 9648], ['Família', 10751]],
    },
    doramas: {
      title: 'Doramas', type: 'tv', base: { with_original_language: 'ko', without_genres: '16,10764,10767' },
      genres: [['Todos'], ['Drama', 18], ['Comédia', 35], ['Ação e aventura', 10759], ['Crime', 80],
        ['Mistério', 9648], ['Ficção e fantasia', 10765]],
    },
  };
  const SORTS = [['popularidade', 'Mais populares'], ['nota', 'Mais bem avaliados'], ['recentes', 'Mais recentes'], ['titulo', 'Título (A–Z)']];

  function catalogParams(key, genre, sort) {
    const c = CATALOGS[key];
    const movie = c.type === 'movie';
    const p = Object.assign({}, c.base);
    if (genre) p.with_genres = p.with_genres ? `${p.with_genres},${genre}` : String(genre);
    const today = new Date().toISOString().slice(0, 10);
    if (sort === 'nota') { p.sort_by = 'vote_average.desc'; p['vote_count.gte'] = movie ? 300 : 150; }
    else if (sort === 'recentes') {
      p.sort_by = movie ? 'primary_release_date.desc' : 'first_air_date.desc';
      p[movie ? 'primary_release_date.lte' : 'first_air_date.lte'] = today;
      p['vote_count.gte'] = 20;
    } else if (sort === 'titulo') { p.sort_by = movie ? 'title.asc' : 'name.asc'; p['vote_count.gte'] = 50; }
    else p.sort_by = 'popularity.desc';
    return p;
  }

  // Uma página de resultados (para grades com "Carregar mais").
  function tmdbPage(path, params, type, page) {
    const all = Object.assign({}, params, { page: page || 1 });
    const key = 'tp:' + path + JSON.stringify(all) + (type || '');
    return persisted(key, 6 * HOUR, () => tmdb(path, all).then((d) => ({
      items: (d.results || []).map((r) => fromTmdb(r, type)).filter((i) => i && i.poster),
      pages: Math.min(d.total_pages || 1, 500),
      total: d.total_results || 0,
    })));
  }

  function catalogPage(key, genre, sort, page) {
    const c = CATALOGS[key];
    return tmdbPage(`/discover/${c.type}`, catalogParams(key, genre, sort), c.type, page);
  }

  function fromTmdb(r, forcedType) {
    if (!r) return null;
    const type = forcedType || r.media_type || (r.title != null ? 'movie' : 'tv');
    if (type !== 'movie' && type !== 'tv') return null;
    const date = r.release_date || r.first_air_date || '';
    return {
      src: 'tmdb',
      type,
      id: String(r.id),
      title: r.title || r.name || '',
      year: date.slice(0, 4),
      poster: r.poster_path ? IMG + 'w342' + r.poster_path : '',
      backdrop: r.backdrop_path ? IMG + backdropSize() + r.backdrop_path : '',
      overview: r.overview || '',
      rating: r.vote_average || 0,
      genres: (r.genre_ids || (r.genres || []).map((g) => g.id)).map((g) => GENRE_NAMES[g]).filter(Boolean).slice(0, 3),
    };
  }

  function tmdbList(path, params, type) {
    if (!T.store.getKey()) return tmdb(path, params); // rejeita com NO_KEY
    const key = 'tm:' + path + JSON.stringify(params || {}) + (type || '');
    return persisted(key, 6 * HOUR, () => tmdb(path, params).then((d) =>
      (d.results || []).map((r) => fromTmdb(r, type)).filter((i) => i && i.poster)
    ));
  }

  function tmdbDetails(type, id) {
    return tmdb(`/${type}/${id}`, {
      append_to_response: 'videos,credits,watch/providers,recommendations,similar',
      include_video_language: 'pt,en,null',
    });
  }

  function tmdbSeason(id, n) {
    return tmdb(`/tv/${id}/season/${n}`);
  }

  function tmdbSearch(q, page) {
    return tmdb('/search/multi', { query: q, include_adult: 'false', page: page || 1 }).then((d) => ({
      items: (d.results || []).map((r) => fromTmdb(r)).filter((i) => i && i.poster),
      pages: Math.min(d.total_pages || 1, 500),
    }));
  }

  // Escolhe o melhor trailer do YouTube: trailer oficial em português primeiro.
  function pickTrailer(videos) {
    const list = ((videos && videos.results) || []).filter((v) => v.site === 'YouTube');
    const score = (v) =>
      (v.type === 'Trailer' ? 0 : v.type === 'Teaser' ? 2 : 4) +
      (v.iso_639_1 === 'pt' ? 0 : 1) +
      (v.official ? 0 : 0.5);
    list.sort((a, b) => score(a) - score(b));
    return list[0] ? list[0].key : null;
  }

  const img = (size, path) => (path ? IMG + size + path : '');

  /* ---------------- Internet Archive ---------------- */

  const IA_BASE = 'collection:(feature_films) AND mediatype:(movies)';

  const IA_CATS = [
    { key: 'populares', title: 'Mais assistidos', q: IA_BASE },
    { key: 'recentes', title: 'Chegaram agora', q: IA_BASE, sort: 'addeddate desc' },
    { key: 'comedia', title: 'Comédia', q: IA_BASE + ' AND subject:(comedy)' },
    { key: 'terror', title: 'Terror', q: IA_BASE + ' AND subject:(horror)' },
    { key: 'ficcao', title: 'Ficção científica', q: IA_BASE + ' AND subject:("science fiction" OR "sci-fi" OR scifi)' },
    { key: 'noir', title: 'Noir e policial', q: IA_BASE + ' AND subject:("film noir" OR noir OR crime)' },
    { key: 'faroeste', title: 'Faroeste', q: IA_BASE + ' AND subject:(western)' },
    { key: 'aventura', title: 'Aventura', q: IA_BASE + ' AND subject:(adventure)' },
    { key: 'drama', title: 'Drama', q: IA_BASE + ' AND subject:(drama)' },
    { key: 'mudos', title: 'Cinema mudo', q: IA_BASE + ' AND subject:(silent)' },
    { key: 'desenhos', title: 'Desenhos clássicos', q: 'collection:(classic_cartoons) AND mediatype:(movies)' },
  ];

  const first = (v) => (Array.isArray(v) ? v[0] : v);

  function cleanText(html) {
    if (!html) return '';
    if (Array.isArray(html)) html = html.join('\n');
    const doc = new DOMParser().parseFromString(
      String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n'),
      'text/html'
    );
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  const iaThumb = (id) => `${IA}/services/img/${encodeURIComponent(id)}`;

  function fromIa(d) {
    const id = d.identifier;
    return {
      src: 'ia',
      type: 'film',
      id,
      title: cleanText(first(d.title)) || id,
      year: String(first(d.year) || first(d.date) || '').slice(0, 4),
      poster: iaThumb(id),
      backdrop: iaThumb(id),
      overview: cleanText(first(d.description)),
      rating: 0,
    };
  }

  function iaSearch(q, opts) {
    const o = Object.assign({ rows: 24, page: 1, sort: 'downloads desc' }, opts);
    const url = new URL(IA + '/advancedsearch.php');
    url.searchParams.set('q', q);
    ['identifier', 'title', 'year', 'date', 'description'].forEach((f) => url.searchParams.append('fl[]', f));
    url.searchParams.append('sort[]', o.sort);
    url.searchParams.set('rows', o.rows);
    url.searchParams.set('page', o.page);
    url.searchParams.set('output', 'json');
    const key = url.toString();
    return persisted('ia:' + key, 12 * HOUR, () => cached(key, () => getJSON(key)).then((d) => ({
      total: (d.response && d.response.numFound) || 0,
      items: ((d.response && d.response.docs) || []).map(fromIa),
    })));
  }

  function iaCategory(key) {
    return IA_CATS.find((c) => c.key === key) || null;
  }

  function iaCatList(key, page) {
    const c = iaCategory(key);
    if (!c) return Promise.resolve({ total: 0, items: [] });
    return iaSearch(c.q, { sort: c.sort || 'downloads desc', page: page || 1, rows: page ? 36 : 24 });
  }

  function iaFind(text) {
    const words = String(text).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
    if (!words) return Promise.resolve({ total: 0, items: [] });
    return iaSearch(`${IA_BASE} AND (title:(${words}) OR subject:(${words}))`, { rows: 36 });
  }

  // Ordem de preferência dos formatos de vídeo que o navegador toca bem.
  const FORMAT_PREF = [/h\.264/i, /^mpeg4$/i, /mpeg4/i, /webm/i, /ogg/i];
  const formatRank = (f) => {
    const i = FORMAT_PREF.findIndex((re) => re.test(f.format || ''));
    return i < 0 ? FORMAT_PREF.length : i;
  };
  const baseName = (n) => n.replace(/(\.ia)?\.(mp4|m4v|webm|ogv)$/i, '').replace(/_512kb$/i, '').toLowerCase();

  function pickVideos(files) {
    const vids = (files || []).filter((f) => /\.(mp4|m4v|webm|ogv)$/i.test(f.name || ''));
    vids.sort((a, b) => formatRank(a) - formatRank(b));
    // Um mesmo filme costuma vir em vários formatos; fica só um por arquivo.
    const seen = new Map();
    for (const f of vids) {
      const k = baseName(f.name);
      if (!seen.has(k)) seen.set(k, f);
    }
    return [...seen.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
  }

  function iaDetails(id) {
    const url = `${IA}/metadata/${encodeURIComponent(id)}`;
    return cached(url, () => getJSON(url)).then((d) => {
      if (!d || !d.metadata) {
        const err = new Error('Item não encontrado');
        err.status = 404;
        throw err;
      }
      const m = d.metadata;
      const item = fromIa({
        identifier: m.identifier || id,
        title: m.title,
        year: m.year,
        date: m.date,
        description: m.description,
      });
      const subjects = [].concat(m.subject || [])
        .flatMap((s) => String(s).split(/[;,]/))
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
      return {
        item,
        creator: cleanText(first(m.creator)),
        runtime: first(m.runtime) || '',
        license: first(m.licenseurl) || '',
        subjects,
        videos: pickVideos(d.files),
      };
    });
  }

  const iaFileUrl = (id, name) =>
    `${IA}/download/${encodeURIComponent(id)}/${name.split('/').map(encodeURIComponent).join('/')}`;
  const iaPage = (id) => `${IA}/details/${encodeURIComponent(id)}`;

  T.api = {
    CATALOGS, SORTS, catalogPage, tmdbPage,
    tmdb, testKey, tmdbList, tmdbDetails, tmdbSeason, tmdbSearch, fromTmdb, pickTrailer, img,
    IA_CATS, iaCategory, iaCatList, iaFind, iaDetails, iaFileUrl, iaPage, iaThumb,
    backdropSize,
    clearCache() {
      cache.clear();
      const c = pcLoad();
      Object.keys(c).forEach((k) => { if (k.startsWith('tm:') || k.startsWith('tp:')) delete c[k]; });
      pcSave();
    },
  };
})();
