# Interface, filtros e atalhos

A navegação segue certificação → simulado → tentativa. O catálogo pode estar vazio; nesse caso a aplicação apresenta orientação para adicionar conteúdo local.

## Biblioteca

A seleção de certificação limita os simulados; o simulado limita as tentativas. Simulados sem tentativa mostram o estado vazio e ainda permitem abrir materiais compartilhados. A biblioteca separa materiais compartilhados e próprios da tentativa selecionada.

## Certification Gallery e arquivamento

**Gallery** na barra superior abre `#/certifications/gallery`. A galeria inclui todas as certificações do catálogo, separadas em **Currently studying** e **Archived**. Os cartões mostram nome, código quando disponível, status e contagens de simulados, tentativas, Reports e Stories. Reports/Stories incluem materiais compartilhados de cada simulado e materiais de todas as tentativas. Se os manifests de materiais não puderem ser lidos, esses dois totais aparecem como indisponíveis.

**Archive certification** permite escolher **Passed** ou **Finished studying** e registra automaticamente a data local. Certificações arquivadas saem dos seletores, mas podem ser abertas pela galeria sem perder o status. **Restore to active** devolve uma certificação aos seletores. Se todas as certificações estiverem arquivadas, a galeria abre como tela inicial; rotas diretas para certificações e Pre-Test Review continuam acessíveis.

Status e data são guardados no `localStorage` deste navegador, sob `sb-certification-status-v1`. O estado não altera o catálogo nem acompanha a pessoa em outro navegador. Consulte [Arquivar certificações](../how-to/archive-certifications.md).

O seletor e a lista de tentativas mostram a data em `DD/MM/AAAA`, usando primeiro `window.startTime` e depois uma data válida em `date` ou no ID legado. Timestamps são apresentados no fuso do navegador; datas sem horário preservam o dia informado. O app lê os manifests locais das tentativas do simulado para obter esses rótulos. Tentativas na mesma data recebem um sufixo numérico para distingui-las; sem data disponível, o ID permanece como rótulo.

Essa apresentação não renomeia IDs, pastas, URLs nem chaves de progresso. A identidade original descrita no [modelo de tentativa](attempt-data.md) permanece estável.

## Questões e materiais

A lista de questões suporta busca textual e filtro de incorretas. Relatórios abrem no leitor Markdown. Stories abre cartões associados e mantém a posição local. A navegação por questão pode mostrar materiais relacionados conforme as referências declaradas.

## Ecrãs de um Story

O deck percorre quatro ecrãs por questão, na ordem do [formato Stories](story-card-format.md): `Topic`, `Why you got it wrong`, `Why the right answer was different` e `Concepts to nail it next time`. O primeiro ecrã mostra, acima do conteúdo, o `Domain`, o `Task` e o `Signal` lidos do próprio cartão. O último ecrã pode terminar com o link **Full review**, que abre o relatório da questão numa página dedicada.

## Relatório em página inteira

O link **Full review** no último ecrã de uma Story abre uma página de leitura dedicada em nova aba. A rota é `#<certificação>/<simulado>/<tentativa>/<id-do-material>`; o material precisa ser do tipo `report`. A página mostra título, metadados, índice de secções e o relatório renderizado, com tema, impressão e progresso de leitura. Links entre relatórios permanecem nessa página; links externos abrem em nova aba.

A rota também é válida para guias conceituais e relatórios gerais da tentativa. Fechar a página volta à tentativa selecionada, e o service worker mantém o shell e os relatórios salvos para uso offline. Enquanto a página está aberta, os atalhos globais da aplicação ficam suspensos; `Esc` fecha.

## Teclado

- `/`: focar a busca.
- `i`: alternar filtro de questões incorretas.
- `r`: abrir Reports.
- `s`: abrir Stories.
- Leitor: `j`/`k` ou setas para navegar; `Esc` fecha.
- Stories: setas, `j`/`k` e espaço avançam; `Esc` fecha.

Atalhos complementam os controles visíveis; leitores de tela e dispositivos touch operam os controles HTML padrão.

## Aparência: três temas

A interface usa uma única direção visual — instrumento: corpo fosco, teclas elevadas, poços e mostradores rebaixados. O tema só troca a paleta das superfícies; nunca troca conteúdo, rotas, estado local nem comportamento.

| Tema | `data-theme` | Leitura |
| --- | --- | --- |
| Graphite | `graphite` | Corpo carvão, mostradores escuros, acento âmbar. Padrão. |
| Workshop | `workshop` | Papel quente, tinta verde-pinheiro, acento vermelhão. |
| Chalk | `chalk` | Giz claro, tinta grafite, acento terracota. |

- O botão de tema na barra superior (e o botão equivalente na página de relatório) percorre a ordem **Graphite → Workshop → Chalk → Graphite**. O rótulo acessível anuncia o tema atual e o próximo: `Theme: graphite. Switch to workshop`.
- A escolha fica em `localStorage` sob a chave `sb-theme`, com os valores `graphite`, `workshop` ou `chalk`.
- Valores antigos migram sozinhos: `dark` passa a `graphite` e `light` passa a `workshop`. Qualquer valor desconhecido ou ausente abre em `graphite`.
- O tema vive no atributo `data-theme` do elemento `<html>`; a cor da barra do navegador acompanha a paleta atual em `<meta name="theme-color">`.
- A preferência é local e por navegador: não é sincronizada e não altera o catálogo em `data/index.json`.

Contraste de texto, tamanho mínimo de rótulo (12 px), alvo de toque (44 px nos controles principais) e anel de foco (3 px com deslocamento de 3 px) são mantidos nos três temas.

## Pre-Test Review

O link junto aos seletores abre a revisão de toda a certificação em `#/certifications/<id>/pre-test-review`. A página tem prioridades, temas, fontes recolhíveis, lacunas e botão **Save offline**, sem depender da tentativa selecionada. Tema, impressão e `Esc` usam o leitor existente. Atualização confirmada, cópia salva, pendências e indisponibilidade têm mensagens distintas. Veja a [referência](pre-test-review.md).

Na revisão, o índice de tópicos permanece na sidebar em desktop e no header recolhível em telas de até 900 px. **Search topics** filtra títulos. A seleção move o foco para a seção e fecha o menu móvel; `Esc` fecha primeiro esse menu, depois a revisão. Veja os [detalhes da navegação](pre-test-review.md#navegação-por-tópicos).

O header do Pre-Test Review exibe `atual/total`, **Previous** e **Next**. O contador acompanha a seção atual; os botões percorrem todos os tópicos e ficam desabilitados nas extremidades.

## Reports em estudos

Em uma trilha, Reports e `r` abrem apenas os documentos `report` do estudo e domínio atuais, com busca no texto e filtros de conclusão explícita. A leitura usa a rota de lição e inclui navegação pelas seções. Na galeria, o controle fica indisponível. Consulte a [referência de Reports](study-reports.md).
