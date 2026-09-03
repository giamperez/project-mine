import { describe, expect, it } from "vitest";
import { wgs84AUtm, zonaUTM } from "../src/io/wgs84Utm.js";

describe("zonaUTM", () => {
  it("calcula la zona estandar floor((lon+180)/6)+1", () => {
    expect(zonaUTM(-74.00597)).toBe(18);
    expect(zonaUTM(0)).toBe(31);
    expect(zonaUTM(-180)).toBe(1);
  });
});

describe("wgs84AUtm", () => {
  it("reproduce el ejemplo numerico de Snyder (1987) USGS PP1395 p.269 con elipsoide Clarke 1866", () => {
    // phi=40°30'00"N, lambda=73°30'00"W, zona 18 (meridiano central=75°W, coincide con Snyder).
    // Valores publicados por Snyder (antes del falso este): x=127,106.47 m, y=4,484,124.43 m.
    const clarke1866 = { a: 6378206.4, f: 1 - Math.sqrt(1 - 0.00676866) };
    const r = wgs84AUtm(40.5, -73.5, clarke1866, 18);
    expect(r.este_m - 500000).toBeCloseTo(127106.47, 0);
    expect(r.norte_m).toBeCloseTo(4484124.43, 0);
  });

  it("reproduce un caso WGS84 de referencia (Turbo87/utm, Nueva York) a precision de metro", () => {
    const r = wgs84AUtm(40.71435, -74.00597);
    expect(r.zona).toBe(18);
    expect(r.hemisferioNorte).toBe(true);
    expect(r.este_m).toBeCloseTo(583960, 0);
    expect(r.norte_m).toBeCloseTo(4507523, 0);
  });

  it("hemisferio sur suma el falso norte de 10,000,000 m", () => {
    const rNorte = wgs84AUtm(40.71435, -74.00597);
    const rSur = wgs84AUtm(-40.71435, -74.00597);
    expect(rSur.hemisferioNorte).toBe(false);
    // por simetria aproximada del elipsoide, norte_m en el sur ~ 10,000,000 - norte_m equivalente en el norte
    expect(rSur.norte_m).toBeCloseTo(10000000 - rNorte.norte_m, 0);
  });
});
