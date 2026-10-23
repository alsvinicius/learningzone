# Preparar e atualizar o Pre-Test Review

Use este procedimento ao adicionar uma tentativa ou alterar notas, relatórios ou Stories de uma certificação. Consulte o [contrato da revisão](../reference/pre-test-review.md) para os campos e regras.

1. Trabalhe no catálogo privado e preserve os materiais existentes. Examine todas as tentativas de todos os simulados da certificação, não apenas a última. Não imprima notas nem material pessoal em logs.
2. Preserve notas da origem em `learnerNotes`. Marque pedidos explícitos com `reviewRequested: true`; use `false` apenas quando as notas não contêm pedido ou dúvida a revisar. Os demais sinais de elegibilidade continuam valendo.
3. Obtenha as entradas atuais em arquivo ignorado: `python3 tools/pretest.py --index .local/private-data/index.personal.json --snapshot-out .local/pretest-inputs.json`. O comando não gera material de estudo.
4. Prepare ou atualize o Markdown em `data/<certification-id>/pre-test-review/`. Comece com `Last-minute priorities`, priorizando pedidos explícitos e erros recorrentes. Consolide as demais lições por conceito, incluindo nuances diferentes de questões semelhantes.
5. Escreva em inglês, com bullets autônomos e siglas expandidas na primeira ocorrência. Explique o sinal da questão, a decisão, a condição que a justifica e a pegadinha. Não copie enunciados ou alternativas e não transforme relatórios inteiros em listas. Mantenha aprendizados históricos mesmo após acertos posteriores.
6. Faça uma passagem editorial por todas as questões elegíveis: confira requisitos, mecanismos, exceções, contradições e incorporação das dúvidas das notas. Consulte fontes primárias quando a explicação exigir confirmação. Uma lista montada por extração automática é rascunho, não evidência de revisão semântica.
7. Atualize o manifesto: temas, cobertura por identidade completa, links de relatório quando existentes e limitações. Se a explicação não estiver disponível, registre `pending` para aquela questão. Registre notas antigas irrecuperáveis em `gaps`; não fabrique seu conteúdo. Só após reconciliar as entradas, copie o snapshot para `inputs`, calcule `contentSha256` e atualize `updatedAt`.
8. Declare a referência no índice privado da certificação. Execute `python3 tools/pretest.py --index .local/private-data/index.personal.json`, `make check` e `make check-public`. Uma revisão registrada não pode ficar silenciosamente desatualizada.
9. Confira a página no celular e o salvamento offline com dados sintéticos. Para consultar conteúdo real, use o servidor privado sem screenshots ou logs de conteúdo. Informe tentativas consideradas, cobertura, pendências e limitações sem reproduzir material pessoal.

A revisão faz parte da entrega de conteúdo. Normalizar uma nova tentativa, isoladamente, não conclui essa atualização.

Mantenha `editorialStatus: draft` enquanto a consolidação ou a auditoria semântica estiver incompleta. Altere para `reviewed` somente após conferir todas as lições e resolver todas as questões `pending`; hashes atualizados, por si só, não autorizam essa mudança.

Ao reconciliar uma explicação com documentação oficial atual, preserve o resultado histórico da tentativa, explique a diferença temporal na revisão e registre links primários em `topics[].references`. Os links ficam recolhidos e não são necessários para entender o bullet offline.

## Maintain reading-time documents

When `readingVersions` is present, reconcile the full review first, then update the 10- and 30-minute selections alongside it. Keep complete, autonomous lessons and necessary conditions together; prioritise explicit review requests and recurring difficulty. Preserve the full synthesis in the 60-minute document, retain its coverage and historical limitations, and label the shorter versions as selections. Do not claim a new semantic audit merely because excerpts were selected automatically.

Use approximate study budgets rather than padding short reviews to a target length. Declare all three paths and hashes using the [reading-time contract](../reference/pre-test-review.md#reading-time-documents). Validate the private catalogue and test each selector choice, its direct route and the saved offline bundle. Preserve the previous documents privately before changing them.
