import { mutation } from "./_generated/server";

export const seedDashboardData = mutation({
  args: {},
  handler: async (ctx) => {
    // Verificar si ya hay datos
    const existingData = await ctx.db.query("dashboardItems").collect();
    if (existingData.length > 0) {
      return "Los datos ya existen";
    }

    // Datos iniciales basados en dashboard-data.json
    const initialData = [
      {
        header: "Cover page",
        type: "Cover page",
        status: "In Process" as const,
        target: "18",
        limit: "5",
        reviewer: "Eddie Lake"
      },
      {
        header: "Table of contents",
        type: "Table of contents",
        status: "Done" as const,
        target: "29",
        limit: "24",
        reviewer: "Eddie Lake"
      },
      {
        header: "Executive summary",
        type: "Section",
        status: "In Process" as const,
        target: "12",
        limit: "8",
        reviewer: "Sarah Miller"
      },
      {
        header: "Introduction",
        type: "Section",
        status: "Done" as const,
        target: "15",
        limit: "10",
        reviewer: "Mike Johnson"
      },
      {
        header: "Methodology",
        type: "Section",
        status: "Pending" as const,
        target: "20",
        limit: "15",
        reviewer: "Lisa Brown"
      },
      {
        header: "Results",
        type: "Section",
        status: "In Process" as const,
        target: "25",
        limit: "18",
        reviewer: "Tom Wilson"
      },
      {
        header: "Discussion",
        type: "Section",
        status: "Done" as const,
        target: "22",
        limit: "16",
        reviewer: "Anna Davis"
      },
      {
        header: "Conclusion",
        type: "Section",
        status: "Pending" as const,
        target: "10",
        limit: "7",
        reviewer: "John Smith"
      },
      {
        header: "References",
        type: "References",
        status: "Done" as const,
        target: "8",
        limit: "5",
        reviewer: "Emma White"
      },
      {
        header: "Appendices",
        type: "Appendix",
        status: "In Process" as const,
        target: "14",
        limit: "10",
        reviewer: "Robert Taylor"
      }
    ];

    // Insertar datos
    for (const item of initialData) {
      await ctx.db.insert("dashboardItems", item);
    }

    return "Datos iniciales insertados correctamente";
  },
});