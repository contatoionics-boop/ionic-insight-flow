import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import logo from "@/assets/ionics-logo.png";
import { mockUsers, roleLabels, setSession, type Role } from "@/lib/auth";
import { Button, Input, Label, Select } from "@/components/ui-bits";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("super_admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = mockUsers[role];
    setSession({ name: user.name, email: email || user.email, role });
    navigate({ to: role === "specialist" ? "/app/review-queue" : role === "admin" ? "/app/clients" : "/app/dashboard" });
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex">
        <img src={logo} alt="IONICS" className="h-9 w-auto" />
        <div>
          <h2 className="text-3xl font-semibold leading-tight">
            Mapeamento técnico pós-vistoria com IA.
          </h2>
          <p className="mt-3 max-w-md text-sm text-sidebar-foreground/70">
            Plataforma interna IONICS para gerenciar casos, revisar relatórios e acompanhar
            agentes técnicos em campo.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          © 2026 IONICS · Pioneirismo consagrado
        </p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm"
        >
          <div className="mb-6 flex justify-center md:hidden">
            <img src={logo} alt="IONICS" className="h-9 w-auto rounded-md bg-sidebar p-2" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Entrar na plataforma</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione o perfil para acessar a interface correspondente.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder={mockUsers[role].email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="role">Perfil (modo desenvolvimento)</Label>
              <Select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="super_admin">{roleLabels.super_admin}</option>
                <option value="admin">{roleLabels.admin}</option>
                <option value="specialist">{roleLabels.specialist}</option>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Agente Técnico acessa via link público sem login.
              </p>
            </div>
          </div>

          <Button type="submit" className="mt-6 w-full">
            Entrar
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Quer testar a tela do agente?{" "}
            <a href="/agent/demo-token" className="font-medium text-primary hover:underline">
              Abrir link de campo
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
