# Estado — Certification Gallery

Revisão: 2 · Etapa: `/mvp` concluída · Histórico: [registro](../revision-history.md#certification-gallery).

- Requisitos e decisões: [Certification Gallery](certification-gallery.md), revisão 1.
- Plano: [implementação](../planning/certification-gallery.md), revisão 1.
- TASK-001 concluída: estado local, arquivamento/restauração, galeria e documentação implementados.
- Validação: `make check-public` passou (34 testes Python, 24 Node, catálogo público vazio); `git diff --check` passou.
- Browser com manifests sintéticos: cartões e contagens, status, seletor, abertura sem desarquivar, restauração, estado com todos arquivados, rota direta e layouts 1280/390/320 px sem overflow.
- Servidores locais de revisão encerrados; índice versionado segue vazio. Nenhum deploy, publicação ou commit.
- Próxima etapa: revisão de release; publicação continua fora do escopo.
