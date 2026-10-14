# Cache PWA e atualização

O service worker fornece o shell estático e mantém arquivos solicitados para uso offline. O app permite salvar um conjunto de estudo: shell, índice, manifests selecionados, tentativa e materiais referenciados.

## Limites

- O cache não é backup permanente; navegadores podem removê-lo para liberar espaço.
- Conteúdo nunca carregado ou salvo pode não abrir sem conexão.
- Cache e `localStorage` são independentes dos arquivos no disco.
- Uma atualização pode instalar nova versão e descartar entradas antigas.
- HTTPS é necessário para service worker em hospedagem; `localhost` é exceção.

## Desenvolvimento

A lista do shell é declarada no service worker. Ao renomear ou adicionar arquivos base, atualize a lista e incremente o identificador do cache. Materiais são buscados pelos caminhos dos manifests, sujeitos às verificações de origem e contenção do catálogo.
