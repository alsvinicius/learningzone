---
name: add-study-content
description: Adiciona e organiza conteúdo privado de certificações, tentativas, Stories e trilhas de estudo por domínio no Skill Builder. Use ao importar, editar ou validar materiais locais.
---

# Adicionar conteúdo de estudo

Esta skill orienta a inclusão de conteúdo local no Skill Builder. O contrato versionado é a fonte normativa: consulte [`docs/diataxis/reference/content-contract.md`](../../../docs/diataxis/reference/content-contract.md) e não invente formatos paralelos.

## Procedimento

1. Identifique se o material é uma certificação/tentativa ou uma trilha de estudo. Quando a tarefa autorizar conteúdo local, consulte o catálogo selecionado; não assuma que o índice público representa outros materiais locais.
2. Crie ou atualize `data/<certification-id>/<exam-id>/exam.json` e registre o simulado no catálogo. Materiais compartilhados pertencem a `shared/` e são declarados em `exam.json`.
3. Para cada prova realizada, preserve o ID de origem em `attempts/<attempt-id>/attempt.json`. Normalize resultados e questões para o formato comum do contrato. Use o conversor local existente para a origem AWS Skill Builder (`tools/normalize.py`); para nova origem, implemente um adaptador local sem alterar a interface nem inferir respostas ausentes.
4. Coloque relatórios em `attempts/<attempt-id>/reports/` e Stories em `attempts/<attempt-id>/cards/`. Declare cada material no manifesto proprietário. Associe materiais às questões com `questions[].materials`, usando `scope: exam` para conteúdo compartilhado e `scope: attempt` para conteúdo da tentativa.
5. Não sobrescreva tentativas ou materiais existentes sem preservar uma cópia e comparar os resultados. IDs de certificação, simulado e material são slugs; `attemptId` conserva o identificador da fonte.
6. Valide tudo com `make check`. Resolva cada erro antes de entregar. Depois, abra `make serve` e confira navegação, relatórios, Stories e materiais nos escopos afetados.
7. Informe quais arquivos foram adicionados, a origem, os IDs registrados e o resultado da validação. Marque claramente fixtures sintéticas; nunca as apresente como resultados reais.

## Conteúdo privado local

- Leia ou edite materiais de um catálogo local somente quando a tarefa autorizar; eles ficam em diretórios ignorados sob `data/` e no índice local selecionado.
- Nunca use `git add -f` para versionar conteúdo privado. Preserve `data/index.json` vazio para distribuição pública.
- Não copie conteúdo de catálogo local para documentação, fixtures versionadas, screenshots, logs ou mensagens de diagnóstico. Para validar, use o caminho do índice selecionado com `python3 tools/check.py --index <caminho-do-indice> --quiet` e resuma somente contagens/estado.
- Para uma trilha, siga `docs/diataxis/how-to/add-study-path.md`; `studies` é independente da hierarquia certificação → simulado → tentativa.
- Stories de estudo são lições `type: "story"` independentes de tentativas; um domínio pode ter quantos Stories forem necessários. Use `Story mode: learning` para desenvolver conceitos sem inventar erros ou respostas de certificação. Siga o formato e a validação em `docs/diataxis/reference/story-card-format.md`.

## Escrever um Story

Um Story é uma lição autônoma. O formato normativo e a autoria separada por contexto estão em [`docs/diataxis/reference/story-card-format.md`](../../../docs/diataxis/reference/story-card-format.md).

