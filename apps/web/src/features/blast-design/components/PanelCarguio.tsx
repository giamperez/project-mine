import { CATALOGO_EXPLOSIVOS_PERU, ROLES_CARGUIO, ETIQUETAS_ROL_CARGUIO, type ConfigCarguio, type ConfigRolCarguio, type RolCarguio } from "@suite/core";

interface Props {
  config: ConfigCarguio;
  onCambiarConfig: (config: ConfigCarguio) => void;
  densidadRoca_tm3: number;
  onCambiarDensidadRoca: (valor: number) => void;
}

const DESCRIPCION_ROL: Record<RolCarguio, string> = {
  arranque: "Alta concentración inicial para crear la primera cara libre.",
  produccion: "Carga principal para ampliar el vacío generado por el arranque.",
  contorno: "Carga desacoplada y menor densidad lineal para limitar daño y sobre-rotura.",
  recorte: "Puede mantenerse vacío o cargarse como control de contorno adicional.",
  arrastres: "Carga concentrada al fondo/piso para limpiar y evitar taladros con pata.",
};

export default function PanelCarguio({ config, onCambiarConfig, densidadRoca_tm3, onCambiarDensidadRoca }: Props) {
  function actualizarRol(rol: RolCarguio, cambios: Partial<ConfigRolCarguio>) {
    onCambiarConfig({ ...config, [rol]: { ...config[rol], ...cambios } });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {ROLES_CARGUIO.map((rol) => {
        const cfg = config[rol];
        return (
          <div className="panel-seccion-card" key={rol}>
            <div className="panel-seccion-header">
              <div className="panel-seccion-title">
                <span>{ETIQUETAS_ROL_CARGUIO[rol]}</span>
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--texto-tenue)" }}>
                <input type="checkbox" checked={cfg.cargar} onChange={(e) => actualizarRol(rol, { cargar: e.target.checked })} />
                Cargar
              </label>
            </div>
            <div className="panel-seccion-body">
              <div style={{ fontSize: 11, color: "var(--texto-tenue)", marginBottom: 8 }}>{DESCRIPCION_ROL[rol]}</div>

              <div className="campo" style={{ marginBottom: 8 }}>
                <label>Explosivo de columna</label>
                <select
                  value={cfg.explosivo.id}
                  onChange={(e) => {
                    const encontrado = CATALOGO_EXPLOSIVOS_PERU.find((ex) => ex.id === e.target.value);
                    if (encontrado) actualizarRol(rol, { explosivo: encontrado });
                  }}
                >
                  {CATALOGO_EXPLOSIVOS_PERU.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.nombre}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 10, color: "var(--texto-tenue)", marginTop: 4 }}>
                  ρ {cfg.explosivo.densidadGcm3} g/cc · VOD {cfg.explosivo.vodMs} m/s · RWS {cfg.explosivo.rwsPeso}
                </div>
              </div>

              <div className="fila-dos">
                <div className="campo">
                  <label>Taco (m)</label>
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    value={cfg.taco_m}
                    onChange={(e) => actualizarRol(rol, { taco_m: Number(e.target.value) })}
                  />
                </div>
                <div className="campo">
                  <label>Llenado (0-1)</label>
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={cfg.llenado}
                    onChange={(e) => actualizarRol(rol, { llenado: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="campo" style={{ marginTop: 8 }}>
                <label>Cebos por taladro</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="btn"
                      data-activo={cfg.cebosPorTaladro === n}
                      onClick={() => actualizarRol(rol, { cebosPorTaladro: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="panel-seccion-card">
        <div className="panel-seccion-header">
          <div className="panel-seccion-title">
            <span>Roca</span>
          </div>
        </div>
        <div className="panel-seccion-body">
          <div className="campo">
            <label>Densidad de roca (t/m³)</label>
            <input
              type="number"
              step={0.01}
              min={0}
              value={densidadRoca_tm3}
              onChange={(e) => onCambiarDensidadRoca(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
