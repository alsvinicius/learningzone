# Pre-Test Review — requisitos e decisões

Status: ready · Revisão: 6 · Fonte: plano aprovado nesta conversa em 2026-10-20; implementação do contrato v1 e leitor existentes.

Histórico: [revisão 1](../revision-history.md#pre-test-review). Execução: [plano](../planning/pre-test-review.md).

## Requisitos confirmados

- REQ-001: página por certificação, agregando todos os simulados e tentativas.
- REQ-002: incluir erros, guesses, insegurança, questões puladas, flags e pedidos nas notas; preservar aprendizados históricos.
- REQ-003: inglês, bullets autônomos, prioridades no topo e conceitos consolidados; esclarecer mecanismos, condições e pegadinhas.
- REQ-004: agente atualiza durante autoria; instruções obrigatórias na skill e no AGENTS.md; detectar cobertura incompleta e entradas alteradas.
- REQ-005: leitura móvel e offline, integridade de versões, privacidade e compatibilidade com catálogos anteriores.
- REQ-006: preparar as revisões locais existentes; sinalizar explicações ou notas irrecuperáveis sem inventar conteúdo.

- REQ-007: índice pesquisável por tópicos, persistente na sidebar desktop e acessível pelo header móvel; destaque da seção atual, teclado e fechamento após seleção no celular. Contador atual/total e controles anterior/próximo no header acompanham a posição e respeitam os limites.

## Jornadas e aceitação

- JRN-001 → REQ-001/003/005: selecionar uma certificação, abrir a revisão e ler prioridades e temas sem escolher uma tentativa; rota direta, teclado, impressão e temas funcionam.
- JRN-002 → REQ-002/004: importar tentativa, preservar notas, reconciliar síntese e cobertura; nova tentativa ou alteração em material invalida o snapshot anterior.
- JRN-003 → REQ-005: salvar uma revisão inteira, desconectar e reabrir; falha parcial não substitui uma cópia coerente nem anuncia sucesso.
- JRN-004 → REQ-006: consolidar dados antigos disponíveis; questões sem fonte explicativa mantêm pendência visível.

- JRN-005 → REQ-007/005: abrir pelo frontend, pesquisar um tópico e saltar à seção; no celular, reabrir o menu durante a leitura e fechá-lo com Esc sem sair da revisão.

## Decisões técnicas

- DEC-001: extensão opcional ao contrato v1, manifesto por certificação e Markdown local. Interface estática, sem serviço de geração.
- DEC-002: snapshots determinísticos com SHA-256, cobertura por identidade completa e validação Python/JS; cache atômico do conjunto para leitura offline.
- DEC-003: notas não classificadas entram conservadoramente; `reviewRequested: false` exclui somente o sinal das notas. A ausência de nota não apaga os demais sinais.
- DEC-004: leitor existente e estilo visual existente; estados ausente, pendente, desatualizado e não verificável explícitos.


- DEC-005: atualização dos arquivos e conclusão editorial são estados independentes. Rascunhos são anunciados; `reviewed` não pode conter questões pendentes. Essa proteção aplica o requisito de revisão semântica do plano aprovado.

- DEC-006: referências primárias HTTPS opcionais por tema, recolhidas junto às questões; correções temporais explícitas preservam os resultados históricos. Links externos não são pré-requisito para compreender os bullets offline.

- DEC-007: um único índice é movido entre sidebar (>900 px) e header (até 900 px), evitando duplicação de controles; menu com busca, rolagem própria e foco no destino. A sidebar fica aberta; o menu móvel começa recolhido.

Não há decisões de produto em aberto. O usuário autorizou leitura e preparação do conteúdo pessoal; o limite confirmado é não versioná-lo. Regras normativas: [referência](../diataxis/reference/pre-test-review.md).

## Reading budgets (2026-10-21)

- REQ-008: offer three separate, self-contained local documents for approximately 10 minutes, 30 minutes and 1 hour. The 1-hour document retains the full synthesis and question coverage; shorter documents select complete lessons prioritising explicit requests and recurrent difficulty. Reading time is a study budget, not a measured guarantee.
- JRN-006 → REQ-008/005: open Pre-Test Review, choose a reading time, reload or follow its direct route, and read any of the three documents offline after saving once.
- DEC-008 → REQ-008: optional `readingVersions` in the existing v1 manifest, with per-document SHA-256. The full review remains canonical. One atomic offline bundle contains all three; existing single-document reviews remain compatible. Short documents do not claim full question coverage or a new semantic audit.
