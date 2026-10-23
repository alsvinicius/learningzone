# Histórico de artefatos de produto

## Pre-Test Review

- 2026-10-20 — revisão 1 de `product/pre-test-review.md`, `planning/pre-test-review.md` e `product/workflow-state.md`: plano aprovado registrado, requisitos/jornadas/decisões e execução inicial. Evidências finais serão reconciliadas ao concluir a implementação.

- 2026-10-20 — revisão 2 dos três artefatos Pre-Test Review: funcionalidade e documentação implementadas; software validado (32 Python, 16 Node, catálogo público/privado e navegador). Auditoria semântica ainda incompleta naquele checkpoint; atualização posterior registrada abaixo.

- 2026-10-20 — revisão 3 dos três artefatos Pre-Test Review: autorização de leitura pessoal confirmada; síntese editorial concluída em arquivos ignorados, correções com referências oficiais, suporte a links primários por tema. 33 testes Python e 17 Node, catálogo público/privado e navegador passaram. Todas as tarefas concluídas; evidências pessoais mantidas locais.

- 2026-10-20 — revisão 4 do plano e workflow-state: após falha relatada no frontend, reproduzida dependência de Web Crypto em HTTP não seguro e corrigida com SHA-256 local equivalente; botão offline explica a restrição do navegador. Drawer móvel fechado deixa de interceptar controles. Validação Playwright desde a página inicial, desktop/celular, Gallery e HTTP fora de localhost; 33 Python + 18 Node passaram. Requisitos permanecem na revisão 3.

- 2026-10-20 — requisitos revisão 4; plano e workflow-state revisão 5: menu por tópicos solicitado pelo usuário, REQ-007/JRN-005/DEC-007/TASK-006. Índice único pesquisável na sidebar desktop e header móvel, com seção atual, foco e fechamento contextual. Playwright no frontend real validou desktop e celular, busca, saltos, teclado e layout; contrato e estudos pessoais preservados.

- 2026-10-20 — requisitos revisão 5; plano e workflow-state revisão 6: contador atual/total e navegação anterior/próximo solicitados para o header (REQ-007/TASK-007). Contagem sincronizada com a seção ativa e limites sem wrap; Playwright validou os controles no frontend, seleção, rolagem e layout móvel.

- 2026-10-21 — requirements revision 6; plan and workflow state revision 7: user requested separate 10/30/60-minute documents (REQ-008/JRN-006/DEC-008/TASK-008). Optional reading documents, duration routes and atomic offline bundle; shorter selections retain complete lessons, with full coverage preserved in the canonical document.

## Certification Gallery

- 2026-10-23 — revisão 1 dos requisitos, plano e estado: requisitos/jornadas/decisões e TASK-001 registrados a partir do pedido para arquivar certificações e consultar uma galeria local.
- 2026-10-23 — revisão 2 do estado: TASK-001 implementada; arquivamento/restauração em localStorage, galeria, documentação Diátaxis, 34 testes Python, 24 Node, verificação do catálogo público e revisão visual sintética em desktop/celular concluídas.
