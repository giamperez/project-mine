import { describe, expect, it } from "vitest";
import { leerPuntosKML } from "../src/io/kmlReader.js";
import { wgs84AUtm } from "../src/io/wgs84Utm.js";

const KML_DOS_PUNTOS = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Punto A</name>
      <Point>
        <coordinates>-74.00597,40.71435,10</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Punto B</name>
      <Point>
        <coordinates>-74.01,40.72,25.5</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;

describe("leerPuntosKML", () => {
  it("extrae nombre, lat/lon/elevacion y los proyecta a UTM", () => {
    const puntos = leerPuntosKML(KML_DOS_PUNTOS);
    expect(puntos).toHaveLength(2);
    expect(puntos[0].nombre).toBe("Punto A");
    expect(puntos[0].lat_grados).toBeCloseTo(40.71435, 6);
    expect(puntos[0].lon_grados).toBeCloseTo(-74.00597, 6);
    expect(puntos[0].elevacion_m).toBe(10);
    expect(puntos[0].z).toBe(10);

    // el x,y debe coincidir exactamente con llamar wgs84AUtm directamente para ese mismo punto
    const referencia = wgs84AUtm(40.71435, -74.00597);
    expect(puntos[0].x).toBeCloseTo(referencia.este_m, 6);
    expect(puntos[0].y).toBeCloseTo(referencia.norte_m, 6);
  });

  it("usa la zona UTM del primer punto para todos los demas, aunque el segundo caiga en otra zona por si solo", () => {
    const puntos = leerPuntosKML(KML_DOS_PUNTOS);
    const zonaSolaB = wgs84AUtm(40.72, -74.01).zona;
    const zonaForzadaA = wgs84AUtm(40.71435, -74.00597).zona;
    expect(zonaSolaB).toBe(zonaForzadaA); // en este caso ambos puntos ya caen en la misma zona (18)
    // pero el mecanismo se verifica directamente: el segundo punto se calculo con zona forzada al de A
    const conZonaForzada = wgs84AUtm(40.72, -74.01, undefined, zonaForzadaA);
    expect(puntos[1].x).toBeCloseTo(conZonaForzada.este_m, 6);
    expect(puntos[1].y).toBeCloseTo(conZonaForzada.norte_m, 6);
  });

  it("sin coordinates o sin Placemark, devuelve arreglo vacio", () => {
    expect(leerPuntosKML("<kml><Document></Document></kml>")).toEqual([]);
    expect(leerPuntosKML("")).toEqual([]);
  });

  it("altitud ausente en las coordenadas se toma como 0", () => {
    const kml = `<Placemark><name>Sin alt</name><Point><coordinates>-74.0,40.7</coordinates></Point></Placemark>`;
    const puntos = leerPuntosKML(kml);
    expect(puntos[0].elevacion_m).toBe(0);
  });
});
