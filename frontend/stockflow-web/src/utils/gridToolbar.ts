/** Botón "Filtros" de la barra de la grilla: muestra u oculta la fila de filtros por columna. */
export function filterButtonOptions(visible: boolean, toggle: () => void) {
  return {
    icon: 'filter',
    text: visible ? 'Ocultar filtros' : 'Filtros',
    stylingMode: visible ? 'contained' : 'outlined',
    onClick: toggle,
  }
}
