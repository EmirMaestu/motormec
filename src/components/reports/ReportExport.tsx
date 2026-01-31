import { Download, FileText, FileSpreadsheet, Printer, Mail } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export interface ReportExportProps {
  data: any;
  reportName: string;
  onExport?: (format: 'pdf' | 'excel' | 'csv' | 'print') => void;
}

export function ReportExport({ data, reportName, onExport }: ReportExportProps) {
  
  const exportToCSV = () => {
    let csvContent = "";
    
    // Si es un array de objetos, crear CSV
    if (Array.isArray(data)) {
      if (data.length === 0) return;
      
      // Encabezados
      const headers = Object.keys(data[0]);
      csvContent += headers.join(",") + "\n";
      
      // Datos
      data.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          // Escapar comas y comillas
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvContent += values.join(",") + "\n";
      });
    } else {
      // Si es un objeto, convertir a formato clave-valor
      Object.entries(data).forEach(([key, value]) => {
        csvContent += `${key},${value}\n`;
      });
    }
    
    // Descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${reportName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (onExport) onExport('csv');
  };

  const exportToExcel = () => {
    // Para una implementación completa, usarías una librería como xlsx
    // Por ahora, exportamos como CSV que Excel puede abrir
    exportToCSV();
    if (onExport) onExport('excel');
  };

  const exportToPDF = () => {
    // Generar contenido HTML para imprimir/PDF
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #333;
            }
            h1 {
              color: #2563eb;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: left;
            }
            th {
              background-color: #2563eb;
              color: white;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .meta {
              color: #666;
              font-size: 0.9em;
              margin-bottom: 20px;
            }
            .summary {
              background-color: #f0f9ff;
              padding: 15px;
              border-radius: 5px;
              margin-bottom: 20px;
            }
            .summary h2 {
              color: #2563eb;
              margin-top: 0;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <h1>${reportName}</h1>
          <div class="meta">
            <p>Generado: ${new Date().toLocaleString('es-ES')}</p>
          </div>
          ${generateHTMLContent(data)}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    if (onExport) onExport('pdf');
  };

  const generateHTMLContent = (data: any): string => {
    if (!data) return '<p>No hay datos para mostrar</p>';

    let html = '';

    // Si hay un resumen, mostrarlo primero
    if (data.resumen) {
      html += '<div class="summary"><h2>Resumen</h2>';
      Object.entries(data.resumen).forEach(([key, value]) => {
        const label = formatLabel(key);
        const formattedValue = typeof value === 'number' 
          ? value.toLocaleString('es-ES', { style: 'currency', currency: 'ARS' })
          : value;
        html += `<p><strong>${label}:</strong> ${formattedValue}</p>`;
      });
      html += '</div>';
    }

    // Si hay un array de datos, crear tabla
    if (Array.isArray(data)) {
      html += createTableFromArray(data);
    } else if (data.detalle && Array.isArray(data.detalle)) {
      html += '<h2>Detalle</h2>';
      html += createTableFromArray(data.detalle);
    } else if (data.clientes && Array.isArray(data.clientes)) {
      html += '<h2>Clientes</h2>';
      html += createTableFromArray(data.clientes);
    } else if (data.mecanicos && Array.isArray(data.mecanicos)) {
      html += '<h2>Mecánicos</h2>';
      html += createTableFromArray(data.mecanicos);
    }

    return html;
  };

  const createTableFromArray = (arr: any[]): string => {
    if (arr.length === 0) return '<p>No hay datos</p>';

    const headers = Object.keys(arr[0]).filter(key => 
      !key.startsWith('_') && typeof arr[0][key] !== 'object'
    );

    let html = '<table><thead><tr>';
    headers.forEach(header => {
      html += `<th>${formatLabel(header)}</th>`;
    });
    html += '</tr></thead><tbody>';

    arr.forEach(row => {
      html += '<tr>';
      headers.forEach(header => {
        let value = row[header];
        if (typeof value === 'number' && header.toLowerCase().includes('cost') || 
            header.toLowerCase().includes('total') || 
            header.toLowerCase().includes('precio') ||
            header.toLowerCase().includes('monto')) {
          value = value.toLocaleString('es-ES', { style: 'currency', currency: 'ARS' });
        }
        html += `<td>${value ?? '-'}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
  };

  const formatLabel = (key: string): string => {
    const labels: Record<string, string> = {
      'ingresos': 'Ingresos',
      'egresos': 'Egresos',
      'balance': 'Balance',
      'totalClientes': 'Total de Clientes',
      'cantidadTransacciones': 'Cantidad de Transacciones',
      'ticketPromedio': 'Ticket Promedio',
      'ingresosTotal': 'Ingresos Totales',
      'promedioPorCliente': 'Promedio por Cliente',
      'name': 'Nombre',
      'phone': 'Teléfono',
      'email': 'Email',
      'totalGastado': 'Total Gastado',
      'cantidadVehiculos': 'Cantidad de Vehículos',
      'date': 'Fecha',
      'amount': 'Monto',
      'category': 'Categoría',
      'description': 'Descripción',
    };
    return labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
  };

  const handlePrint = () => {
    exportToPDF();
    if (onExport) onExport('print');
  };

  const handleEmail = () => {
    // Implementación futura para enviar por email
    alert('Función de envío por email próximamente disponible');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Exportar como</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail} disabled>
          <Mail className="h-4 w-4 mr-2" />
          Enviar por email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}







