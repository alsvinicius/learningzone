# Implementação — Pre-Test Review

Status: ready · Revisão: 7 · Fonte: [requisitos e decisões, revisão 6](../product/pre-test-review.md). Histórico: [revisão 1](../revision-history.md#pre-test-review).

Todas as tarefas estão autorizadas pelo plano aprovado; preservar alterações preexistentes e dados privados.

| Tarefa | Entrega e dependência | Evidência de conclusão |
| --- | --- | --- |
| TASK-001 | REQ-002/004, DEC-001/002/003: contrato, notas, seleção, snapshots e validação; sem dependência | Testes Python de sinais, cobertura, isolamento, alteração e contenção; referência atualizada |
| TASK-002 | REQ-001/003/005, JRN-001/003, DEC-004: página e cache coerente; depende TASK-001 | Testes Node e navegação com fixture móvel, teclado, tema, erro e offline |
| TASK-003 | REQ-004: skill, AGENTS.md e procedimento; depende TASK-001 | Regras incluem atualização de todas as tentativas e revisão semântica |
| TASK-004 | REQ-006, JRN-004: revisões privadas; depende TASK-001/003 | Cobertura e lacunas verificadas sem divulgar dados pessoais |
| TASK-005 | REQ-001–006: verificação final; depende TASK-001–004 | make check, make check-public, verificação privada, diff --check e status; servidor de teste encerrado |
| TASK-006 | REQ-007, JRN-005, DEC-007: menu de tópicos responsivo; depende TASK-002 | Playwright: frontend real, busca, vazio, seleção, destaque, foco e Esc; desktop 1280 px, mobile 390/320 px |
| TASK-007 | REQ-007/JRN-005: contador e controles no header; depende TASK-006 | Playwright: índice inicial, avanço/retorno repetido, extremos, seleção e rolagem; desktop/celular sem overflow |

Só finalizar uma tarefa quando a evidência existir. Não considerar pendências editoriais como revisão completa. Interromper a parte dependente e registrar lacuna se faltar explicação de origem; manter o restante consultável. Próxima etapa após validação: uso local e revisão do material antes da prova; publicação não autorizada.

## Evidências de execução

- TASK-001/002/003: concluídas. Contrato, seleção e referências seguras cobertos por testes; leitor, teclado, foco, três temas e dois tamanhos exercitados com fixture sintética. Abertura offline passou inclusive após desligar o servidor. Regras de autoria documentadas.
- TASK-004: concluída. Síntese privada revisada por conceito, com cobertura integral dos sinais registrados e referências oficiais para reconciliar contradições. Notas históricas ausentes permanecem declaradas como limitação; resultados originais foram preservados. Contagens e evidência editorial permanecem locais e ignoradas pelo Git.
- TASK-005: concluída. 33 testes Python e 18 Node passaram, além de `make check-public`, catálogo privado completo e validação editorial estrutural. Navegador conferiu revisões reais sem screenshots de conteúdo e fixture sintética com teclado e links externos seguros. Evidências finais: `.local/pretest-review-qa.json` e auditoria privada por revisão.
- Próximo uso: abrir Pre-Test Review na certificação e salvar offline antes da viagem. Novas importações exigem reconciliação editorial e snapshots; o navegador anuncia alterações, sem gerar conteúdo. Nenhuma publicação faz parte da entrega.

- Correção após retorno de uso: reproduzida falha em HTTP fora de localhost por ausência de Web Crypto; fallback SHA-256 testado contra vetores independentes, leitura online restaurada e indisponibilidade de offline explicada. Drawer móvel fechado não intercepta cliques. Playwright abriu pelo controle da página inicial, fechou/restaurou foco e reabriu em desktop/celular na Gallery; também exercitou origem HTTP não segura. Recursos versionados em `v=24`, sem limpar armazenamento.

- TASK-006: concluída. Menu único na sidebar desktop e header móvel, busca, índice rolável, destaque e foco na seção. Playwright confirmou o caminho pelo frontend sem force, seleção por mouse/teclado, fechamento móvel, Esc, ausência de duplicação e de overflow. Assets `v=27`; dados pessoais preservados.

- TASK-007: concluída. Contador e botões no header sincronizados com o índice; limites sem wrap e foco mantido para uso repetido. Playwright validou avanço, retorno, último tópico, seleção e processamento da rolagem em desktop/celular; assets v28.

## TASK-008 — Reading budgets

REQ-008/JRN-006/DEC-008; depends on TASK-002/004/007. Provide 10/30/60-minute Markdown documents, a labelled selector and direct routes. Preserve the full document, private source inputs and historical coverage. Validate all hashes and reject incomplete offline updates. Update the reference and authoring procedure. Definition of done: Python/Node tests, public/private validation and Playwright from the home control on desktop/mobile, direct route, reload and offline switching. No external publication.

TASK-008 complete: 34 Python / 20 Node tests, public empty-catalog check, private catalogue validation, and diff whitespace check passed. Synthetic Playwright QA covered 1280/390/320 px, real home-control activation, all durations, direct routes, reload, offline reload/switching, and plain HTTP limitations. Personal review bytes and source snapshot preserved; excerpt selection does not constitute a new semantic audit.

- Layout follow-up (2026-10-21): reading-time selector now shares the topic-navigation row with Previous/Next and the counter. Playwright verified alignment within the viewport at 1280/390/320 px, duration changes, direct routes, reload, offline and HTTP; `make check` passed. Assets v30.
