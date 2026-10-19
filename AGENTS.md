# Guia para agentes de código

Este arquivo é a instrução operacional para agentes que modificam o Skill Builder. Leia-o antes de editar. A aplicação é uma base open source white-label; não há certificação ou material de estudo distribuído.

## Objetivo e limites

- Manter uma aplicação estática, local-first, extensível por contrato de dados.
- Preservar a hierarquia certificação → simulado → tentativa, os materiais compartilhados e específicos por tentativa, Stories, Reports, progresso local e modo offline.
- Não introduzir conteúdo real, marca de certificação, dumps de origem, dados pessoais, telemetria, contas, backend ou sincronização.
- Não fazer publicação, deploy, release/tag, push ou alteração de configuração externa sem instrução explícita.
- Para dados de estudo, siga a skill [add-study-content](.agents/skills/add-study-content/SKILL.md). Como o catálogo público deve permanecer vazio, crie novos conteúdos somente quando a tarefa pedir e mantenha-os locais/ignorados.

## Fonte da verdade

- Contrato: [content-contract.md](docs/diataxis/reference/content-contract.md).
- Navegação documental: [Diátaxis](docs/diataxis/README.md).
- Como contribuir e validar: [CONTRIBUTING.md](CONTRIBUTING.md).
- Comandos: `Makefile` na raiz do repositório.

Leia a referência pertinente antes de mudar comportamento. Se código e documentação divergirem, verifique o comportamento implementado, corrija a fonte autoritativa e reconcilie as páginas afetadas na mesma tarefa.

## Privacidade: regra obrigatória

- `data/index.json` é o único arquivo versionável sob `data/` e começa com `certifications: []`.
- Todos os demais caminhos sob `data/` são ignorados pelo Git. Nunca use `git add -f` para incluí-los.
- `make serve-private` serve `.local/private-data/index.personal.json` pela rota local `data/index.json`, sem alterar o índice público; `make check-public` deve exigir que o catálogo versionado permaneça vazio.
- Não copie conteúdo de usuário para README, documentação, mensagens de erro, testes, screenshots ou logs.
- Não imprima ou reproduza material pessoal ao inspecionar arquivos. Para depuração, use nomes e valores sintéticos.
- Testes podem usar fixtures originais e sintéticas somente em `tests/fixtures/`, sem dados de terceiros.
- Antes de concluir: confira `git status --short`, `git diff --check` e confirme que o índice público não contém certificações.

## Regras de implementação

- Prefira HTML/CSS/JavaScript sem framework e Python padrão para ferramentas locais, salvo decisão explícita em contrário.
- Não faça chamadas de rede da interface para obter conteúdo. Mantenha o app utilizável em hospedagem estática e localhost.
- Não renderize Markdown como HTML sem sanitização. Trate caminhos do catálogo como entrada não confiável; preserve contenção ao diretório permitido.
- Preserve compatibilidade de dados locais. Mudanças incompatíveis no contrato precisam de nova versão e instrução de migração.
- Evite regressões em leitores de tela, foco visível, controles por teclado e layout móvel.
- Não altere dados locais ou limpe armazenamento do navegador como parte de testes.

## Verificação

Execute na raiz:

```bash
make check
```

Para a execução local gerenciada pela Project Gallery, use `make start` e `make stop`. O manifesto `project-gallery.json` declara a interface Web e o alvo usa a porta que a galeria fornece em `WEB_PORT`, inclusive pela atribuição `override export` gerada. `make start` seleciona o catálogo privado padrão quando ele existe, sem alterar o índice público; consulte a [referência de comandos](docs/diataxis/reference/development-commands.md) para selecionar outro catálogo ou reiniciar.

Isso roda os testes Python, testes Node e o verificador do catálogo/PWA. Para revisar visualmente, rode `make serve` e abra `http://localhost:8000/`. Não deixe processos que você iniciou rodando após a revisão.

Atualize a documentação Diátaxis correspondente:

- aprendizado inicial → `tutorials/`;
- procedimento concreto → `how-to/`;
- esquema, comandos ou comportamento observável → `reference/`;
- motivação e trade-offs → `explanation/`.

Mantenha `README.md`, `CONTRIBUTING.md`, `AGENTS.md` e os índices coerentes. Evite duplicar uma especificação completa em vários lugares; resuma e enlace a referência autoritativa.

## Fechamento de tarefa

Informe o comportamento alterado, arquivos principais, comando executado e resultado. Declare validações não executadas e limitações relevantes. Não afirme que um commit, publicação ou deploy ocorreu sem evidência explícita.
