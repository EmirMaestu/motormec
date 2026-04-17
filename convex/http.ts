import { httpRouter } from "convex/server";
import { handleWhatsApp } from "./whatsappAction";

const http = httpRouter();

// Verificación del webhook (GET) y recepción de mensajes (POST)
http.route({
  path: "/whatsapp",
  method: "GET",
  handler: handleWhatsApp,
});

http.route({
  path: "/whatsapp",
  method: "POST",
  handler: handleWhatsApp,
});

export default http;
