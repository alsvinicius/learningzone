---
name: add-study-content
description: Adiciona certificações, simulados, tentativas, relatórios e Stories ao Skill Builder. Use quando importar ou organizar conteúdo de estudo neste repositório.
---

# Adicionar conteúdo de estudo

Esta skill orienta a inclusão de conteúdo local no Skill Builder. O contrato versionado é a fonte normativa: consulte [`docs/diataxis/reference/content-contract.md`](../../../docs/diataxis/reference/content-contract.md) e não invente formatos paralelos.

## Procedimento

1. Identifique a certificação, o simulado e a origem dos arquivos. Confira `data/index.json` para evitar criar IDs ou caminhos duplicados.
2. Crie ou atualize `data/<certification-id>/<exam-id>/exam.json` e registre o simulado no catálogo. Materiais compartilhados pertencem a `shared/` e são declarados em `exam.json`.
3. Para cada prova realizada, preserve o ID de origem em `attempts/<attempt-id>/attempt.json`. Normalize resultados e questões para o formato comum do contrato. Use o conversor local existente para a origem AWS Skill Builder (`tools/normalize.py`); para nova origem, implemente um adaptador local sem alterar a interface nem inferir respostas ausentes.
4. Coloque relatórios em `attempts/<attempt-id>/reports/` e Stories em `attempts/<attempt-id>/cards/`. Declare cada material no manifesto proprietário. Associe materiais às questões com `questions[].materials`, usando `scope: exam` para conteúdo compartilhado e `scope: attempt` para conteúdo da tentativa.
5. Não sobrescreva tentativas ou materiais existentes sem preservar uma cópia e comparar os resultados. IDs de certificação, simulado e material são slugs; `attemptId` conserva o identificador da fonte.
6. Valide tudo com `make check`. Resolva cada erro antes de entregar. Depois, abra `make serve` e confira navegação, relatórios, Stories e materiais nos escopos afetados.
7. Informe quais arquivos foram adicionados, a origem, os IDs registrados e o resultado da validação. Marque claramente fixtures sintéticas; nunca as apresente como resultados reais.

## Escrever um Story

Um Story é uma **lição autônoma de quatro ecrãs**, não um resumo de relatório. Quem o abre entende a situação, a decisão, o motivo do erro e o que memorizar sem sair da tela. O formato está em [`docs/diataxis/reference/story-card-format.md`](../../../docs/diataxis/reference/story-card-format.md) e o passo a passo em [`docs/diataxis/how-to/write-story-card.md`](../../../docs/diataxis/how-to/write-story-card.md).

As quatro secções são tokens do contrato, nesta ordem exata: `Topic`, `Why you got it wrong`, `Why the right answer was different`, `Concepts to nail it next time`.

Regras que o validador e a leitura exigem:

- `Domain` e `Task` começam pelo código numérico oficial.
- O ecrã `Topic` declara **Your answer** e **Correct answer**, em paráfrase fiel que nomeia todos os mecanismos da opção, sem copiar o enunciado nem as alternativas.
- `Why you got it wrong` explica o erro por inteiro. Para resposta correta, não invente erro: explique o que estava certo e consolide a dúvida registrada.
- `Why the right answer was different` mapeia cada exigência do enunciado ao mecanismo que a satisfaz e explica por que a alternativa mais tentadora falha.
- `Concepts to nail it next time` é lista de memorização com pelo menos dois itens e termina em "The sentence to keep:".

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
- Atualize fingerprints somente depois dessa conferência. Execute `python3 tools/pretest.py --index .local/private-data/index.personal.json` (ou o índice privado escolhido), além de `make check` e `make check-public`. Não altere o catálogo público nem imprima conteúdo pessoal.
- Preserve `editorialStatus: draft` até concluir a revisão semântica e resolver todos os `pending`. Só então marque `reviewed`; não esconda um rascunho atrás de hashes atualizados.

Quando o manifesto declarar `readingVersions`, mantenha juntos os documentos de 10, 30 e 60 minutos. Reconcilie primeiro a síntese completa de 60 minutos, depois as seleções de bullets autônomos, preservando condições e exceções. Atualize os três hashes; versões curtas não comprovam cobertura integral nem uma nova auditoria semântica. Consulte o [contrato de duração](../../../docs/diataxis/reference/pre-test-review.md#reading-time-documents).
