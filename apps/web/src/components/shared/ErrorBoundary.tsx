import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { PREFIJO_ALMACENAMIENTO } from "../../hooks/usePersistedState.js";

interface Props {
  children: ReactNode;
  fallbackTitulo?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary detectó un error no controlado:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReiniciar = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  private handleLimpiarDatosLocales = () => {
    try {
      // Limpiar claves que pudieran estar corruptas
      const prefijo = PREFIJO_ALMACENAMIENTO;
      const clavesAEliminar: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefijo)) {
          clavesAEliminar.push(key);
        }
      }
      clavesAEliminar.forEach((k) => localStorage.removeItem(k));
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0d1117",
            color: "#f8fafc",
            padding: "20px",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              background: "rgba(18, 24, 38, 0.95)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              borderRadius: "20px",
              padding: "28px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(239, 68, 68, 0.15)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2 style={{ fontSize: "19px", fontWeight: 800, margin: "0 0 8px 0", color: "#f8fafc" }}>
              {this.props.fallbackTitulo || "Ocurrió un problema al renderizar el módulo"}
            </h2>

            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 20px 0", lineHeight: "1.5" }}>
              Se ha evitado un bloqueo completo de la aplicación. Puedes reiniciar este espacio o restaurar los datos iniciales de fábrica para continuar operando.
            </p>

            {this.state.error && (
              <details
                style={{
                  background: "rgba(6, 10, 16, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  textAlign: "left",
                  fontSize: "11px",
                  color: "#f87171",
                  fontFamily: "ui-monospace, monospace",
                  marginBottom: "20px",
                  overflowX: "auto",
                }}
              >
                <summary style={{ cursor: "pointer", color: "#94a3b8", outline: "none", fontWeight: 600 }}>
                  Detalles técnicos del error
                </summary>
                <div style={{ marginTop: "8px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {this.state.error.message}
                </div>
              </details>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                onClick={this.handleReiniciar}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                }}
              >
                Reiniciar Módulo
              </button>

              <button
                type="button"
                onClick={this.handleLimpiarDatosLocales}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "#cbd5e1",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Restaurar Datos Iniciales Limpios
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
