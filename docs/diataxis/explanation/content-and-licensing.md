# Conteúdo, privacidade e licenças

O repositório distribui software e documentação de uso, não um banco de provas. O catálogo inicial tem zero certificações. Cada instalação pode acrescentar materiais próprios sem que façam parte do código público.

## Por que conteúdo fica fora do controle de versão

`data/index.json` é o ponto de entrada versionado e começa vazio. O `.gitignore` exclui o restante de `data/`, de modo que respostas, notas, resultados e materiais permaneçam locais por padrão. Antes de enviar mudanças, confira o diff e o estado do Git; ignore reduz o risco, mas não substitui revisão.

Esse limite reduz a chance de exportações brutas, segredos ou materiais de terceiros entrarem em pull requests. Não copie conteúdo de usuário para documentação, logs, testes ou screenshots.

## Licença de software não licencia materiais

O código usa MIT. Essa licença cobre software e documentação distribuídos com o arquivo LICENSE; ela não concede direitos sobre conteúdo adicionado por usuários, marcas, questões de exame, cursos, imagens ou documentos externos. Quem cria, copia ou distribui conteúdo deve ter autorização e respeitar termos aplicáveis.

Prefira escrever Stories e relatórios originais e mantenha referências à fonte e permissão em notas locais quando necessário. A aplicação não verifica direitos autorais nem assegura que um formato de exportação possa ser redistribuído.

## Conteúdo público opcional

Uma distribuição derivada que queira incluir catálogo precisa revisar cada arquivo e licença, documentar proveniência, obter autorização e atualizar esta política. Fixtures de teste devem ser sintéticas e originais.
