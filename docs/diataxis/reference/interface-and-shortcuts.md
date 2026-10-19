# Interface, filtros e atalhos

A navegação segue certificação → simulado → tentativa. O catálogo pode estar vazio; nesse caso a aplicação apresenta orientação para adicionar conteúdo local.

## Biblioteca

A seleção de certificação limita os simulados; o simulado limita as tentativas. Simulados sem tentativa mostram o estado vazio e ainda permitem abrir materiais compartilhados. A biblioteca separa materiais compartilhados e próprios da tentativa selecionada.

O seletor e a lista de tentativas mostram a data em `DD/MM/AAAA`, usando primeiro `window.startTime` e depois uma data válida em `date` ou no ID legado. Timestamps são apresentados no fuso do navegador; datas sem horário preservam o dia informado. O app lê os manifests locais das tentativas do simulado para obter esses rótulos. Tentativas na mesma data recebem um sufixo numérico para distingui-las; sem data disponível, o ID permanece como rótulo.

Essa apresentação não renomeia IDs, pastas, URLs nem chaves de progresso. A identidade original descrita no [modelo de tentativa](attempt-data.md) permanece estável.

## Questões e materiais

A lista de questões suporta busca textual e filtro de incorretas. Relatórios abrem no leitor Markdown. Stories abre cartões associados e mantém a posição local. A navegação por questão pode mostrar materiais relacionados conforme as referências declaradas.

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
