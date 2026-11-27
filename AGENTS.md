# Architecture rules

- Reuse `ListaOrdenavel` and dnd-kit for manual block sorting, with a dedicated touch/keyboard drag handle, so editing and page scrolling remain independent of dragging.
- Additional-block ordering updates only `ordem`; shared document-section order is stored in a dedicated inactive configuration row in `blocos_padrao`, excluded from library content queries, using the authenticated client and existing RLS permissions.
- Apply shared section ordering after document merging so reviewed text is preserved; move complete section subtrees and recalculate heading/figure numbers without changing applicability rules.