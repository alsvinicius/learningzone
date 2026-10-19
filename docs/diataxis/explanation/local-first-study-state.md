# Estado local e uso offline

A aplicação separa conteúdo de estudo do estado de leitura. Conteúdo fica em JSON e Markdown fornecidos localmente; progresso e posição em Stories ficam no armazenamento do navegador. O service worker pode guardar arquivos selecionados para uso offline.

## O que essa separação oferece

Não é necessário operar conta, banco de dados ou sincronização. Os arquivos podem ser inspecionados e copiados como arquivos comuns. Cada navegador mantém seu progresso, e a pessoa escolhe quais materiais deseja guardar offline.

O modo `make serve-private` seleciona um índice salvo em `.local/private-data/` e o entrega pela rota local do catálogo. O servidor não copia esse índice para `data/index.json`, que permanece como ponto de entrada versionado e vazio na distribuição pública.

A inicialização pela Project Gallery também seleciona o índice privado padrão quando ele existe. Assim, a instalação local abre a biblioteca pessoal e a distribuição sem dados continua vazia. Essa seleção pertence ao processo do servidor, não ao arquivo público nem ao armazenamento de progresso do navegador. Veja a [referência de comandos](../reference/development-commands.md) para trocar o catálogo.

## Limites

O progresso não acompanha a pessoa entre dispositivos e pode ser removido ao limpar dados do site. Cache não equivale a backup: o navegador pode remover arquivos. Não há recuperação remota. Ao mover para outro dispositivo, conteúdo pode ser copiado por meio privado e salvo offline novamente; progresso não será transferido automaticamente.

A escolha atende uma biblioteca local. Colaboração multiusuário, sincronização ou biblioteca hospedada exigem autenticação, política de acesso, armazenamento e um modelo de privacidade próprios.
