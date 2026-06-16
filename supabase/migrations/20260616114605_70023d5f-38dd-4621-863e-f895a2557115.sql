
create extension if not exists vector;

create table public.base_conhecimento (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text,
  arquivo_url text,
  arquivo_path text not null,
  tipo text not null check (tipo in ('pdf','docx','txt')),
  tamanho_bytes bigint,
  status text not null default 'processando' check (status in ('aguardando','processando','pronto','erro')),
  erro_mensagem text,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.base_conhecimento to authenticated;
grant all on public.base_conhecimento to service_role;

alter table public.base_conhecimento enable row level security;

create policy "super_admin gerencia base_conhecimento"
  on public.base_conhecimento for all
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create trigger trg_base_conhecimento_upd
  before update on public.base_conhecimento
  for each row execute function public.set_atualizado_em();

create table public.base_conhecimento_chunks (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.base_conhecimento(id) on delete cascade,
  conteudo text not null,
  embedding vector(1536) not null,
  posicao int not null,
  tokens int,
  criado_em timestamptz not null default now()
);

grant select on public.base_conhecimento_chunks to authenticated;
grant all on public.base_conhecimento_chunks to service_role;

alter table public.base_conhecimento_chunks enable row level security;

create policy "super_admin le chunks"
  on public.base_conhecimento_chunks for select
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

create index base_conhecimento_chunks_doc_idx on public.base_conhecimento_chunks(documento_id);
create index base_conhecimento_chunks_embedding_idx
  on public.base_conhecimento_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.buscar_conhecimento(
  query_embedding vector(1536),
  match_count int default 5,
  similarity_threshold float default 0.5
)
returns table (
  id uuid,
  documento_id uuid,
  conteudo text,
  posicao int,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.documento_id,
    c.conteudo,
    c.posicao,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.base_conhecimento_chunks c
  join public.base_conhecimento d on d.id = c.documento_id
  where d.status = 'pronto'
    and 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
