// ─── Built-in brand & model catalog for autocomplete ────────────────────────
// Curated set of common collector watches. Picking a known model prefills its
// movement specs in the watch form; free-text entry always remains possible.

import type { MovementType } from "./types";

export interface CatalogModel {
  model: string;
  reference?: string;
  movementType: MovementType;
  caliber?: string;
  beatRate?: number;
  powerReserveHours?: number;
  jewels?: number;
  cosc?: boolean;
}

export const WATCH_BRANDS: string[] = [
  "A. Lange & Söhne", "Audemars Piguet", "Baltic", "Blancpain", "Breitling",
  "Bulova", "Cartier", "Casio", "Certina", "Christopher Ward", "Citizen",
  "Damasko", "Doxa", "Frederique Constant", "G-Shock", "Girard-Perregaux",
  "Glashütte Original", "Grand Seiko", "Hamilton", "IWC", "Jaeger-LeCoultre",
  "Junghans", "Longines", "Mido", "Montblanc", "Nomos", "Omega", "Oris",
  "Panerai", "Patek Philippe", "Rado", "Rolex", "Seiko", "Sinn", "Squale",
  "Steinhart", "Swatch", "TAG Heuer", "Tissot", "Tudor", "Ulysse Nardin",
  "Vacheron Constantin", "Zenith",
];

