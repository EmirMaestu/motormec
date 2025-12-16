import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useOrganization } from "@clerk/clerk-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Shield } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

export default function ProtectedRoute({
  children,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { membership } = useOrganization();

  // Si no se requiere admin, permitir acceso
  if (!adminOnly) {
    return <>{children}</>;
  }

  // Verificar si el usuario es admin
  const isAdmin = membership?.role === "org:admin";

  // Si no es admin y se requiere admin, mostrar mensaje de acceso denegado
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Shield className="h-6 w-6" />
              Acceso Denegado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              No tienes permisos para acceder a esta página. Esta sección está
              restringida solo para administradores.
            </p>
            <a
              href="/dashboard"
              className="text-blue-600 hover:underline font-medium"
            >
              Volver al Dashboard
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si es admin, mostrar el contenido
  return <>{children}</>;
}

