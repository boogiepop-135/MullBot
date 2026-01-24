import { adaptLegacyCommand } from './command-adapter';

// Importar comandos legacy
const helpCmd = require("./help.command");
const pingCmd = require("./ping.command");
const chatCmd = require("./chat.command");
const preciosCmd = require("./precios.command");
const tarjetaCmd = require("./tarjeta.command");
const pagoCmd = require("./pago.command");
const productosCmd = require("./productos.command");
const guiaCmd = require("./guia.command");
const contactoCmd = require("./contacto.command");
const estadisticasCmd = require("./estadisticas.command");
const getCmd = require("./get.command");

// Comandos innecesarios para bot de ventas - ELIMINADOS:
// - meme, joke, meteo, translate, langlist, onboard, gpt

// Adaptar comandos legacy a Evolution API
export default {
    help: adaptLegacyCommand(helpCmd),
    ping: adaptLegacyCommand(pingCmd),
    chat: adaptLegacyCommand(chatCmd),
    precios: adaptLegacyCommand(preciosCmd),
    tarjeta: adaptLegacyCommand(tarjetaCmd),
    pago: adaptLegacyCommand(pagoCmd),
    productos: adaptLegacyCommand(productosCmd),
    guia: adaptLegacyCommand(guiaCmd),
    contacto: adaptLegacyCommand(contactoCmd),
    estadisticas: adaptLegacyCommand(estadisticasCmd),
    get: adaptLegacyCommand(getCmd),
};