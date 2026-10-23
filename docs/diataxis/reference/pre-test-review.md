# Pre-Test Review

Uma revisão pertence à certificação inteira, independentemente do simulado ou da tentativa selecionada. O acesso fica junto aos seletores e a rota é `#/certifications/<id>/pre-test-review`. O conteúdo é local, em inglês e preparado por um agente durante a autoria; o navegador não gera texto nem usa serviços de IA.

## Seleção e leitura

Entram questões `incorrect`, `skipped`, `EDUCATED_GUESS`, `UNSURE`, com `flagged: true` ou pedido de revisão. Acertos com sinais de dúvida entram; acertos posteriores não removem aprendizados anteriores. Por precaução, notas não vazias entram até que o editor classifique explicitamente `reviewRequested: false`. Esse campo só dispensa o sinal das notas, não os demais.

A primeira seção é `## Last-minute priorities`. As seções seguintes consolidam conceitos de todos os simulados, sem uma quantidade máxima que exclua temas. Bullets esclarecem termos, critérios de decisão, mecanismos, exceções e alternativas tentadoras. Referências às questões ficam recolhidas. Data, quantidade de tentativas, cobertura e lacunas aparecem na página. Questões sem explicação suficiente permanecem como pendências identificadas, nunca como cobertura concluída.

## Navegação por tópicos

Em telas acima de 900 px, o índice fica aberto na sidebar, fixa durante a leitura, com rolagem própria para listas longas. Em telas de até 900 px, o mesmo índice fica em um menu recolhível no header, acessível em qualquer ponto do texto. Não há cópias divergentes do menu.

O header também mostra o contador `atual/total` e os botões **Previous** e **Next**, disponíveis em desktop e celular. O contador acompanha a seção ativa ao rolar ou escolher um tópico. O primeiro item é `Last-minute priorities`; anterior fica desabilitado no início e próximo no fim, sem navegação circular. Os botões percorrem o índice completo mesmo com a busca filtrada e mantêm o foco para uso repetido pelo teclado.

A busca **Search topics** filtra os títulos e informa quando não há resultados. Escolher um tópico leva à seção, destaca a posição atual e move o foco para o título; no celular, também recolhe o menu. `Esc` recolhe primeiro o menu móvel e devolve o foco ao seu controle; com o menu fechado, fecha a revisão. A navegação respeita a preferência por movimento reduzido e funciona com os arquivos salvos offline.

## Extensão aditiva do contrato v1

A certificação pode declarar `"preTestReview": {"path": "pre-test-review/review.json"}`. Esse caminho é relativo a `data/<certification-id>/`, deve permanecer nessa pasta e apontar para JSON. O índice público continua vazio. Catálogos sem a propriedade continuam válidos e mostram orientação para preparar a revisão.

O manifesto tem estes campos:

| Campo | Contrato |
| --- | --- |
| `schemaVersion` | `1` |
| `certificationId` | Identidade da certificação proprietária |
| `updatedAt` | Timestamp ISO 8601 |
| `editorialStatus` | `draft` ou `reviewed`; ausência equivale a `draft`. Pendências impedem `reviewed` |
| `contentPath` | Markdown relativo à pasta do manifesto, com contenção nessa pasta |
| `contentSha256` | SHA-256 dos bytes UTF-8 do Markdown |
| `inputs` | Snapshot calculado por `tools/pretest.py` |
| `topics` | Objetos com `id` slug único e `heading` igual a um H2 do Markdown; `references` opcional contém `{title, url}` com HTTPS público sem credenciais |
| `coverage` | Uma entrada por questão elegível, com `examId`, `attemptId`, `questionNumber`, `topicIds`; `pending` descreve pendência e `reportId` opcional identifica relatório da mesma tentativa |
| `gaps` | Lista de limitações editoriais, incluindo notas antigas irrecuperáveis |

O snapshot inclui `catalogFingerprint`, `sources` (caminho relativo a `data/` → SHA-256), `attempts` e `eligibleQuestions` (identidade, número e `reasons`). Inclui manifests e todos os materiais declarados, compartilhados e por tentativa. O fingerprint do catálogo usa SHA-256 do JSON compacto UTF-8 de `[cert.id, cert.exams.map(e => [e.id, e.path, e.attempts.map(a => [a.id, a.path])])]`.

