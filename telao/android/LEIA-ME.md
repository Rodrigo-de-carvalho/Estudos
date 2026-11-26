# App Android do Telão

Arquivos usados para gerar o APK com a skill **criar-apk-android**, com ajustes para um app de vídeo:

- `MainActivity.java.modelo`: substitui o `scripts/java/MainActivity.java.modelo` da skill. Acrescenta:
  - tela cheia nos vídeos (gira para deitado);
  - vídeo começando sozinho;
  - canais `http://`;
  - **TV ao vivo pelo app**: enquanto um canal está aberto, o app busca o vídeo do canal por conta própria. Assim não há a trava de CORS dos navegadores, os cabeçalhos especiais da lista (Referer/User-Agent) são enviados e os redirecionamentos são seguidos;
  - copiar links, salvar listas e manter a tela acesa enquanto toca.
- `axml.py`: substitui o `scripts/axml.py` da skill. Libera tráfego `http://` e coloca o app no menu de TV Box (Android TV), sem exigir tela de toque.

## Gerar uma nova versão

1. Pegue o zip do projeto que você guardou (`config.txt`, `app/`, `chave/`, `android/`).
2. Monte o HTML único: `python3 ferramentas/montar_html_unico.py <projeto>/app/index.html`
3. Aumente `VERSAO_NUMERO` no `config.txt`.
4. Copie estes dois arquivos por cima dos da skill e rode `gerar_apk.sh <projeto>`.

A chave (`chave/chave.p12`) e a senha do `config.txt` **não ficam neste repositório**. Sem elas, uma atualização não instala por cima.