- **Certificação/tentativa:** use as quatro seções históricas `Topic`, `Why you got it wrong`, `Why the right answer was different`, `Concepts to nail it next time`. Domain e Task usam os códigos oficiais; Topic declara a paráfrase das respostas real e gabaritada, e o texto explica o erro ou a dúvida registrada. Nunca invente resposta ou erro.
- **Trilha de estudo:** declare `**Story mode**: learning`, `Domain` (ID declarado no estudo), `Task` (capacidade) e `Signal` (tensão do caso). Use `Topic`, `Where the initial model breaks`, `A more complete model`, `Concepts to nail it next time`, nessa ordem. Apresente `Initial model` e `Improved model` como modelos didáticos, não como resposta atribuída ao leitor. Não invente códigos oficiais, número de questão, gabarito ou erro pessoal. Um domínio pode ter vários Stories; cada um deve aprofundar uma tensão ou mecanismo distinto.
- Quando os Stories forem um percurso conceitual completo, dimensione-os pelos conceitos dos materiais, sem cota por domínio. Mantenha uma matriz local ignorada de materiais/seções → Stories, conceitos, lacunas e hashes; revise semanticamente cada mecanismo e suas condições. Cada cartão deve bastar para entender seu assunto, com definição, limites, decisão e pergunta respondida. Consulte a [referência de cobertura](../../../docs/diataxis/reference/story-card-format.md#cobertura-conceitual-de-uma-trilha); mapeamento automático não comprova qualidade editorial.
- Nos dois formatos, Concepts é uma lista de memorização e termina com `The sentence to keep:`. Não faça o Story depender de relatório ou comentário externo.

Para Reports de trilha, declare uma lição `type: "report"` sem questão/tentativa. Siga a [referência de Reports](../../../docs/diataxis/reference/study-reports.md): mecanismos, alternativas, falhas, operação, caso resolvido, defesa e limites. Mantenha matriz e auditorias privadas; confira o botão Reports na aplicação real da Gallery após abrir uma certificação e depois a trilha.

## Limites

- A aplicação e o progresso são locais; não introduza backend, sincronização ou chamadas de rede.
- Não adicione segredos, dumps de origem ou dados temporários à árvore versionada.
- O validador e o contrato determinam caminhos, campos, IDs e relações válidos.
- O conteúdo em `data/` é privado e ignorado pelo Git. Nunca force a inclusão do índice preenchido ou dos materiais.
- Se a origem não fornecer um dado, preserve a ausência em vez de inventá-lo.

## Pre-Test Review — parte obrigatória da entrega

Ao importar uma tentativa ou alterar notas, relatórios ou Stories, atualize a revisão **de toda a certificação**, incluindo os demais simulados e tentativas. Não encerre a entrega apenas após normalizar os dados. O agente escreve a síntese; o app somente lê conteúdo local. Consulte o [procedimento completo](../../../docs/diataxis/how-to/update-pre-test-review.md) e o [contrato](../../../docs/diataxis/reference/pre-test-review.md).

- Preserve notas da origem em `learnerNotes` e classifique pedidos com `reviewRequested`. Notas não classificadas são incluídas conservadoramente; `false` dispensa apenas esse sinal.
- Inclua incorretas, puladas, educated guesses, unsure, flags e pedidos explícitos, mesmo quando corretas. Acertos posteriores não apagam a lição histórica.
- Escreva em inglês; comece com `Last-minute priorities` e consolide por conceito. Cada bullet deve esclarecer termos, mecanismo, condição de uso, sinais de decisão e pegadinhas pertinentes. Não copie enunciados/alternativas nem cole relatórios inteiros.
- Reconcile repetições e contradições preservando exceções. Confira editorialmente cada questão elegível e consulte fontes primárias quando necessário. Extração automática é rascunho e não comprova síntese ou revisão semântica. Quando corrigir uma regra da origem com documentação atual, registre o contexto temporal e associe a referência primária ao tema; preserve respostas e pontuações históricas.
- Declare cobertura por identidade completa; se faltar explicação suficiente, registre `pending`. Registre notas antigas irrecuperáveis em `gaps` e informe essas limitações na entrega.
- Atualize fingerprints somente depois dessa conferência. Execute `python3 tools/pretest.py --index <caminho-do-indice>` (ou o índice selecionado), além de `make check` e `make check-public`. Não altere o catálogo público nem imprima conteúdo do catálogo local.
- Preserve `editorialStatus: draft` até concluir a revisão semântica e resolver todos os `pending`. Só então marque `reviewed`; não esconda um rascunho atrás de hashes atualizados.

Quando o manifesto declarar `readingVersions`, mantenha juntos os documentos de 10, 30 e 60 minutos. Reconcilie primeiro a síntese completa de 60 minutos, depois as seleções de bullets autônomos, preservando condições e exceções. Atualize os três hashes; versões curtas não comprovam cobertura integral nem uma nova auditoria semântica. Consulte o [contrato de duração](../../../docs/diataxis/reference/pre-test-review.md#reading-time-documents).
