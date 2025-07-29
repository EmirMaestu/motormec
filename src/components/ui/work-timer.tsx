import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Badge } from "./badge";

interface WorkTimerProps {
  userId: string;
  vehicle: any;
  isWorking: boolean;
  className?: string;
  showIcon?: boolean;
}

export function WorkTimer({ userId, vehicle, isWorking, className = "", showIcon = true }: WorkTimerProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Actualizar el tiempo actual cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Encontrar el usuario responsable
  const userResponsible = vehicle.responsibles?.find((r: any) => r.userId === userId);
  
  if (!userResponsible) {
    return null;
  }

  // Calcular tiempo total trabajado
  const calculateTotalTime = () => {
    let totalMs = userResponsible.totalWorkTime || 0;
    
    // Si está trabajando actualmente, agregar el tiempo de la sesión actual
    if (isWorking && userResponsible.workStartedAt) {
      const currentSessionTime = currentTime - new Date(userResponsible.workStartedAt).getTime();
      totalMs += currentSessionTime;
    }
    
    return totalMs;
  };

  // Formatear tiempo en HH:MM:SS
  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const totalTime = calculateTotalTime();
  const formattedTime = formatTime(totalTime);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {showIcon && <Clock className="h-3 w-3" />}
      <Badge 
        variant={isWorking ? "default" : "outline"}
        className={`text-xs font-mono ${
          isWorking 
            ? "bg-green-100 text-green-800 border-green-200 animate-pulse" 
            : "bg-gray-50 text-gray-600"
        }`}
      >
        {formattedTime}
      </Badge>
    </div>
  );
}

// Componente para mostrar solo el tiempo formateado
export function formatWorkTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

export default WorkTimer;