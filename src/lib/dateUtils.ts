/**
 * Utilidades para manejo de fechas
 */

/**
 * Convierte una fecha ISO a formato DD/MM/YYYY
 * @param isoDate - Fecha en formato ISO (2025-12-17T...)
 * @returns Fecha en formato DD/MM/YYYY
 */
export function formatDateToDDMMYYYY(isoDate: string | undefined | null): string {
  if (!isoDate) return "Sin fecha";
  
  try {
    const date = new Date(isoDate);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    return "Fecha inválida";
  }
}

/**
 * Convierte una fecha DD/MM/YYYY a formato ISO
 * @param ddmmyyyy - Fecha en formato DD/MM/YYYY
 * @returns Fecha en formato ISO
 */
export function formatDDMMYYYYToISO(ddmmyyyy: string): string {
  const [day, month, year] = ddmmyyyy.split("/");
  return new Date(`${year}-${month}-${day}`).toISOString();
}

/**
 * Convierte una fecha ISO a formato DD/MM/YYYY HH:MM
 * @param isoDate - Fecha en formato ISO
 * @returns Fecha en formato DD/MM/YYYY HH:MM
 */
export function formatDateTimeToLocal(isoDate: string | undefined | null): string {
  if (!isoDate) return "Sin fecha";
  
  try {
    const date = new Date(isoDate);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    return "Fecha inválida";
  }
}

/**
 * Obtiene la fecha actual en formato DD/MM/YYYY
 */
export function getTodayDDMMYYYY(): string {
  return formatDateToDDMMYYYY(new Date().toISOString());
}

/**
 * Convierte una fecha ISO a formato relativo (hace X días)
 */
export function formatDateRelative(isoDate: string | undefined | null): string {
  if (!isoDate) return "Sin fecha";
  
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
    return `Hace ${Math.floor(diffDays / 365)} años`;
  } catch (error) {
    return "Fecha inválida";
  }
}

/**
 * Formatea una fecha para input type="date" (YYYY-MM-DD)
 */
export function formatDateForInput(isoDate: string | undefined | null): string {
  if (!isoDate) return "";
  
  try {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    return "";
  }
}

/**
 * Convierte DD/MM/YYYY a formato para input (YYYY-MM-DD)
 */
export function convertDDMMYYYYToInputFormat(ddmmyyyy: string): string {
  if (!ddmmyyyy) return "";
  
  try {
    const [day, month, year] = ddmmyyyy.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  } catch (error) {
    return "";
  }
}






