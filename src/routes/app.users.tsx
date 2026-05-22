import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Button, Table, Th, Td, Badge, Modal, Input, Select, Label } from "@/components/ui-bits";
import { users } from "@/lib/mock-data";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/app/users")({
  component: UsersPage,
});

function UsersPage() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gerencie todos os usuários e perfis da plataforma."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Novo usuário
          </Button>
        }
      />

      <Table>
        <thead>
          <tr>
            <Th>Nome</Th>
            <Th>E-mail</Th>
            <Th>Perfil</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <Td className="font-medium">{u.name}</Td>
              <Td>{u.email}</Td>
              <Td>{u.role}</Td>
              <Td>
                <Badge
                  className={u.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}
                >
                  {u.active ? "Ativo" : "Inativo"}
                </Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo usuário">
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input placeholder="Nome completo" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" placeholder="email@ionics.com.br" />
          </div>
          <div>
            <Label>Perfil</Label>
            <Select>
              <option>Super Admin</option>
              <option>Admin</option>
              <option>Especialista</option>
              <option>Agente Técnico</option>
            </Select>
          </div>
          <div>
            <Label>Senha temporária</Label>
            <Input type="text" placeholder="ionics-2026" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => setOpen(false)}>Criar usuário</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
