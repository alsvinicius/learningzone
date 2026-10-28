# Guia para agentes de código

Este arquivo é a instrução operacional para agentes que modificam o Skill Builder. Leia-o antes de editar. A aplicação é uma base open source white-label; não há certificação ou material de estudo distribuído.

## Objetivo e limites

- Manter uma aplicação estática, local-first, extensível por contrato de dados.
- Preservar a hierarquia certificação → simulado → tentativa, os materiais compartilhados e específicos por tentativa, Stories, Reports, progresso local e modo offline.
- Não inclua conteúdo de catálogos locais no produto público, telemetria, contas, backend ou sincronização. Só consulte ou edite um catálogo local quando a tarefa autorizar; nunca o versione nem o copie para fixtures, screenshots ou logs rastreados.
- Não fazer publicação, deploy, release/tag, push ou alteração de configuração externa sem instrução explícita.
- Para dados de estudo, siga a skill [add-study-content](.agents/skills/add-study-content/SKILL.md). Como o catálogo público deve permanecer vazio, crie novos conteúdos somente quando a tarefa pedir e mantenha-os locais/ignorados.

## Fonte da verdade

- Contrato: [content-contract.md](docs/diataxis/reference/content-contract.md).
- Navegação documental: [Diátaxis](docs/diataxis/README.md).
- Como contribuir e validar: [CONTRIBUTING.md](CONTRIBUTING.md).
- Comandos: `Makefile` na raiz do repositório.

Leia a referência pertinente antes de mudar comportamento. Se código e documentação divergirem, verifique o comportamento implementado, corrija a fonte autoritativa e reconcilie as páginas afetadas na mesma tarefa.

## Stories de certificação: lição autônoma, não resumo

Um Story é material de estudo, não um extrato de relatório. Quem abre o cartão entende a situação, a decisão, o motivo do erro e o que memorizar sem sair da tela.

