# Comandos e requisitos

Todos os comandos são executados na raiz do projeto. O Makefile usa Python e Node no `PATH`; não instala dependências.

| Comando | Efeito |
|---|---|
| `make check` | Executa testes Python, Node e validador do catálogo/PWA. |
| `make test` | Executa testes Python e Node. |
| `make check-public` | Valida a aplicação e exige catálogo vazio e conteúdo em `data/` ignorado pelo Git. |
| `make serve` | Executa `make check` e serve o catálogo público em loopback na porta da Gallery, quando configurada, ou 8000. |
| `make serve PORT=8080` | Usa uma porta local alternativa. |
| `make serve-private` | Serve `.local/private-data/index.personal.json` pela rota `data/index.json`, sem alterar o índice público; falha se o índice privado não existir. |
| `make start` | Inicia o servidor gerenciado na porta `WEB_PORT` atribuída pela Gallery; usa o catálogo privado padrão quando existir, senão o público. |
| `make start PRIVATE_INDEX_PATH=` | Inicia o servidor gerenciado com o catálogo público, mesmo havendo um índice privado. |
| `make stop` | Para o servidor gerenciado; pode ser repetido com segurança. |
| `make clean` | Remove diretórios `__pycache__` do projeto. |
| `python3 tools/check.py` | Valida índice, dados declarados e recursos essenciais do PWA. |
| `python3 tools/normalize.py FILE CERT EXAM ATTEMPT` | Converte exportação local compatível para o formato comum. |

Python 3.10+ é necessário para ferramentas e testes; Node.js 18+ é usado pelos testes JS. A interface não tem build nem dependências de runtime. O servidor local escuta `127.0.0.1`; hospedagem deve fornecer HTTPS para habilitar service worker.

## Porta e catálogo na Project Gallery

Quando `.project-gallery.mk` existe, `WEB_PORT` deve ser definido nesse arquivo, com atribuição comum ou `override`, e não pode estar vazio. A atribuição `override export` gerada pela Gallery é aceita e preservada; não é necessário omitir a configuração para executar os comandos. Sem o arquivo gerado, o padrão local é 8000. `PORT` permite escolher outra porta para `make serve`, mas `make start` e `make stop` usam sempre `WEB_PORT`.

No início gerenciado, `PRIVATE_INDEX_PATH` explícito tem precedência. Sem essa opção, a presença de `.local/private-data/index.personal.json` seleciona o catálogo privado; sua ausência mantém a distribuição vazia. A escolha ocorre quando o processo é iniciado. Para trocar o catálogo de um servidor já ativo, execute `make stop` antes de `make start`. O índice público no disco permanece inalterado.

## Verificar revisões privadas

- `python3 tools/pretest.py --index .local/private-data/index.personal.json`: verifica integridade, cobertura e atualização das revisões declaradas, com saída agregada sem conteúdo pessoal. Use `--data-dir` quando a raiz dos materiais não for `data/`.
- `python3 tools/pretest.py --index .local/private-data/index.personal.json --snapshot-out .local/pretest-inputs.json`: grava entradas para a autoria em arquivo privado; não gera a síntese nem substitui a conferência editorial.

O catálogo público vazio não exercita conteúdo privado em `make check`. Valide o índice escolhido explicitamente como parte da entrega de conteúdo.

`python3 tools/check.py --index .local/private-data/index.personal.json --quiet` valida o catálogo privado completo, resultados normalizados e PWA sem imprimir IDs, resultados individuais ou detalhes de conteúdo em erros.
