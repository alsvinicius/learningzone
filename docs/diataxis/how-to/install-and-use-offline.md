# Como instalar e usar offline

A aplicação precisa ser servida por HTTP(S), pois navegadores não habilitam service workers em arquivos locais de forma consistente.

## Servir localmente

Na raiz, execute `make serve` e abra `http://localhost:8000/`. Para escolher outra porta: `make serve PORT=8080`. O servidor escuta apenas no loopback.

## Instalar

Em navegador compatível, use a ação de instalar/adicionar à tela inicial oferecida pelo próprio navegador. A disponibilidade varia. Hospedagem precisa de HTTPS; `localhost` é exceção.

## Guardar conteúdo offline

Abra certificação, simulado e tentativa desejados e use a ação de salvar offline. O cache inclui shell, índice, manifests selecionados, tentativa e materiais relacionados. Espere a confirmação antes de desconectar.

Materiais nunca carregados ou incluídos no salvamento podem não estar disponíveis offline. Reabra o app sem conexão para testar. O cache não é backup permanente; veja [referência do cache](../reference/pwa-cache.md).
