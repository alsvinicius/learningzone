# Cache PWA e atualização

O service worker fornece o shell estático e mantém arquivos solicitados para uso offline. O app permite salvar um conjunto de estudo: shell, índice, manifests selecionados, tentativa e materiais referenciados.

## Limites

- O cache não é backup permanente; navegadores podem removê-lo para liberar espaço.
- Conteúdo nunca carregado ou salvo pode não abrir sem conexão.
- Cache e `localStorage` são independentes dos arquivos no disco.
- Uma atualização pode instalar nova versão e descartar entradas antigas.
- HTTPS é necessário para service worker em hospedagem; `localhost` é exceção.

## Desenvolvimento

A lista do shell é declarada no service worker. Os recursos da interface usam URLs versionadas, como `app.css?v=11` e `app.js?v=11`, tanto no HTML quanto na lista do shell. Ao atualizar essas versões, mantenha os dois locais iguais para carregar o código novo e preservá-lo offline. Essa atualização não exige apagar o cache de materiais ou o progresso em `localStorage`.

Ao mudar de forma incompatível a organização dos caches, incremente seu identificador; a ativação poderá remover caches de versões anteriores. Materiais são buscados pelos caminhos dos manifests, sujeitos às verificações de origem e contenção do catálogo.
