import { IconeEditar, IconeExcluir } from "@/components/ui/icones-de-acao";
import { useId, type ReactNode } from "react";

import { Button, Card, Input, Label, Select } from "@/components/ui-bits";

export function FiltrosCatalogo({ busca, onBusca, ativo, onAtivo, children }: {
  busca: string;
  onBusca: (busca: string) => void;
  ativo: boolean | undefined;
  onAtivo: (ativo: boolean | undefined) => void;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
      <div className="w-full sm:max-w-xs">
        <Label htmlFor={id + "-busca"}>Buscar por código ou descrição</Label>
        <Input id={id + "-busca"} type="search" maxLength={80} value={busca} onChange={(event) => onBusca(event.currentTarget.value)} />
      </div>
      <div className="w-full sm:w-40">
        <Label htmlFor={id + "-situacao"}>Situação</Label>
        <Select id={id + "-situacao"} value={ativo === undefined ? "todos" : String(ativo)} onChange={(event) => {
          const valor = event.currentTarget.value;
          onAtivo(valor === "todos" ? undefined : valor === "true");
        }}>
          <option value="todos">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </Select>
      </div>
      {children}
    </Card>
  );
}

export function AcoesCatalogo({ nome, onEditar, onExcluir }: {
  nome: string;
  onEditar: () => void;
  onExcluir?: () => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button type="button" variant="secondary" size="sm" onClick={onEditar} aria-label={"Editar " + nome}>
        <IconeEditar /> Editar
      </Button>
      {onExcluir && (
        <Button type="button" variant="ghost" size="sm" onClick={onExcluir} aria-label={"Excluir " + nome} title="Excluir">
          <IconeExcluir className="text-destructive" />
        </Button>
      )}
    </div>
  );
}

export function DetalhesCatalogoMobile({ codigo, resumo, children }: { codigo: string; resumo: string; children?: ReactNode }) {
  return (
    <div className="mt-2 space-y-1 break-words text-xs text-muted-foreground lg:hidden">
      <p className="font-mono">{codigo}</p>
      {children}
      <p className="pt-1 font-medium text-foreground">Quando é sugerido no laudo</p>
      <p>{resumo}</p>
    </div>
  );
}

export function PreviaRegraCatalogo({ resumo }: { resumo: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
      <p className="font-medium">Quando é sugerido no laudo</p>
      <p className="mt-1 text-muted-foreground">{resumo}</p>
    </div>
  );
}
