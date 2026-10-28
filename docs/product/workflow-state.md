# Estado — Pre-Test Review

Revisão: 13 · Etapa: /mvp concluída · Histórico: [registro](../revision-history.md#pre-test-review).

- Escopo aprovado: [requisitos, jornadas e decisões](pre-test-review.md), revisão 6.
- Plano concluído: [implementação](../planning/pre-test-review.md), revisão 7; TASK-001–007 concluídas.
- Autorização confirmada: ler e trabalhar com estudos pessoais; mantê-los fora do versionamento. Nenhum conteúdo de estudo foi adicionado ao catálogo público.
- Software: 33 testes Python e 18 Node; `make check-public`, catálogo privado, cobertura e hashes passaram.
- Editorial: síntese conferida contra questões, respostas, notas e lições disponíveis; contradições reconciliadas com fontes primárias. Limitações históricas declaradas. Evidência e contagens apenas em arquivos locais ignorados.
- Navegador: revisões locais atualizadas; fixture sintética com três temas, 390/1280 px, teclado/foco, referências, estados de erro e recarga offline inclusive sem servidor.
- Evidência local: `.local/pretest-review-qa.json` e auditorias editoriais privadas. Processos de QA encerrados ao concluir.
- Próximo passo: uso local e salvamento offline antes da prova; manter a atualização editorial em cada importação. Sem decisões pendentes, commit, publicação ou deploy.
- Navegação: [Diátaxis](../diataxis/README.md).

- Correção de integração: validação anterior não cobriu HTTP fora de localhost. Falha reproduzida e corrigida; testes Playwright pela interface real da Gallery e em origem HTTP não segura, com desktop/celular, clique sem force, recarga e foco. Restrição de offline agora explícita; drawer móvel fechado não bloqueia controles.

- Menu por tópicos entregue (REQ-007/TASK-006): sidebar aberta no desktop, header recolhível no celular, busca, seção atual e foco no destino. Playwright no frontend da Gallery confirmou 1280/390/320 px, mouse/teclado, pesquisa sem resultados e Esc sem sair da revisão; assets v27.

- Contador e controles no header entregues: índice atual/total, anterior/próximo, sincronização com seleção/rolagem, limites desabilitados e foco preservado. Playwright pelo frontend validou desktop e mobile de 320 px; assets v28.

- Active change: TASK-008, requested 2026-10-21. Three reading documents and selector implemented; source review preserved, shorter selections labelled, all documents saved atomically. Unit/public/private structural checks passed; browser verification passed. Reference and how-to reconciled. TASK-008 complete. 34 Python and 20 Node tests passed; Playwright confirmed 1280/390/320 px, home control, duration selection, direct routes, reload, all three offline readings and insecure HTTP (online reading available; offline saving unavailable). Full sources preserved byte-for-byte; shortened documents contain nested selections of complete original bullets. No new semantic audit was claimed. Next action: choose a reading budget in local use; deployment remains outside this task.

- Layout follow-up (2026-10-21): reading-time selector now shares the topic-navigation row with Previous/Next and the counter. Playwright verified alignment within the viewport at 1280/390/320 px, duration changes, direct routes, reload, offline and HTTP; `make check` passed. Assets v30.

## Study paths

- Study paths are optional catalog entries with domains, modules, lessons and local completion state.
- Story and Report lessons use the shared content contract and remain separate from certification attempts.
- The public catalog remains empty; locally supplied study content is not included in the repository.
- See the [content contract](../diataxis/reference/content-contract.md), [study path guide](../diataxis/how-to/add-study-path.md) and [Reports reference](../diataxis/reference/study-reports.md).
