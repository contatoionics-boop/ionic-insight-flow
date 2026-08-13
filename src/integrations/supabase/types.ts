export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          aceite_agente: boolean | null
          aceite_status: string
          agendado_em: string
          agente_id: string | null
          agente_nome_manual: string | null
          atualizado_em: string
          criado_em: string
          criado_por: string
          data_aceite: string | null
          duracao_min: number
          endereco_vistoria: string | null
          id: string
          matriz_id: string | null
          modalidade: Database["public"]["Enums"]["modalidade_atendimento"]
          motivo_recusa: string | null
          nivel: Database["public"]["Enums"]["nivel_mapeamento"]
          observacoes_agendamento: string | null
          tipo_solicitacao: Database["public"]["Enums"]["tipo_solicitacao"]
          unidade_id: string
        }
        Insert: {
          aceite_agente?: boolean | null
          aceite_status?: string
          agendado_em: string
          agente_id?: string | null
          agente_nome_manual?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por: string
          data_aceite?: string | null
          duracao_min?: number
          endereco_vistoria?: string | null
          id?: string
          matriz_id?: string | null
          modalidade?: Database["public"]["Enums"]["modalidade_atendimento"]
          motivo_recusa?: string | null
          nivel?: Database["public"]["Enums"]["nivel_mapeamento"]
          observacoes_agendamento?: string | null
          tipo_solicitacao?: Database["public"]["Enums"]["tipo_solicitacao"]
          unidade_id: string
        }
        Update: {
          aceite_agente?: boolean | null
          aceite_status?: string
          agendado_em?: string
          agente_id?: string | null
          agente_nome_manual?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por?: string
          data_aceite?: string | null
          duracao_min?: number
          endereco_vistoria?: string | null
          id?: string
          matriz_id?: string | null
          modalidade?: Database["public"]["Enums"]["modalidade_atendimento"]
          motivo_recusa?: string | null
          nivel?: Database["public"]["Enums"]["nivel_mapeamento"]
          observacoes_agendamento?: string | null
          tipo_solicitacao?: Database["public"]["Enums"]["tipo_solicitacao"]
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_matriz_id_fkey"
            columns: ["matriz_id"]
            isOneToOne: false
            referencedRelation: "matrizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      base_conhecimento: {
        Row: {
          arquivo_path: string
          arquivo_url: string | null
          atualizado_em: string
          categoria: string | null
          criado_em: string
          criado_por: string | null
          erro_mensagem: string | null
          id: string
          nome: string
          status: string
          tamanho_bytes: number | null
          tipo: string
        }
        Insert: {
          arquivo_path: string
          arquivo_url?: string | null
          atualizado_em?: string
          categoria?: string | null
          criado_em?: string
          criado_por?: string | null
          erro_mensagem?: string | null
          id?: string
          nome: string
          status?: string
          tamanho_bytes?: number | null
          tipo: string
        }
        Update: {
          arquivo_path?: string
          arquivo_url?: string | null
          atualizado_em?: string
          categoria?: string | null
          criado_em?: string
          criado_por?: string | null
          erro_mensagem?: string | null
          id?: string
          nome?: string
          status?: string
          tamanho_bytes?: number | null
          tipo?: string
        }
        Relationships: []
      }
      base_conhecimento_chunks: {
        Row: {
          conteudo: string
          criado_em: string
          documento_id: string
          embedding: string
          id: string
          posicao: number
          tokens: number | null
        }
        Insert: {
          conteudo: string
          criado_em?: string
          documento_id: string
          embedding: string
          id?: string
          posicao: number
          tokens?: number | null
        }
        Update: {
          conteudo?: string
          criado_em?: string
          documento_id?: string
          embedding?: string
          id?: string
          posicao?: number
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "base_conhecimento_chunks_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "base_conhecimento"
            referencedColumns: ["id"]
          },
        ]
      }
      casos: {
        Row: {
          agendado_em: string | null
          agendamento_id: string
          agente_id: string | null
          agente_nome_manual: string | null
          atualizado_em: string
          codigo: string
          criado_em: string
          criado_por: string | null
          data_aprovacao_pablo: string | null
          data_entrega_agente: string | null
          data_execucao: string | null
          divergencias_proposta: Json
          duracao_min: number
          endereco_vistoria: string | null
          formulario_id: string | null
          id: string
          laudo_alertas: Json
          laudo_conteudo: Json | null
          laudo_variaveis: Json
          modalidade: Database["public"]["Enums"]["modalidade_atendimento"]
          motivo_recusa: string | null
          nivel: Database["public"]["Enums"]["nivel_mapeamento"]
          observacoes_agendamento: string | null
          status: Database["public"]["Enums"]["caso_status"]
          tipo_solicitacao: Database["public"]["Enums"]["tipo_solicitacao"]
          unidade_id: string
        }
        Insert: {
          agendado_em?: string | null
          agendamento_id: string
          agente_id?: string | null
          agente_nome_manual?: string | null
          atualizado_em?: string
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          data_aprovacao_pablo?: string | null
          data_entrega_agente?: string | null
          data_execucao?: string | null
          divergencias_proposta?: Json
          duracao_min?: number
          endereco_vistoria?: string | null
          formulario_id?: string | null
          id?: string
          laudo_alertas?: Json
          laudo_conteudo?: Json | null
          laudo_variaveis?: Json
          modalidade?: Database["public"]["Enums"]["modalidade_atendimento"]
          motivo_recusa?: string | null
          nivel?: Database["public"]["Enums"]["nivel_mapeamento"]
          observacoes_agendamento?: string | null
          status?: Database["public"]["Enums"]["caso_status"]
          tipo_solicitacao?: Database["public"]["Enums"]["tipo_solicitacao"]
          unidade_id: string
        }
        Update: {
          agendado_em?: string | null
          agendamento_id?: string
          agente_id?: string | null
          agente_nome_manual?: string | null
          atualizado_em?: string
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          data_aprovacao_pablo?: string | null
          data_entrega_agente?: string | null
          data_execucao?: string | null
          divergencias_proposta?: Json
          duracao_min?: number
          endereco_vistoria?: string | null
          formulario_id?: string | null
          id?: string
          laudo_alertas?: Json
          laudo_conteudo?: Json | null
          laudo_variaveis?: Json
          modalidade?: Database["public"]["Enums"]["modalidade_atendimento"]
          motivo_recusa?: string | null
          nivel?: Database["public"]["Enums"]["nivel_mapeamento"]
          observacoes_agendamento?: string | null
          status?: Database["public"]["Enums"]["caso_status"]
          tipo_solicitacao?: Database["public"]["Enums"]["tipo_solicitacao"]
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "casos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_materiais: {
        Row: {
          aplicacao: string | null
          ativo: boolean
          atualizado_em: string
          codigo: string
          criado_em: string
          criado_por: string | null
          descricao: string
          id: string
          ordem: number
          quantidade_padrao: number
          regra: Json
          unidade: string
        }
        Insert: {
          aplicacao?: string | null
          ativo?: boolean
          atualizado_em?: string
          codigo: string
          criado_em?: string
          criado_por?: string | null
          descricao: string
          id?: string
          ordem?: number
          quantidade_padrao?: number
          regra?: Json
          unidade?: string
        }
        Update: {
          aplicacao?: string | null
          ativo?: boolean
          atualizado_em?: string
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          ordem?: number
          quantidade_padrao?: number
          regra?: Json
          unidade?: string
        }
        Relationships: []
      }
      chat_mensagens: {
        Row: {
          caso_id: string
          client_message_id: string | null
          criado_em: string
          id: string
          parts: Json
          role: string
        }
        Insert: {
          caso_id: string
          client_message_id?: string | null
          criado_em?: string
          id?: string
          parts: Json
          role: string
        }
        Update: {
          caso_id?: string
          client_message_id?: string | null
          criado_em?: string
          id?: string
          parts?: Json
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mensagens_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_empresa: {
        Row: {
          atualizado_em: string
          cidade_estado: string | null
          cnpj: string | null
          email_contato: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome_empresa: string | null
          singleton: boolean
          site: string | null
          telefone: string | null
          texto_rodape: string | null
        }
        Insert: {
          atualizado_em?: string
          cidade_estado?: string | null
          cnpj?: string | null
          email_contato?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome_empresa?: string | null
          singleton?: boolean
          site?: string | null
          telefone?: string | null
          texto_rodape?: string | null
        }
        Update: {
          atualizado_em?: string
          cidade_estado?: string | null
          cnpj?: string | null
          email_contato?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome_empresa?: string | null
          singleton?: boolean
          site?: string | null
          telefone?: string | null
          texto_rodape?: string | null
        }
        Relationships: []
      }
      configuracoes_saida: {
        Row: {
          ativo: boolean
          atualizado_em: string
          chave: string
          config: Json
          destinatarios: string[]
          id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          chave: string
          config?: Json
          destinatarios?: string[]
          id?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          chave?: string
          config?: Json
          destinatarios?: string[]
          id?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          codigo_ionics: string | null
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
        }
        Insert: {
          codigo_ionics?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
        }
        Update: {
          codigo_ionics?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      formularios: {
        Row: {
          aprovado_por: string | null
          ativo: boolean
          codigo: string | null
          criado_em: string
          criado_por: string | null
          data_revisao: string | null
          descricao: string | null
          elaborado_por: string | null
          empresa_id: string | null
          id: string
          nome: string
          revisao: string | null
          validar_imagens_ia: boolean
        }
        Insert: {
          aprovado_por?: string | null
          ativo?: boolean
          codigo?: string | null
          criado_em?: string
          criado_por?: string | null
          data_revisao?: string | null
          descricao?: string | null
          elaborado_por?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          revisao?: string | null
          validar_imagens_ia?: boolean
        }
        Update: {
          aprovado_por?: string | null
          ativo?: boolean
          codigo?: string | null
          criado_em?: string
          criado_por?: string | null
          data_revisao?: string | null
          descricao?: string | null
          elaborado_por?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          revisao?: string | null
          validar_imagens_ia?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "formularios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formularios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          categoria: Database["public"]["Enums"]["knowledge_categoria"]
          classificacao: Database["public"]["Enums"]["knowledge_classificacao"]
          conteudo: string
          created_at: string
          criado_por: string | null
          embedding: string | null
          fonte: string | null
          id: string
          importacao_id: string | null
          tags: string[]
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria: Database["public"]["Enums"]["knowledge_categoria"]
          classificacao?: Database["public"]["Enums"]["knowledge_classificacao"]
          conteudo: string
          created_at?: string
          criado_por?: string | null
          embedding?: string | null
          fonte?: string | null
          id?: string
          importacao_id?: string | null
          tags?: string[]
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["knowledge_categoria"]
          classificacao?: Database["public"]["Enums"]["knowledge_classificacao"]
          conteudo?: string
          created_at?: string
          criado_por?: string | null
          embedding?: string | null
          fonte?: string | null
          id?: string
          importacao_id?: string | null
          tags?: string[]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_importacoes: {
        Row: {
          created_at: string
          criado_por: string | null
          erro_mensagem: string | null
          id: string
          nome_arquivo: string
          status: string
          tipo: string
          total_inseridos: number
          total_registros: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          erro_mensagem?: string | null
          id?: string
          nome_arquivo: string
          status?: string
          tipo: string
          total_inseridos?: number
          total_registros?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          erro_mensagem?: string | null
          id?: string
          nome_arquivo?: string
          status?: string
          tipo?: string
          total_inseridos?: number
          total_registros?: number
          updated_at?: string
        }
        Relationships: []
      }
      links_agente: {
        Row: {
          caso_id: string
          criado_em: string
          expira_em: string | null
          id: string
          token: string
          utilizado_em: string | null
        }
        Insert: {
          caso_id: string
          criado_em?: string
          expira_em?: string | null
          id?: string
          token: string
          utilizado_em?: string | null
        }
        Update: {
          caso_id?: string
          criado_em?: string
          expira_em?: string | null
          id?: string
          token?: string
          utilizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "links_agente_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      mapeamento_eventos: {
        Row: {
          agendamento_id: string | null
          ator_id: string | null
          ator_nome: string | null
          ator_papel: Database["public"]["Enums"]["ator_papel"]
          caso_id: string
          criado_em: string
          id: string
          metadata: Json
          ocorrido_em: string
          tipo: Database["public"]["Enums"]["mapeamento_evento_tipo"]
        }
        Insert: {
          agendamento_id?: string | null
          ator_id?: string | null
          ator_nome?: string | null
          ator_papel?: Database["public"]["Enums"]["ator_papel"]
          caso_id: string
          criado_em?: string
          id?: string
          metadata?: Json
          ocorrido_em?: string
          tipo: Database["public"]["Enums"]["mapeamento_evento_tipo"]
        }
        Update: {
          agendamento_id?: string | null
          ator_id?: string | null
          ator_nome?: string | null
          ator_papel?: Database["public"]["Enums"]["ator_papel"]
          caso_id?: string
          criado_em?: string
          id?: string
          metadata?: Json
          ocorrido_em?: string
          tipo?: Database["public"]["Enums"]["mapeamento_evento_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "mapeamento_eventos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapeamento_eventos_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      mapeamento_observacoes: {
        Row: {
          caso_id: string
          criado_em: string
          id: string
          texto: string
          usuario_id: string
        }
        Insert: {
          caso_id: string
          criado_em?: string
          id?: string
          texto: string
          usuario_id: string
        }
        Update: {
          caso_id?: string
          criado_em?: string
          id?: string
          texto?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapeamento_observacoes_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      matrizes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          criado_em: string
          criado_por: string | null
          email: string | null
          empresa_id: string
          estado: string | null
          id: string
          logradouro: string | null
          nome: string
          numero: string | null
          razao_social: string | null
          telefone: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          empresa_id: string
          estado?: string | null
          id?: string
          logradouro?: string | null
          nome: string
          numero?: string | null
          razao_social?: string | null
          telefone?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          empresa_id?: string
          estado?: string | null
          id?: string
          logradouro?: string | null
          nome?: string
          numero?: string | null
          razao_social?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matrizes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          caso_id: string | null
          criado_em: string
          id: string
          lido: boolean
          mensagem: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          caso_id?: string | null
          criado_em?: string
          id?: string
          lido?: boolean
          mensagem: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          caso_id?: string | null
          criado_em?: string
          id?: string
          lido?: boolean
          mensagem?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      opcoes_pergunta: {
        Row: {
          id: string
          ordem: number | null
          pergunta_id: string
          texto: string
        }
        Insert: {
          id?: string
          ordem?: number | null
          pergunta_id: string
          texto: string
        }
        Update: {
          id?: string
          ordem?: number | null
          pergunta_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "opcoes_pergunta_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "perguntas"
            referencedColumns: ["id"]
          },
        ]
      }
      pergunta_blocos: {
        Row: {
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          layout: Database["public"]["Enums"]["bloco_layout"]
          ordem: number
          secao_id: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          layout?: Database["public"]["Enums"]["bloco_layout"]
          ordem?: number
          secao_id: string
          titulo: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          layout?: Database["public"]["Enums"]["bloco_layout"]
          ordem?: number
          secao_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pergunta_blocos_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "secoes"
            referencedColumns: ["id"]
          },
        ]
      }
      perguntas: {
        Row: {
          bloco_coluna: string | null
          bloco_id: string | null
          bloco_linha: string | null
          chave_laudo: string | null
          condicional_operador: string | null
          condicional_pergunta_id: string | null
          condicional_valor: string | null
          contexto_ia: string | null
          criado_em: string
          id: string
          instrucao_agente: string | null
          obrigatoria: boolean
          ordem: number
          secao_id: string
          texto: string
          tipo: Database["public"]["Enums"]["pergunta_tipo"]
        }
        Insert: {
          bloco_coluna?: string | null
          bloco_id?: string | null
          bloco_linha?: string | null
          chave_laudo?: string | null
          condicional_operador?: string | null
          condicional_pergunta_id?: string | null
          condicional_valor?: string | null
          contexto_ia?: string | null
          criado_em?: string
          id?: string
          instrucao_agente?: string | null
          obrigatoria?: boolean
          ordem: number
          secao_id: string
          texto: string
          tipo: Database["public"]["Enums"]["pergunta_tipo"]
        }
        Update: {
          bloco_coluna?: string | null
          bloco_id?: string | null
          bloco_linha?: string | null
          chave_laudo?: string | null
          condicional_operador?: string | null
          condicional_pergunta_id?: string | null
          condicional_valor?: string | null
          contexto_ia?: string | null
          criado_em?: string
          id?: string
          instrucao_agente?: string | null
          obrigatoria?: boolean
          ordem?: number
          secao_id?: string
          texto?: string
          tipo?: Database["public"]["Enums"]["pergunta_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "perguntas_bloco_id_fkey"
            columns: ["bloco_id"]
            isOneToOne: false
            referencedRelation: "pergunta_blocos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perguntas_condicional_pergunta_id_fkey"
            columns: ["condicional_pergunta_id"]
            isOneToOne: false
            referencedRelation: "perguntas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perguntas_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "secoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          criado_em: string
          email: string
          id: string
          nome: string
          permissoes_extras: string[]
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          email: string
          id: string
          nome?: string
          permissoes_extras?: string[]
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          email?: string
          id?: string
          nome?: string
          permissoes_extras?: string[]
        }
        Relationships: []
      }
      prompts_ia: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          conteudo: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          conteudo: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          conteudo?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      propostas_comerciais: {
        Row: {
          arquivo_nome: string
          arquivo_path: string
          atualizado_em: string
          caso_id: string
          criado_em: string
          criado_por: string | null
          erro_mensagem: string | null
          escopo: Json
          id: string
          status: string
          tamanho_bytes: number | null
          texto_extraido: string | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_path: string
          atualizado_em?: string
          caso_id: string
          criado_em?: string
          criado_por?: string | null
          erro_mensagem?: string | null
          escopo?: Json
          id?: string
          status?: string
          tamanho_bytes?: number | null
          texto_extraido?: string | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string
          atualizado_em?: string
          caso_id?: string
          criado_em?: string
          criado_por?: string | null
          erro_mensagem?: string | null
          escopo?: Json
          id?: string
          status?: string
          tamanho_bytes?: number | null
          texto_extraido?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "propostas_comerciais_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas_agente: {
        Row: {
          arquivo_path: string | null
          arquivos_paths: string[]
          caso_id: string
          criado_em: string
          ia_aprovado: boolean | null
          ia_motivo: string | null
          id: string
          pergunta_id: string
          tipo: Database["public"]["Enums"]["pergunta_tipo"]
          transcricao: string | null
          valor_texto: string | null
        }
        Insert: {
          arquivo_path?: string | null
          arquivos_paths?: string[]
          caso_id: string
          criado_em?: string
          ia_aprovado?: boolean | null
          ia_motivo?: string | null
          id?: string
          pergunta_id: string
          tipo: Database["public"]["Enums"]["pergunta_tipo"]
          transcricao?: string | null
          valor_texto?: string | null
        }
        Update: {
          arquivo_path?: string | null
          arquivos_paths?: string[]
          caso_id?: string
          criado_em?: string
          ia_aprovado?: boolean | null
          ia_motivo?: string | null
          id?: string
          pergunta_id?: string
          tipo?: Database["public"]["Enums"]["pergunta_tipo"]
          transcricao?: string | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respostas_agente_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_agente_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "perguntas"
            referencedColumns: ["id"]
          },
        ]
      }
      secoes: {
        Row: {
          criado_em: string
          descricao: string | null
          formulario_id: string
          id: string
          ordem: number
          titulo: string
        }
        Insert: {
          criado_em?: string
          descricao?: string | null
          formulario_id: string
          id?: string
          ordem: number
          titulo: string
        }
        Update: {
          criado_em?: string
          descricao?: string | null
          formulario_id?: string
          id?: string
          ordem?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "secoes_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          codigo_ionics: string | null
          criado_em: string
          criado_por: string | null
          email: string | null
          estado: string | null
          id: string
          logradouro: string | null
          matriz_id: string
          nome: string
          numero: string | null
          telefone: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_ionics?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          matriz_id: string
          nome: string
          numero?: string | null
          telefone?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_ionics?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          matriz_id?: string
          nome?: string
          numero?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unidades_matriz_id_fkey"
            columns: ["matriz_id"]
            isOneToOne: false
            referencedRelation: "matrizes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          criado_em: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_pode_editar_empresa: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      admin_pode_ver_empresa: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      admin_pode_ver_formulario: {
        Args: { _formulario_id: string; _user_id: string }
        Returns: boolean
      }
      agente_tem_caso_em_empresa: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      agente_tem_caso_em_matriz: {
        Args: { _matriz_id: string; _user_id: string }
        Returns: boolean
      }
      agente_tem_caso_em_unidade: {
        Args: { _unidade_id: string; _user_id: string }
        Returns: boolean
      }
      buscar_conhecimento: {
        Args: {
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          conteudo: string
          documento_id: string
          id: string
          posicao: number
          similarity: number
        }[]
      }
      buscar_knowledge_base: {
        Args: {
          match_count?: number
          p_categoria?: Database["public"]["Enums"]["knowledge_categoria"]
          p_classificacao?: Database["public"]["Enums"]["knowledge_classificacao"]
          p_tags?: string[]
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          categoria: Database["public"]["Enums"]["knowledge_categoria"]
          classificacao: Database["public"]["Enums"]["knowledge_classificacao"]
          conteudo: string
          fonte: string
          id: string
          similarity: number
          tags: string[]
          titulo: string
        }[]
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      empresa_da_matriz: { Args: { _matriz_id: string }; Returns: string }
      gen_caso_codigo: { Args: never; Returns: string }
      has_permissao_extra: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      matriz_da_unidade: { Args: { _unidade_id: string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "especialista" | "agente_tecnico"
      ator_papel:
        | "super_admin"
        | "admin"
        | "especialista"
        | "agente_tecnico"
        | "sistema"
      bloco_layout: "cartao" | "matriz" | "fotos"
      caso_status:
        | "rascunho"
        | "enviado"
        | "em_analise"
        | "aguardando_revisao"
        | "aprovado"
        | "agendado"
        | "em_andamento"
        | "concluido"
        | "cancelado"
      knowledge_categoria:
        | "estrutura_documento"
        | "catalogo_produtos"
        | "catalogo_materiais"
        | "regras_tecnicas"
        | "exemplos_laudos"
        | "textos_padrao"
        | "glossario_tecnico"
      knowledge_classificacao: "OK" | "ATENCAO" | "BLOQUEIO"
      mapeamento_evento_tipo:
        | "mapeamento_criado"
        | "agendamento_criado"
        | "agente_atribuido"
        | "aceite_confirmado"
        | "aceite_recusado"
        | "reagendado"
        | "agendamento_cancelado"
        | "vistoria_iniciada"
        | "vistoria_finalizada"
        | "revisao_aprovada"
        | "revisao_reprovada"
        | "mapeamento_concluido"
        | "observacao_adicionada"
        | "proposta_anexada"
        | "proposta_extraida"
        | "divergencias_calculadas"
      modalidade_atendimento: "presencial" | "remoto"
      nivel_mapeamento: "nivel_1" | "nivel_2" | "nivel_3"
      pergunta_tipo:
        | "texto"
        | "foto"
        | "audio"
        | "checkbox"
        | "numero"
        | "data"
        | "selecao_unica"
        | "toggle"
        | "cep"
        | "cnpj"
        | "video"
      tipo_solicitacao: "instalacao" | "upgrade"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "especialista", "agente_tecnico"],
      ator_papel: [
        "super_admin",
        "admin",
        "especialista",
        "agente_tecnico",
        "sistema",
      ],
      bloco_layout: ["cartao", "matriz", "fotos"],
      caso_status: [
        "rascunho",
        "enviado",
        "em_analise",
        "aguardando_revisao",
        "aprovado",
        "agendado",
        "em_andamento",
        "concluido",
        "cancelado",
      ],
      knowledge_categoria: [
        "estrutura_documento",
        "catalogo_produtos",
        "catalogo_materiais",
        "regras_tecnicas",
        "exemplos_laudos",
        "textos_padrao",
        "glossario_tecnico",
      ],
      knowledge_classificacao: ["OK", "ATENCAO", "BLOQUEIO"],
      mapeamento_evento_tipo: [
        "mapeamento_criado",
        "agendamento_criado",
        "agente_atribuido",
        "aceite_confirmado",
        "aceite_recusado",
        "reagendado",
        "agendamento_cancelado",
        "vistoria_iniciada",
        "vistoria_finalizada",
        "revisao_aprovada",
        "revisao_reprovada",
        "mapeamento_concluido",
        "observacao_adicionada",
        "proposta_anexada",
        "proposta_extraida",
        "divergencias_calculadas",
      ],
      modalidade_atendimento: ["presencial", "remoto"],
      nivel_mapeamento: ["nivel_1", "nivel_2", "nivel_3"],
      pergunta_tipo: [
        "texto",
        "foto",
        "audio",
        "checkbox",
        "numero",
        "data",
        "selecao_unica",
        "toggle",
        "cep",
        "cnpj",
        "video",
      ],
      tipo_solicitacao: ["instalacao", "upgrade"],
    },
  },
} as const
