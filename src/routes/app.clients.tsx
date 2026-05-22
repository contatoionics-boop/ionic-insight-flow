import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Button, Table, Th, Td, Badge, Modal, Input, Label } from "@/components/ui-bits";
import { clients } from "@/lib/mock-data";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const [open, setOpen] = useState(false);
  const { role } = useAuth();
  const canCreate = role === "super_admin" || role === "admin";

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Empresas atendidas pela plataforma."
        actions={
          canCreate ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Novo cliente
            </Button>
          ) : undefined
        }
      />

      <Table>
        <thead>
          <tr>
            <Th>Nome</Th>
            <Th>CNPJ</Th>
            <Th>E-mail</Th>
            <Th>Cadastro</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <Td className="font-medium">{c.name}</Td>
              <Td>{c.cnpj}</Td>
              <Td>{c.email}</Td>
              <Td>{new Date(c.createdAt).toLocaleDateString("pt-BR")}</Td>
              <Td>
                <Badge
                  className={
                    c.status === "Ativo"
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {c.status}
                </Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo cliente">
        <div className="space-y-4">
          <div><Label>Razão social</Label><Input placeholder="Nome da empresa" /></div>
          <div><Label>CNPJ</Label><Input placeholder="00.000.000/0000-00" /></div>
          <div><Label>E-mail de contato</Label><Input type="email" placeholder="contato@empresa.com" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => setOpen(false)}>Cadastrar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