`learnerNotes` é texto opcional da questão; `reviewRequested` é booleano editorial opcional. A ausência de notas não significa ausência de pedido histórico. O conversor preserva anotações textuais reconhecidas do usuário; novos formatos de origem precisam de adaptação explícita. Não se infere nota a partir de justificativas das alternativas.

## Validação e atualização

`tools/pretest.py` calcula cobertura e fingerprints; não redige a síntese. A validação rejeita referências inválidas, cobertura ausente/duplicada, conteúdo alterado sem atualizar seu hash e snapshots desatualizados. Uma pendência explícita é estruturalmente válida, mas a interface a anuncia e a revisão não deve ser descrita como editorialmente completa.

A extensão é opcional para manter compatibilidade. Depois de registrada, uma revisão desatualizada faz a validação do catálogo falhar. O leitor continua permitindo consultar a versão anterior com aviso. A seleção de questões e a revisão semântica do agente são complementares às verificações estruturais.

Referências primárias opcionais aparecem recolhidas junto às questões do tema. São links externos abertos por ação do leitor; o aplicativo não busca seu conteúdo. A revisão salva continua legível offline, mas as páginas externas exigem conexão. Quando a explicação original contradiz a documentação atual, registre a correção e seu contexto temporal sem alterar o resultado histórico da tentativa.

## Compatibilidade HTTP e offline

A leitura online também funciona em HTTP fora de localhost: quando Web Crypto não está disponível, uma implementação local equivalente de SHA-256 preserva a verificação de integridade. O salvamento offline depende de service worker e Cache API, disponíveis em HTTPS ou localhost; em origens sem esses recursos, o botão fica desabilitado com explicação visível.

A abertura conectada busca índice, manifesto, texto e entradas com `cache: no-store`, na mesma origem. Verifica a revisão disponível e a compara com as entradas atuais. Se a verificação das entradas falhar, não anuncia atualização confirmada.

**Save offline** salva manifesto, catálogo da certificação e texto em uma única entrada do cache `sb-pretest-bundles-v1`, sem depender de abrir as tentativas. O SHA-256 impede combinar Markdown e manifesto de versões diferentes. Se uma atualização estiver incompleta, a última cópia salva pode ser aberta com aviso; sem cópia, há erro com orientação para tentar novamente. Offline, a interface não pode descobrir mudanças feitas depois do salvamento. O salvamento confirma o conjunto somente após a escrita e leitura de confirmação.

Veja [como preparar a revisão](../how-to/update-pre-test-review.md) e os [limites do cache](pwa-cache.md).

`editorialStatus` distingue `draft` de `reviewed` (ausência equivale a `draft`). A página anuncia rascunhos mesmo quando os arquivos estão atualizados. `reviewed` exige conferência semântica e não pode coexistir com questões `pending`; lacunas históricas de notas ainda podem ser declaradas. Não remova o aviso apenas porque os hashes e a cobertura passaram.

## Reading-time documents

An optional `readingVersions` array contains exactly three entries in order: `minutes: 10`, `30`, `60`. Each entry declares `contentPath` (distinct Markdown path contained in the manifest directory) and `contentSha256`. The 60-minute entry matches the canonical `contentPath` and hash. Each document starts with `Last-minute priorities` and uses headings from the canonical review. Question coverage and editorial status describe the canonical synthesis; shorter documents are explicitly selected lessons.

The **Reading time** selector shares a row with **Previous**, the topic counter and **Next**, including on mobile. Its accessible label remains available on narrow screens. It chooses 10 minutes, 30 minutes or 1 hour. The direct route adds `?reading=10`, `?reading=30` or `?reading=60` inside the hash, for example `#/certifications/sample-cert/pre-test-review?reading=30`. Without a duration, the full review opens. Existing manifests without `readingVersions` keep the single-document reader.

Durations are approximate budgets for deliberate study. Short documents preserve complete bullets and prioritise explicit requests and recurring difficulty. They do not promise full coverage. **Save offline** saves all three documents in one verified bundle; missing or corrupted documents cannot replace the last coherent saved bundle.
