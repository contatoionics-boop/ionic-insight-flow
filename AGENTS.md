# Architecture rules

- Reuse `ListaOrdenavel` and dnd-kit for manual block sorting, with a dedicated touch/keyboard drag handle, so editing and page scrolling remain independent of dragging.
- Library ordering updates only the existing `ordem` field through the authenticated user's Supabase client, preserving content, conditional placement and existing RLS permissions.