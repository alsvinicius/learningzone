# Conteúdo, privacidade e licenças

O repositório distribui software e documentação de uso, não um banco de provas. O catálogo inicial tem zero certificações. Cada instalação pode acrescentar materiais próprios sem que façam parte do código público.

## Por que conteúdo fica fora do controle de versão

`data/index.json` é o ponto de entrada versionado e começa vazio. O `.gitignore` exclui o restante de `data/`, de modo que respostas, notas, resultados e materiais permaneçam locais por padrão. Antes de enviar mudanças, confira o diff e o estado do Git; ignore reduz o risco, mas não substitui revisão.

Esse limite reduz a chance de exportações brutas, segredos ou materiais de terceiros entrarem em pull requests. Não copie conteúdo de usuário para documentação, logs, testes ou screenshots.

## Itens pessoais e documentação pública

Documentação, skills, exemplos, fixtures e demais arquivos versionados descrevem capacidades genéricas do produto. Não devem revelar o que uma pessoa está estudando, suas metas, certificações, tentativas, respostas, notas, progresso, planos individuais, nomes, identificadores, URLs privadas ou caminhos da máquina. Esses dados permanecem em arquivos locais ignorados; a regra vale também para nomes de arquivos, metadados, títulos de screenshots e mensagens de diagnóstico.

Quando um exemplo ajudar a explicar um contrato, crie dados sintéticos originais e identifique-os como sintéticos. Um arquivo local não se torna apropriado para distribuição só por estar em `docs/`, por ter sido redigido ou por estar excluído pelo `.gitignore`; confirme o estado do Git antes de concluir.

## Licença de software não licencia materiais

O código usa MIT. Essa licença cobre software e documentação distribuídos com o arquivo LICENSE; ela não concede direitos sobre conteúdo adicionado por usuários, marcas, questões de exame, cursos, imagens ou documentos externos. Quem cria, copia ou distribui conteúdo deve ter autorização e respeitar termos aplicáveis.

Os ícones distribuídos pelo projeto são desenhos geométricos originais; `icons/icon.svg` é sua fonte vetorial. Não há ativos de terceiros incorporados nesses ícones.

Prefira escrever Stories e relatórios originais e mantenha referências à fonte e permissão em notas locais quando necessário. A aplicação não verifica direitos autorais nem assegura que um formato de exportação possa ser redistribuído.

## Conteúdo público opcional

Uma distribuição derivada que queira incluir catálogo precisa revisar cada arquivo e licença, documentar proveniência, obter autorização e atualizar esta política. Fixtures de teste devem ser sintéticas e originais.
