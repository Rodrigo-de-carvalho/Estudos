# Telão

App de filmes e séries com cara de app de streaming, feito só com HTML, CSS e JavaScript puro, sem framework e sem etapa de build. Funciona no celular, no computador e na TV (dá pra navegar com as setas do controle remoto).

Só usa fontes legais:

| O quê | De onde vem | Precisa de chave? |
|---|---|---|
| Catálogo de filmes e séries, capas, sinopses, elenco, temporadas e episódios | [TMDB](https://www.themoviedb.org) | Sim, gratuita |
| Trailers | YouTube, via TMDB | Sim (a do TMDB) |
| Onde assistir no Brasil (Netflix, Globoplay, Pluto TV…) | JustWatch, via TMDB | Sim (a do TMDB) |
| Filmes completos que tocam dentro do app | [Internet Archive](https://archive.org/details/feature_films) (domínio público ou licença livre) | Não |
| Canais de TV ao vivo | Listas M3U do [IPTV-org](https://github.com/iptv-org/iptv) (canais transmitidos de graça e publicamente) | Não |

Sem a chave do TMDB, o app já funciona com os filmes grátis do Internet Archive.

## O que tem

- Início com destaque rotativo e fileiras: em alta, grátis com anúncios no Brasil, populares, nos cinemas, produções brasileiras…
- Abas de Filmes e Séries com fileiras por gênero (inclui animes e reality shows)
- Página de cada título com trailer, elenco, temporadas e episódios, e **onde assistir no Brasil**
- **Assista grátis**: filmes completos por categoria (terror, comédia, noir, faroeste, cinema mudo, desenhos…), com "Ver tudo" e "Carregar mais"
- Player que lembra onde você parou, com fileira **Continuar assistindo**
- **Minha lista**
- Busca no catálogo e nos filmes grátis ao mesmo tempo
- **TV ao vivo** (veja abaixo)
- Navegação por setas e botão Voltar do controle (Escape/Backspace no teclado)

## TV ao vivo

- Listas prontas do IPTV-org: Brasil, Em português, Portugal, Notícias, Infantil, Música, Documentários e Mundo todo
- Filtro por nome e por categoria (Variedades, Notícias, Legislativo, Educação…)
- Player com troca de canal (botões Anterior/Próximo, lista lateral, PageUp/PageDown ou os botões de canal do controle)
- Favoritos (aparecem também no Início como "Seus canais") e "Vistos por último"
- **Adicionar lista**: cole o link de qualquer lista M3U ou abra um arquivo `.m3u` do aparelho
- **VLC**:
  - **Abrir no VLC**: no Android, abre o canal direto no app do VLC. No iPhone, usa o link do VLC para iOS. No computador, baixa um `.m3u` daquele canal.
  - **Baixar lista (.m3u)**: baixa todos os canais filtrados, para abrir no VLC.
  - **Copiar link da lista**: para colar em *Mídia → Abrir fluxo de rede* no VLC.

Os canais tocam com o player do próprio navegador ou com o [hls.js](https://github.com/video-dev/hls.js) (incluído em `vendor/`, licença Apache 2.0).
Alguns canais não tocam no navegador:
- os que exigem cabeçalhos especiais (marcados "Só no VLC");
- servidores que bloqueiam acesso vindo de sites;
- canais só em `http://` quando o Telão está publicado em `https://`.

Para esses, use o botão do VLC. Também há canais que ficam fora do ar ou que só funcionam no país de origem.

## Como rodar

Abra o arquivo `index.html` no navegador. Pronto.

Se preferir um servidor local (recomendado para instalar como app no celular):

```bash
cd telao
python3 -m http.server 8000
# abra http://localhost:8000
```

## Como liberar o catálogo completo

1. Crie uma conta grátis em <https://www.themoviedb.org/signup>.
2. Vá em **Configurações → API** (<https://www.themoviedb.org/settings/api>) e peça uma chave para uso pessoal.
3. No Telão, abra a engrenagem (Configurações), cole a **Chave da API** ou o **Token de leitura da API** e clique em **Salvar e testar**.

A chave fica salva só no seu navegador.

## Como publicar na internet

Como é um site estático, qualquer hospedagem gratuita serve:

- **GitHub Pages**: no repositório, vá em *Settings → Pages*, escolha a branch e a pasta, e o app fica em `https://<seu-usuario>.github.io/Estudos/telao/`.
- **Vercel** ou **Netlify**: importe o repositório e defina `telao` como pasta raiz.

## Arquivos

```
telao/
├── index.html            estrutura da página (topo, menu, rodapé)
├── manifest.webmanifest  permite "instalar" no celular
├── css/style.css         todo o visual
├── img/icon.svg          ícone
├── vendor/hls.min.js     player de streams ao vivo (hls.js 1.5.20)
└── js/
    ├── store.js          o que fica salvo no navegador (chave, lista, progresso)
    ├── api.js            conversa com o TMDB e o Internet Archive
    ├── tv.js             TV ao vivo: leitura de M3U, player HLS, favoritos e VLC
    └── app.js            telas, rotas (#/filmes, #/t/...), player e navegação por setas
```

## Ideias para continuar

- Guia de programação (EPG) dos canais
- Legendas nos filmes do Internet Archive que tiverem arquivo `.srt`
- Empacotar como app Android (com Capacitor ou como TWA)
- Perfis diferentes para cada pessoa da casa

---

Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