export const WATCH_MODELS: Record<string, CatalogModel[]> = {
  Rolex: [
    { model: "Submariner Date", reference: "126610LN", movementType: "automatic", caliber: "3235", beatRate: 28800, powerReserveHours: 70, jewels: 31, cosc: true },
    { model: "Submariner No-Date", reference: "124060", movementType: "automatic", caliber: "3230", beatRate: 28800, powerReserveHours: 70, jewels: 31, cosc: true },
    { model: "Datejust 36", reference: "126200", movementType: "automatic", caliber: "3235", beatRate: 28800, powerReserveHours: 70, jewels: 31, cosc: true },
    { model: "Datejust 41", reference: "126300", movementType: "automatic", caliber: "3235", beatRate: 28800, powerReserveHours: 70, jewels: 31, cosc: true },
    { model: "GMT-Master II", reference: "126710BLNR", movementType: "automatic", caliber: "3285", beatRate: 28800, powerReserveHours: 70, jewels: 31, cosc: true },
    { model: "Explorer 36", reference: "124270", movementType: "automatic", caliber: "3230", beatRate: 28800, powerReserveHours: 70, jewels: 31, cosc: true },
    { model: "Explorer II", reference: "226570", movementType: "automatic", caliber: "3285", beatRate: 28800, powerReserveHours: 70, jewels: 31, cosc: true },
    { model: "Daytona", reference: "126500LN", movementType: "automatic", caliber: "4131", beatRate: 28800, powerReserveHours: 72, jewels: 39, cosc: true },
    { model: "Oyster Perpetual 36", reference: "126000", movementType: "automatic", caliber: "3230", beatRate: 28800, powerReserveHours: 70, jewels: 31, cosc: true },
    { model: "Sea-Dweller", reference: "126600", movementType: "automatic", caliber: "3235", beatRate: 28800, powerReserveHours: 70, jewels: 31, cosc: true },
  ],
  Omega: [
    { model: "Speedmaster Professional", reference: "310.30.42.50.01.001", movementType: "manual", caliber: "3861", beatRate: 21600, powerReserveHours: 50, jewels: 26, cosc: true },
    { model: "Speedmaster Reduced", reference: "3510.50", movementType: "automatic", caliber: "3220", beatRate: 28800, powerReserveHours: 40, jewels: 45 },
    { model: "Seamaster Diver 300M", reference: "210.30.42.20.03.001", movementType: "automatic", caliber: "8800", beatRate: 25200, powerReserveHours: 55, jewels: 35, cosc: true },
    { model: "Seamaster Aqua Terra 150M", reference: "220.10.41.21.03.004", movementType: "automatic", caliber: "8900", beatRate: 25200, powerReserveHours: 60, jewels: 39, cosc: true },
    { model: "Seamaster Planet Ocean 600M", reference: "215.30.44.21.01.001", movementType: "automatic", caliber: "8900", beatRate: 25200, powerReserveHours: 60, jewels: 39, cosc: true },
    { model: "Constellation", reference: "131.10.39.20.01.001", movementType: "automatic", caliber: "8800", beatRate: 25200, powerReserveHours: 55, jewels: 35, cosc: true },
    { model: "De Ville Prestige", reference: "424.10.40.20.02.001", movementType: "automatic", caliber: "2500", beatRate: 25200, powerReserveHours: 48, jewels: 27, cosc: true },
    { model: "Railmaster", reference: "220.10.40.20.01.001", movementType: "automatic", caliber: "8806", beatRate: 25200, powerReserveHours: 55, jewels: 35, cosc: true },
  ],
  Seiko: [
    { model: "Prospex SPB143", reference: "SPB143J1", movementType: "automatic", caliber: "6R35", beatRate: 21600, powerReserveHours: 70, jewels: 24 },
    { model: "Prospex SPB317", reference: "SPB317J1", movementType: "automatic", caliber: "6R35", beatRate: 21600, powerReserveHours: 70, jewels: 24 },
    { model: "Presage Cocktail Time", reference: "SRPB41J1", movementType: "automatic", caliber: "4R35", beatRate: 21600, powerReserveHours: 41, jewels: 23 },
    { model: "Presage Sharp Edged", reference: "SPB165J1", movementType: "automatic", caliber: "6R35", beatRate: 21600, powerReserveHours: 70, jewels: 24 },
    { model: "SKX007", reference: "SKX007K2", movementType: "automatic", caliber: "7S26", beatRate: 21600, powerReserveHours: 41, jewels: 21 },
    { model: "Seiko 5 Sports SRPD", reference: "SRPD55K1", movementType: "automatic", caliber: "4R36", beatRate: 21600, powerReserveHours: 41, jewels: 24 },
    { model: "Turtle", reference: "SRP777K1", movementType: "automatic", caliber: "4R36", beatRate: 21600, powerReserveHours: 41, jewels: 24 },
    { model: "Samurai", reference: "SRPB51K1", movementType: "automatic", caliber: "4R35", beatRate: 21600, powerReserveHours: 41, jewels: 23 },
    { model: "Alpinist", reference: "SPB121J1", movementType: "automatic", caliber: "6R35", beatRate: 21600, powerReserveHours: 70, jewels: 24 },
    { model: "Marinemaster 300", reference: "SLA023J1", movementType: "automatic", caliber: "8L35", beatRate: 28800, powerReserveHours: 50, jewels: 26 },
  ],
  "Grand Seiko": [
    { model: "SBGX261", reference: "SBGX261", movementType: "quartz", caliber: "9F62", jewels: 9 },
    { model: "SBGA211 \"Snowflake\"", reference: "SBGA211", movementType: "automatic", caliber: "9R65", beatRate: 28800, powerReserveHours: 72, jewels: 30 },
    { model: "SBGW231", reference: "SBGW231", movementType: "manual", caliber: "9S64", beatRate: 28800, powerReserveHours: 72, jewels: 24 },
    { model: "SBGH201", reference: "SBGH201", movementType: "automatic", caliber: "9S85", beatRate: 36000, powerReserveHours: 55, jewels: 37 },
    { model: "SBGM221", reference: "SBGM221", movementType: "automatic", caliber: "9S66", beatRate: 28800, powerReserveHours: 72, jewels: 35 },
    { model: "White Birch SLGH005", reference: "SLGH005", movementType: "automatic", caliber: "9SA5", beatRate: 36000, powerReserveHours: 80, jewels: 47 },
  ],
  Tudor: [
    { model: "Black Bay 58", reference: "M79030N", movementType: "automatic", caliber: "MT5402", beatRate: 28800, powerReserveHours: 70, jewels: 27, cosc: true },
    { model: "Black Bay 41", reference: "M7941A1A0NU", movementType: "automatic", caliber: "MT5602-U", beatRate: 28800, powerReserveHours: 70, jewels: 25, cosc: true },
    { model: "Pelagos 39", reference: "M25407N", movementType: "automatic", caliber: "MT5400", beatRate: 28800, powerReserveHours: 70, jewels: 27, cosc: true },
    { model: "Pelagos FXD", reference: "M25707B", movementType: "automatic", caliber: "MT5602", beatRate: 28800, powerReserveHours: 70, jewels: 25, cosc: true },
    { model: "Ranger", reference: "M79950", movementType: "automatic", caliber: "MT5402", beatRate: 28800, powerReserveHours: 70, jewels: 27, cosc: true },
    { model: "Royal 41", reference: "M28600", movementType: "automatic", caliber: "T603", beatRate: 28800, powerReserveHours: 38, jewels: 25 },
  ],
  Nomos: [
    { model: "Tangente 38", reference: "164", movementType: "manual", caliber: "Alpha", beatRate: 21600, powerReserveHours: 43, jewels: 17 },
    { model: "Tangente Neomatik 39", reference: "140", movementType: "automatic", caliber: "DUW 3001", beatRate: 21600, powerReserveHours: 43, jewels: 27 },
    { model: "Club Campus 38", reference: "735", movementType: "manual", caliber: "Alpha", beatRate: 21600, powerReserveHours: 43, jewels: 17 },
    { model: "Orion 38", reference: "384", movementType: "manual", caliber: "Alpha", beatRate: 21600, powerReserveHours: 43, jewels: 17 },
    { model: "Metro Neomatik", reference: "1114", movementType: "automatic", caliber: "DUW 3001", beatRate: 21600, powerReserveHours: 43, jewels: 27 },
    { model: "Ludwig 38", reference: "234", movementType: "manual", caliber: "Alpha", beatRate: 21600, powerReserveHours: 43, jewels: 17 },
  ],
  Longines: [
    { model: "Spirit Zulu Time", reference: "L3.812.4.53.6", movementType: "automatic", caliber: "L844.4", beatRate: 25200, powerReserveHours: 72, cosc: true },
    { model: "Spirit 40", reference: "L3.810.4.53.6", movementType: "automatic", caliber: "L888.4", beatRate: 25200, powerReserveHours: 72, cosc: true },
    { model: "HydroConquest 41", reference: "L3.781.4.56.6", movementType: "automatic", caliber: "L888", beatRate: 25200, powerReserveHours: 72 },
    { model: "Legend Diver", reference: "L3.774.4.50.0", movementType: "automatic", caliber: "L888.5", beatRate: 25200, powerReserveHours: 72 },
    { model: "Master Collection 40", reference: "L2.909.4.78.3", movementType: "automatic", caliber: "L888", beatRate: 25200, powerReserveHours: 72 },
  ],
  Tissot: [
    { model: "PRX Powermatic 80", reference: "T137.407.11.041.00", movementType: "automatic", caliber: "Powermatic 80.111", beatRate: 21600, powerReserveHours: 80, jewels: 23 },
    { model: "PRX 40 Quartz", reference: "T137.410.11.041.00", movementType: "quartz", caliber: "F06.115" },
    { model: "Seastar 1000 Powermatic 80", reference: "T120.407.11.041.03", movementType: "automatic", caliber: "Powermatic 80.111", beatRate: 21600, powerReserveHours: 80, jewels: 23 },
    { model: "Gentleman Powermatic 80 Silicium", reference: "T127.407.11.041.00", movementType: "automatic", caliber: "Powermatic 80.811", beatRate: 21600, powerReserveHours: 80, jewels: 23 },
    { model: "Le Locle Powermatic 80", reference: "T006.407.11.033.00", movementType: "automatic", caliber: "Powermatic 80.111", beatRate: 21600, powerReserveHours: 80, jewels: 23 },
  ],
  Hamilton: [
    { model: "Khaki Field Mechanical 38", reference: "H69439931", movementType: "manual", caliber: "H-50", beatRate: 21600, powerReserveHours: 80, jewels: 17 },
    { model: "Khaki Field Auto 42", reference: "H70595593", movementType: "automatic", caliber: "H-10", beatRate: 21600, powerReserveHours: 80, jewels: 25 },
    { model: "Khaki Aviation Pilot Pioneer", reference: "H76419931", movementType: "automatic", caliber: "H-10", beatRate: 21600, powerReserveHours: 80, jewels: 25 },
    { model: "Jazzmaster Open Heart 40", reference: "H32675540", movementType: "automatic", caliber: "H-10", beatRate: 21600, powerReserveHours: 80, jewels: 25 },
    { model: "Intra-Matic 38", reference: "H38455151", movementType: "automatic", caliber: "H-10", beatRate: 21600, powerReserveHours: 80, jewels: 25 },
  ],
  Oris: [
    { model: "Aquis Date 41.5", reference: "01 733 7766 4135", movementType: "automatic", caliber: "Oris 733 (SW200-1)", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
    { model: "Divers Sixty-Five 40", reference: "01 733 7707 4064", movementType: "automatic", caliber: "Oris 733 (SW200-1)", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
    { model: "Big Crown ProPilot", reference: "01 751 7761 4164", movementType: "automatic", caliber: "Oris 751 (SW220-1)", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
    { model: "ProPilot X Calibre 400", reference: "01 400 7778 7153", movementType: "automatic", caliber: "Oris 400", beatRate: 28800, powerReserveHours: 120, jewels: 21 },
    { model: "Aquis Calibre 400", reference: "01 400 7769 4135", movementType: "automatic", caliber: "Oris 400", beatRate: 28800, powerReserveHours: 120, jewels: 21 },
  ],
  IWC: [
    { model: "Pilot's Watch Mark XX", reference: "IW328201", movementType: "automatic", caliber: "32111", beatRate: 28800, powerReserveHours: 120, jewels: 21 },
    { model: "Big Pilot 43", reference: "IW329301", movementType: "automatic", caliber: "82100", beatRate: 28800, powerReserveHours: 60, jewels: 31 },
    { model: "Portugieser Chronograph", reference: "IW371604", movementType: "automatic", caliber: "69355", beatRate: 28800, powerReserveHours: 46, jewels: 27 },
    { model: "Portofino Automatic", reference: "IW356501", movementType: "automatic", caliber: "35111", beatRate: 28800, powerReserveHours: 42, jewels: 25 },
    { model: "Aquatimer Automatic", reference: "IW328801", movementType: "automatic", caliber: "32111", beatRate: 28800, powerReserveHours: 120, jewels: 21 },
  ],
  Breitling: [
    { model: "Navitimer B01 43", reference: "AB0138211B1P1", movementType: "automatic", caliber: "B01", beatRate: 28800, powerReserveHours: 70, jewels: 47, cosc: true },
    { model: "Superocean Heritage 42", reference: "AB2010121B1A1", movementType: "automatic", caliber: "B20", beatRate: 28800, powerReserveHours: 70, cosc: true },
    { model: "Chronomat B01 42", reference: "AB0134101B1A1", movementType: "automatic", caliber: "B01", beatRate: 28800, powerReserveHours: 70, jewels: 47, cosc: true },
    { model: "Avenger Automatic GMT 44", reference: "A32320101B1X1", movementType: "automatic", caliber: "B32 (SW330)", beatRate: 28800, powerReserveHours: 42, cosc: true },
  ],
  "TAG Heuer": [
    { model: "Carrera Chronograph 42", reference: "CBN2010.BA0642", movementType: "automatic", caliber: "Heuer 02", beatRate: 28800, powerReserveHours: 80, jewels: 33 },
    { model: "Aquaracer Professional 300", reference: "WBP2110.BA0627", movementType: "automatic", caliber: "5 (SW200-1)", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
    { model: "Monaco", reference: "CBL2111.FC6453", movementType: "automatic", caliber: "Heuer 02", beatRate: 28800, powerReserveHours: 80, jewels: 33 },
    { model: "Formula 1 Quartz", reference: "WAZ1110.BA0875", movementType: "quartz" },
  ],
  Sinn: [
    { model: "556 I", reference: "556.010", movementType: "automatic", caliber: "SW200-1", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
    { model: "104 St Sa", reference: "104.010", movementType: "automatic", caliber: "SW220-1", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
    { model: "U50", reference: "1050.010", movementType: "automatic", caliber: "SW300-1", beatRate: 28800, powerReserveHours: 42, jewels: 25 },
    { model: "356 Flieger", reference: "356.020", movementType: "automatic", caliber: "SW500", beatRate: 28800, powerReserveHours: 48, jewels: 25 },
  ],
  "Jaeger-LeCoultre": [
    { model: "Reverso Classic Medium", reference: "Q2548520", movementType: "manual", caliber: "822/2", beatRate: 21600, powerReserveHours: 42, jewels: 19 },
    { model: "Master Ultra Thin Date", reference: "Q1238420", movementType: "automatic", caliber: "899", beatRate: 28800, powerReserveHours: 70, jewels: 30 },
    { model: "Polaris Automatic", reference: "Q9008170", movementType: "automatic", caliber: "898", beatRate: 28800, powerReserveHours: 70, jewels: 30 },
  ],
  Cartier: [
    { model: "Tank Must Large", reference: "WSTA0041", movementType: "quartz" },
    { model: "Tank Must Extra-Large Auto", reference: "WSTA0040", movementType: "automatic", caliber: "1847 MC", beatRate: 28800, powerReserveHours: 40 },
    { model: "Santos Medium", reference: "WSSA0029", movementType: "automatic", caliber: "1847 MC", beatRate: 28800, powerReserveHours: 40 },
    { model: "Ballon Bleu 40", reference: "WSBB0040", movementType: "automatic", caliber: "1847 MC", beatRate: 28800, powerReserveHours: 40 },
  ],
  Zenith: [
    { model: "Chronomaster Sport", reference: "03.3100.3600/69.M3100", movementType: "automatic", caliber: "El Primero 3600", beatRate: 36000, powerReserveHours: 60, jewels: 35 },
    { model: "Chronomaster Original", reference: "03.3200.3600/69.C902", movementType: "automatic", caliber: "El Primero 3600", beatRate: 36000, powerReserveHours: 60, jewels: 35 },
    { model: "Defy Skyline", reference: "03.9300.3620/01.I001", movementType: "automatic", caliber: "El Primero 3620", beatRate: 36000, powerReserveHours: 60 },
  ],
  Casio: [
    { model: "G-Shock DW-5600", reference: "DW-5600E-1V", movementType: "quartz" },
    { model: "G-Shock GA-2100", reference: "GA-2100-1A1", movementType: "quartz" },
    { model: "Casioak GM-2100", reference: "GM-2100-1A", movementType: "quartz" },
    { model: "A168", reference: "A168WA-1", movementType: "quartz" },
    { model: "Oceanus S100", reference: "OCW-S100-1AJF", movementType: "quartz" },
  ],
  Citizen: [
    { model: "Promaster Dive Eco-Drive", reference: "BN0150-28E", movementType: "quartz", caliber: "E168" },
    { model: "Tsuyosa", reference: "NJ0150-81E", movementType: "automatic", caliber: "8210", beatRate: 21600, powerReserveHours: 40, jewels: 21 },
    { model: "The Citizen Chronomaster", reference: "AQ4100-65E", movementType: "quartz", caliber: "A060" },
  ],
  "Christopher Ward": [
    { model: "C60 Trident Pro 300", reference: "C60-40ADA3-S00K0-B0", movementType: "automatic", caliber: "SW200-1", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
    { model: "C65 Dune", reference: "C65-38ADA1-S00W0-B0", movementType: "automatic", caliber: "SW200-1", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
    { model: "The Twelve", reference: "C12-40ADA2-S00B0-B0", movementType: "automatic", caliber: "SW200-1", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
  ],
  "Patek Philippe": [
    { model: "Calatrava 5227", reference: "5227G-001", movementType: "automatic", caliber: "26-330 S C", beatRate: 28800, powerReserveHours: 45, jewels: 30 },
    { model: "Aquanaut 5167", reference: "5167A-001", movementType: "automatic", caliber: "26-330 S C", beatRate: 28800, powerReserveHours: 45, jewels: 30 },
    { model: "Nautilus 5811", reference: "5811/1G-001", movementType: "automatic", caliber: "26-330 S C", beatRate: 28800, powerReserveHours: 45, jewels: 30 },
  ],
  "Audemars Piguet": [
    { model: "Royal Oak 41 Selfwinding", reference: "15510ST.OO.1320ST.06", movementType: "automatic", caliber: "4302", beatRate: 28800, powerReserveHours: 70, jewels: 32 },
    { model: "Royal Oak Offshore 42", reference: "26420SO.OO.A002CA.01", movementType: "automatic", caliber: "4404", beatRate: 28800, powerReserveHours: 70, jewels: 40 },
  ],
  "A. Lange & Söhne": [
    { model: "Saxonia Thin", reference: "211.026", movementType: "manual", caliber: "L093.1", beatRate: 21600, powerReserveHours: 72, jewels: 28 },
    { model: "Lange 1", reference: "191.039", movementType: "manual", caliber: "L121.1", beatRate: 21600, powerReserveHours: 72, jewels: 43 },
  ],
  Panerai: [
    { model: "Luminor Marina 44", reference: "PAM01312", movementType: "automatic", caliber: "P.9010", beatRate: 28800, powerReserveHours: 72, jewels: 31 },
    { model: "Luminor Base Logo", reference: "PAM01084", movementType: "manual", caliber: "P.6000", beatRate: 21600, powerReserveHours: 72, jewels: 19 },
  ],
  Mido: [
    { model: "Ocean Star 200", reference: "M026.430.11.041.00", movementType: "automatic", caliber: "Caliber 80 (C07.621)", beatRate: 21600, powerReserveHours: 80, jewels: 25 },
    { model: "Baroncelli Heritage", reference: "M027.407.16.010.00", movementType: "automatic", caliber: "Caliber 80", beatRate: 21600, powerReserveHours: 80, jewels: 25 },
    { model: "Multifort M", reference: "M038.430.11.041.00", movementType: "automatic", caliber: "Caliber 80", beatRate: 21600, powerReserveHours: 80, jewels: 25 },
  ],
  Junghans: [
    { model: "Max Bill Automatic", reference: "027/3500.02", movementType: "automatic", caliber: "J800.1 (ETA 2824-2)", beatRate: 28800, powerReserveHours: 38, jewels: 25 },
    { model: "Max Bill Hand-Wound", reference: "027/3702.02", movementType: "manual", caliber: "J805.1 (ETA 2801-2)", beatRate: 28800, powerReserveHours: 42, jewels: 17 },
    { model: "Meister Classic", reference: "027/4310.00", movementType: "automatic", caliber: "J800.1", beatRate: 28800, powerReserveHours: 38, jewels: 25 },
  ],
  Baltic: [
    { model: "Aquascaphe Classic", movementType: "automatic", caliber: "Miyota 9039", beatRate: 28800, powerReserveHours: 42, jewels: 24 },
    { model: "HMS 003", movementType: "automatic", caliber: "Miyota 8315", beatRate: 21600, powerReserveHours: 60, jewels: 26 },
    { model: "MR01", movementType: "automatic", caliber: "Hangzhou 5000A", beatRate: 21600, powerReserveHours: 40 },
  ],
  Squale: [
    { model: "1521 Classic", reference: "1521CL", movementType: "automatic", caliber: "SW200-1", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
    { model: "Sub-39", reference: "SUB39GG", movementType: "automatic", caliber: "SW200-1", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
  ],
  Steinhart: [
    { model: "Ocean One 39", movementType: "automatic", caliber: "SW200-1", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
    { model: "Nav B-Uhr 44", movementType: "automatic", caliber: "SW200-1", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
  ],
  Certina: [
    { model: "DS Action Diver 38", reference: "C032.807.11.041.00", movementType: "automatic", caliber: "Powermatic 80.111", beatRate: 21600, powerReserveHours: 80, jewels: 23 },
    { model: "DS PH200M", reference: "C036.407.16.050.00", movementType: "automatic", caliber: "Powermatic 80.611", beatRate: 21600, powerReserveHours: 80, jewels: 23 },
  ],
  "Frederique Constant": [
    { model: "Classics Index Automatic", reference: "FC-303NN5B6B", movementType: "automatic", caliber: "FC-303 (SW200-1)", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
    { model: "Highlife Automatic", reference: "FC-303N4NH6B", movementType: "automatic", caliber: "FC-303", beatRate: 28800, powerReserveHours: 38, jewels: 26 },
  ],
};

/** Case/diacritic-insensitive "starts with or contains" filter with ranking. */
export function filterSuggestions(query: string, options: string[], limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return options.slice(0, limit);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const nq = norm(q);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const o of options) {
    const no = norm(o);
    if (no.startsWith(nq)) starts.push(o);
    else if (no.includes(nq)) contains.push(o);
  }
  return [...starts, ...contains].slice(0, limit);
}

export function modelsForBrand(brand: string): CatalogModel[] {
  const key = Object.keys(WATCH_MODELS).find(
    (k) => k.toLowerCase() === brand.trim().toLowerCase()
  );
  return key ? WATCH_MODELS[key] : [];
}
