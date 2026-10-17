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

## Limites

- A aplicação e o progresso são locais; não introduza backend, sincronização ou chamadas de rede.
- Não adicione segredos, dumps de origem ou dados temporários à árvore versionada.
- O validador e o contrato determinam caminhos, campos, IDs e relações válidos.
- O conteúdo em `data/` é privado e ignorado pelo Git. Nunca force a inclusão do índice preenchido ou dos materiais.
- Se a origem não fornecer um dado, preserve a ausência em vez de inventá-lo.
