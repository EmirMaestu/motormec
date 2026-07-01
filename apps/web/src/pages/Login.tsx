import { useState, type FormEvent } from "react";
import { Wrench } from "lucide-react";
import { useAuth } from "@/auth";
import { Button, Field, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";

export function LoginPage() {
  const { login } = useAuth();
  const [tenantSlug, setTenantSlug] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(tenantSlug.trim(), username.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Credenciales inválidas"
          : "No se pudo iniciar sesión",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-deep-forest text-paper-white p-12">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center h-10 w-10 rounded-[4px] bg-chartreuse-lime text-ink-black">
            <Wrench size={20} />
          </div>
          <span className="font-display text-[24px]">Momec</span>
        </div>
        <div>
          <div className="eyebrow text-chartreuse-lime mb-4">Gestión de taller · multi-taller</div>
          <h1 className="font-display text-[70px] leading-[0.95]">
            El taller,
            <br />
            bajo control.
          </h1>
          <p className="mt-6 max-w-md text-paper-white/80">
            Vehículos, clientes, finanzas, stock y el bot de WhatsApp — todo en un solo lugar,
            aislado por taller.
          </p>
        </div>
        <div className="text-paper-white/50 text-[12px]">© {new Date().getFullYear()} Momec</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <div className="eyebrow mb-2">Iniciar sesión</div>
          <h2 className="font-display text-[36px] text-deep-forest mb-8">Bienvenido</h2>

          <div className="space-y-4">
            <Field label="Taller (slug)">
              <Input
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="taller-demo"
                autoFocus
              />
            </Field>
            <Field label="Usuario">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
            </Field>
            <Field label="Contraseña">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
          </div>

          {error ? <p className="mt-4 text-[14px] text-red-700">{error}</p> : null}

          <Button type="submit" disabled={loading} className="mt-6 w-full">
            {loading ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
