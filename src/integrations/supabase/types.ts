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
      casos: {
        Row: {
          agente_id: string | null
          atualizado_em: string
          cliente_id: string
          codigo: string
          criado_em: string
          criado_por: string | null
          formulario_id: string | null
          id: string
          status: Database["public"]["Enums"]["caso_status"]
        }
        Insert: {
          agente_id?: string | null
          atualizado_em?: string
          cliente_id: string
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          formulario_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["caso_status"]
        }
        Update: {
          agente_id?: string | null
          atualizado_em?: string
          cliente_id?: string
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          formulario_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["caso_status"]
        }
        Relationships: [
          {
            foreignKeyName: "casos_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cnpj: string | null
          criado_em: string
          criado_por: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      formularios: {
        Row: {
          ativo: boolean
          cliente_id: string
          criado_em: string
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "formularios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formularios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      perguntas: {
        Row: {
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
      respostas_agente: {
        Row: {
          arquivo_path: string | null
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
      admin_pode_ver_formulario: {
        Args: { _formulario_id: string; _user_id: string }
        Returns: boolean
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
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
    }
    Enums: {
      app_role: "super_admin" | "admin" | "especialista" | "agente_tecnico"
      caso_status:
        | "rascunho"
        | "enviado"
        | "em_analise"
        | "aguardando_revisao"
        | "aprovado"
      pergunta_tipo: "texto" | "foto" | "audio" | "checkbox" | "numero"
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
      caso_status: [
        "rascunho",
        "enviado",
        "em_analise",
        "aguardando_revisao",
        "aprovado",
      ],
      pergunta_tipo: ["texto", "foto", "audio", "checkbox", "numero"],
    },
  },
} as const
