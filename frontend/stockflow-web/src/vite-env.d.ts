/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** 'true' | 'false': fuerza mostrar u ocultar fotos y guías. */
  readonly VITE_ENABLE_FILES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