- As quatro secções são tokens do contrato, nesta ordem: `Topic`, `Why you got it wrong`, `Why the right answer was different`, `Concepts to nail it next time`. O formato está em [story-card-format.md](docs/diataxis/reference/story-card-format.md).
- `Domain` e `Task` começam pelo código numérico oficial. Quando a origem só publica agregados, a atribuição por questão é uma reconstrução editorial: aceite-a quando ela reproduz as contagens oficiais por tarefa e por domínio, e registre isso no README da tentativa.
- O ecrã `Topic` declara `**Your answer**` e `**Correct answer**` em paráfrase fiel, nomeando todos os mecanismos da opção. Não copie o enunciado nem as alternativas da origem.
- `Why you got it wrong` explica o erro inteiro. Para resposta correta, não invente erro: explique o que estava certo e consolide a dúvida registrada.
- `Why the right answer was different` mapeia cada exigência ao mecanismo e derruba a alternativa mais tentadora.
- `Concepts to nail it next time` é lista de memorização com itens de lista e termina em "The sentence to keep:".
- Um Story não remete a um relatório, a um comentário ou a uma "fonte" como se o leitor os tivesse. Quem o escreve pode usar o relatório; quem o lê não precisa dele.
- Stories em trilhas de estudo não pertencem a questões nem tentativas. Podem existir vários por domínio. Declare `Story mode: learning` e use as telas de hipótese inicial, limites do modelo, explicação completa e conceitos conforme [Formato Stories](docs/diataxis/reference/story-card-format.md#stories-em-trilhas-de-estudo); nunca invente código oficial, resposta de aluno ou erro do leitor.

Stories que ofereçam um percurso conceitual completo devem cobrir os conceitos dos materiais extensos, com quantidade determinada pela cobertura. A matriz editorial permanece privada; confira definições, mecanismos, condições e limites, sem tratar contagens ou hashes como prova semântica. Veja o [critério de cobertura](docs/diataxis/reference/story-card-format.md#cobertura-conceitual-de-uma-trilha).

Reports em trilhas são lições independentes, com aprofundamento e evidência editorial privada. Preserve mecanismos, condições e limites; valide o índice contextual e a leitura conforme a [referência de Reports](docs/diataxis/reference/study-reports.md). Não reconcilie Pre-Test Review de certificação ao adicionar apenas lições de uma trilha sem vínculo com tentativas.

## Privacidade: regra obrigatória

- Itens pessoais nunca pertencem aos arquivos versionados: dados de certificação e estudo, tentativas, respostas, notas, progresso, metas, planos individuais, nomes, identificadores, URLs privadas, caminhos da máquina, screenshots e registros que revelem o contexto de uma pessoa.
- A documentação pública e as skills versionadas descrevem capacidades genéricas do produto. Não registrem que alguém está estudando uma certificação, carreira ou assunto específico, nem incluam exemplos derivados de seu histórico. Use somente exemplos sintéticos originais e identificados como tais.
- Quando uma tarefa exigir consultar itens pessoais, mantenha-os em `data/` ou `.local/`, confirme que o caminho está ignorado e não os mova, renomeie ou apague sem autorização explícita. Se um artefato local tiver sido criado dentro de `docs/`, preserve-o em local ignorado antes de removê-lo da documentação pública.
- Antes de concluir uma mudança documental ou de conteúdo, revise arquivos rastreados, staged, modificados e não rastreados. Procure referências ao contexto particular da tarefa, nomes, caminhos absolutos, notas, resultados e metadados; confirme com `git check-ignore` que itens locais não podem entrar no próximo commit.
- `data/index.json` é o único arquivo versionável sob `data/` e começa com `certifications: []`.
- Todos os demais caminhos sob `data/` são ignorados pelo Git. Nunca use `git add -f` para incluí-los.
- `make serve-private` serve `.local/private-data/index.personal.json` pela rota local `data/index.json`, sem alterar o índice público; `make check-public` deve exigir que o catálogo versionado permaneça vazio.
- Consulte e edite conteúdo de catálogo local apenas quando a tarefa autorizar; nunca o versione nem o reproduza em README, documentação, skills, testes, screenshots ou logs rastreados.
- Ao depurar catálogos locais, use validação quieta e resumos estruturais sem texto do conteúdo. Testes e fixtures versionados continuam usando apenas dados sintéticos.
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

Ao alterar navegação, valide com Playwright o caminho desde a página inicial pelo controle visível, além da rota direta e da recarga. Confira desktop e celular com clique real ou teclado, sem usar `force` para contornar controles obstruídos. Para funcionalidades que dependem de APIs restritas a contexto seguro, confira também HTTP fora de localhost e explicite os recursos indisponíveis.

Atualize a documentação Diátaxis correspondente:

- aprendizado inicial → `tutorials/`;
- procedimento concreto → `how-to/`;
- esquema, comandos ou comportamento observável → `reference/`;
- motivação e trade-offs → `explanation/`.

Mantenha `README.md`, `CONTRIBUTING.md`, `AGENTS.md` e os índices coerentes. Evite duplicar uma especificação completa em vários lugares; resuma e enlace a referência autoritativa.

## Fechamento de tarefa

Informe o comportamento alterado, arquivos principais, comando executado e resultado. Declare validações não executadas e limitações relevantes. Não afirme que um commit, publicação ou deploy ocorreu sem evidência explícita.

## Pre-Test Review: atualização obrigatória

- Ao adicionar ou alterar tentativas, notas, Reports ou Stories, reconcilie o Pre-Test Review de toda a certificação antes de concluir a entrega de conteúdo. Siga o [procedimento](docs/diataxis/how-to/update-pre-test-review.md) e o [contrato autoritativo](docs/diataxis/reference/pre-test-review.md).
- Inclua todos os sinais de erro/dúvida e pedidos nas notas, inclusive em acertos; mantenha aprendizados antigos e consolide por conceito. Escreva em inglês, em bullets autônomos, com prioridades, condições, estratégias e pegadinhas.
- Faça revisão semântica de cada questão elegível. Não apresente extração automática, fingerprints ou cobertura estrutural como prova de correção editorial. Registre pendências e notas irrecuperáveis sem inventar conteúdo.
- Só atualize o snapshot após reconciliar a síntese. Valide explicitamente o catálogo local sem imprimir seu conteúdo; `make check` com índice público vazio não valida outros catálogos.

## Product workflow

- Requisitos, jornadas e decisões: [Pre-Test Review](docs/product/pre-test-review.md). Estado e plano: [workflow-state](docs/product/workflow-state.md).
- Antes de modificar a funcionalidade, leia as tarefas e fontes vinculadas. Atualize os artefatos e a documentação afetada quando o comportamento ou os requisitos mudarem.
