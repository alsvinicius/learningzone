# Estado local e uso offline

A aplicação separa conteúdo de estudo do estado de leitura. Conteúdo fica em JSON e Markdown fornecidos localmente; progresso e posição em Stories ficam no armazenamento do navegador. O service worker pode guardar arquivos selecionados para uso offline.

## O que essa separação oferece

Não é necessário operar conta, banco de dados ou sincronização. Os arquivos podem ser inspecionados e copiados como arquivos comuns. Cada navegador mantém seu progresso, e a pessoa escolhe quais materiais deseja guardar offline.

## Limites

O progresso não acompanha a pessoa entre dispositivos e pode ser removido ao limpar dados do site. Cache não equivale a backup: o navegador pode remover arquivos. Não há recuperação remota. Ao mover para outro dispositivo, conteúdo pode ser copiado por meio privado e salvo offline novamente; progresso não será transferido automaticamente.

A escolha atende uma biblioteca local. Colaboração multiusuário, sincronização ou biblioteca hospedada exigem autenticação, política de acesso, armazenamento e um modelo de privacidade próprios.
