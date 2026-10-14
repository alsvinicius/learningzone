# Arquitetura da aplicação

O Skill Builder separa apresentação, conteúdo declarativo, estado local e ferramentas de autoria. Essa divisão permite trocar o catálogo sem acoplar a interface a uma certificação, fornecedor ou formato bruto.

## Fluxo de leitura

`data/index.json` declara certificações, simulados e tentativas. `exam.json` descreve título e materiais compartilhados. `attempt.json` apresenta resultados normalizados e materiais próprios. Questões apontam para materiais por escopo e ID. O app resolve os vínculos para carregar Markdown.

A interface (`index.html`, `app.js`, `app.css`) opera sobre o modelo comum. `progress.js` armazena posição e marcas no navegador. `cache-utils.js` seleciona arquivos para salvar; `sw.js` atende shell e cache offline. Esses componentes não dependem de servidor de aplicação.

## Ferramentas de autoria

`tools/content.py` valida catálogo e caminhos. `tools/check.py` verifica tentativa e recursos PWA. `tools/normalize.py` adapta localmente uma fonte suportada ao contrato canônico. Adaptadores específicos devem permanecer isolados e não adicionar ramificações de certificação à interface.

## Consequências

O formato é legível, versionável e utilizável offline. Não há busca entre dispositivos, permissões multiusuário, backup remoto ou sincronização. Compatibilidade depende da versão do contrato; mudanças incompatíveis precisam de migração documentada.

Veja as referências de [conteúdo](../reference/content-contract.md), [tentativa](../reference/attempt-data.md), [comandos](../reference/development-commands.md) e [cache](../reference/pwa-cache.md).
