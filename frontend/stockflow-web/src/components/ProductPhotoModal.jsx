import { useState } from 'react'
import { MAX_FILE_BYTES, fileUrl, productsApi } from '../api/client.js'

const accepted = 'image/jpeg,image/png,image/webp'

/** Ventana para ver, subir o quitar la foto de un producto. `onChanged` recibe el producto actualizado. */
export default function ProductPhotoModal({ product, canEdit, onClose, onChanged }) {
  const [photoUrl, setPhotoUrl] = useState(product.photoUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setError('La foto supera los 4 MB.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const updated = await productsApi.uploadPhoto(product.id, file)
      setPhotoUrl(updated.photoUrl)
      onChanged?.(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    setError('')
    try {
      await productsApi.removePhoto(product.id)
      setPhotoUrl(null)
      onChanged?.({ ...product, photoUrl: null })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5">
                {product.sku} · {product.name}
              </h2>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} />
            </div>
            <div className="modal-body text-center">
              {error && <div className="alert alert-danger py-2 text-start">{error}</div>}
              {photoUrl ? (
                <img src={fileUrl(photoUrl)} alt={product.name} className="img-fluid rounded product-photo-large" />
              ) : (
                <div className="text-muted py-5">Este producto no tiene foto.</div>
              )}
            </div>
            {canEdit && (
              <div className="modal-footer">
                <small className="text-muted me-auto">JPG, PNG o WebP, hasta 4 MB</small>
                {photoUrl && (
                  <button className="btn btn-outline-danger" onClick={handleRemove} disabled={busy}>
                    Quitar foto
                  </button>
                )}
                <label className={`btn btn-primary mb-0 ${busy ? 'disabled' : ''}`}>
                  {busy ? 'Subiendo…' : photoUrl ? 'Cambiar foto' : 'Subir foto'}
                  <input type="file" accept={accepted} hidden onChange={handleFile} disabled={busy} />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  )
}
