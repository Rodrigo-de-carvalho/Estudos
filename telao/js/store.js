/* Telão — dados salvos no navegador (chave do TMDB, Minha lista, progresso). */
(function () {
  'use strict';
  const T = (window.Telao = window.Telao || {});
  const PREFIX = 'telao.';
  const mem = {};

  // localStorage pode falhar (aba anônima, bloqueio de cookies). Nesse caso
  // os dados ficam só na memória enquanto a página estiver aberta.
  function read(k, def) {
    if (k in mem) return mem[k];
    let v = def;
    try {
      const s = localStorage.getItem(PREFIX + k);
      if (s != null) v = JSON.parse(s);
    } catch (e) { /* ignora */ }
    mem[k] = v;
    return v;
  }

  // Devolve false quando não deu para gravar (por exemplo, lista grande demais).
  function write(k, v) {
    mem[k] = v;
    try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }

  const keyOf = (it) => `${it.src}:${it.type}:${it.id}`;
  const slim = (it) => ({
    src: it.src, type: it.type, id: it.id, title: it.title,
    year: it.year, poster: it.poster, backdrop: it.backdrop,
  });

  T.store = {
    keyOf,

    getKey: () => read('tmdbKey', ''),
    setKey: (k) => write('tmdbKey', String(k || '').trim()),

    list: () => read('list', []),
    inList: (it) => read('list', []).some((x) => keyOf(x) === keyOf(it)),
    toggleList(it) {
      const l = read('list', []).slice();
      const i = l.findIndex((x) => keyOf(x) === keyOf(it));
      if (i >= 0) l.splice(i, 1); else l.unshift(slim(it));
      write('list', l);
      return i < 0;
    },
    clearList: () => write('list', []),

    progressList: () => Object.values(read('progress', {})).sort((a, b) => b.updated - a.updated),
    getProgress: (id) => read('progress', {})[id] || null,
    setProgress(it, p) {
      const all = Object.assign({}, read('progress', {}));
      all[it.id] = Object.assign({}, p, { item: slim(it), updated: Date.now() });
      write('progress', all);
    },
    clearProgress(id) {
      const all = Object.assign({}, read('progress', {}));
      delete all[id];
      write('progress', all);
    },
    clearAllProgress: () => write('progress', {}),

    /* TV ao vivo */
    tvFavs: () => read('tvFavs', []),
    isTvFav: (ch) => read('tvFavs', []).some((c) => c.id === ch.id),
    toggleTvFav(ch) {
      const l = read('tvFavs', []).slice();
      const i = l.findIndex((c) => c.id === ch.id);
      if (i >= 0) l.splice(i, 1); else l.push(ch);
      write('tvFavs', l);
      return i < 0;
    },
    tvRecent: () => read('tvRecent', []),
    pushTvRecent(ch) {
      const l = read('tvRecent', []).filter((c) => c.id !== ch.id);
      l.unshift(ch);
      write('tvRecent', l.slice(0, 12));
    },
    clearTvRecent: () => write('tvRecent', []),
    tvLists: () => read('tvLists', []),
    addTvList(list) {
      const l = read('tvLists', []).concat([list]);
      return write('tvLists', l);
    },
    removeTvList(id) {
      write('tvLists', read('tvLists', []).filter((x) => x.id !== id));
    },
    tvLastList: () => read('tvLastList', 'br'),
    setTvLastList: (id) => write('tvLastList', id),
  };
})();
