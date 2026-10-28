# Reports em trilhas de estudo

Um Report é uma lição `type: "report"` em `study.json`, independente de questões e tentativas. Os campos e a contenção de caminhos seguem o [contrato v1](content-contract.md#reports-de-estudo). O domínio principal do módulo e associações adicionais da lição determinam sua presença nos filtros.

## Índice e busca

Na trilha, **Reports** ou `r` abre o índice do contexto atual. Todos os domínios inclui cada lição uma vez; um domínio inclui as associações explícitas. A galeria mantém o botão indisponível até selecionar contexto. Uma tentativa anteriormente aberta, inclusive arquivada, não fornece Reports para uma trilha. Em certificações, o índice mantém os materiais da tentativa.

O contador apresenta o total do conjunto atual. O índice oferece busca por título, módulo e corpo dos Reports locais carregados, e filtros **Pendentes**, **Todos** e **Concluídos**. O carregamento do texto amplia a busca sem bloquear a abertura; respostas tardias de outro contexto não substituem o índice. Sem correspondência ou sem Reports, há um estado vazio explícito.

## Leitura e progresso

A seleção abre a rota normal de estudo/domínio/módulo/lição. Reabrir o Report atual fecha o índice. **Conteúdo deste Report** oferece botões para cada H2; selecionar uma seção desloca a leitura e o foco para seu título, sem substituir a rota. `Esc` fecha o índice e devolve foco ao botão Reports. Tabelas podem rolar horizontalmente dentro da leitura em telas pequenas.

Abrir e rolar não marca conclusão. A ação explícita da lição grava em `sb-study-progress-v1`; não altera leitura ou resultados de tentativas. Rotas diretas, recarga e histórico preservam o contexto de domínio. Identidade composta módulo/lição não duplica progresso de conteúdo transversal. Código em linha pode quebrar em telas estreitas; blocos de código preservam sua formatação e oferecem rolagem horizontal.

## Offline

O salvamento da trilha inclui todos os Reports declarados, junto ao índice, manifesto e demais lições. Os textos não dependem de serviços externos para renderizar; links de referência externos requerem rede ao abrir. Em HTTP fora de localhost, ou sem APIs de armazenamento suportadas, leitura online permanece disponível e o controle informa **Offline unavailable**, sem afirmar salvamento. Cache não substitui backup dos arquivos.

## Critério editorial

Reports de aprofundamento explicam mecanismos, garantias e pressupostos; comparam alternativas; discutem falhas, operação, transição e reversibilidade; incluem caso resolvido e perguntas com respostas argumentadas. Distinguem fonte primária, síntese editorial e exemplo sintético. Números derivados têm unidades, premissas e conferência aritmética; não se apresentam exemplos como benchmarks.

A matriz privada relaciona temas, materiais e seções, preserva hashes das entradas e registra lacunas e fontes. Cobertura significa os temas declarados da formação; não esgota toda a literatura, comprova retenção ou garante um resultado de entrevista. Verificação estrutural e links acessíveis não substituem revisão semântica.
