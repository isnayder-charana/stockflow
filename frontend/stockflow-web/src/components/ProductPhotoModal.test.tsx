import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { productsApi } from '../api/client.ts'
import { makeProduct } from '../test/fixtures.ts'
import ProductPhotoModal from './ProductPhotoModal.tsx'

const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!

describe('ProductPhotoModal', () => {
  it('sin permiso de edición solo muestra la foto', () => {
    render(<ProductPhotoModal product={makeProduct()} canEdit={false} onClose={() => {}} />)

    expect(screen.getByText('Este producto no tiene foto.')).toBeInTheDocument()
    expect(screen.queryByText('Subir foto')).not.toBeInTheDocument()
  })

  it('sube una foto y avisa con el producto actualizado', async () => {
    const user = userEvent.setup()
    const product = makeProduct()
    const updated = { ...product, photoUrl: 'https://cdn.test/casco.png' }
    const uploadSpy = vi.spyOn(productsApi, 'uploadPhoto').mockResolvedValue(updated)
    const onChanged = vi.fn()
    render(<ProductPhotoModal product={product} canEdit onClose={() => {}} onChanged={onChanged} />)

    const file = new File(['png'], 'casco.png', { type: 'image/png' })
    await user.upload(fileInput(), file)

    expect(uploadSpy).toHaveBeenCalledWith(product.id, file)
    expect(onChanged).toHaveBeenCalledWith(updated)
    expect(await screen.findByRole('img', { name: product.name })).toHaveAttribute('src', 'https://cdn.test/casco.png')
  })

  it('rechaza fotos de más de 4 MB sin llamar a la API', async () => {
    const user = userEvent.setup()
    const uploadSpy = vi.spyOn(productsApi, 'uploadPhoto')
    render(<ProductPhotoModal product={makeProduct()} canEdit onClose={() => {}} />)

    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' })
    await user.upload(fileInput(), big)

    expect(screen.getByText('La foto supera los 4 MB.')).toBeInTheDocument()
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('quita la foto', async () => {
    const user = userEvent.setup()
    const product = makeProduct({ photoUrl: 'https://cdn.test/casco.png' })
    vi.spyOn(productsApi, 'removePhoto').mockResolvedValue(undefined)
    const onChanged = vi.fn()
    render(<ProductPhotoModal product={product} canEdit onClose={() => {}} onChanged={onChanged} />)

    await user.click(screen.getByRole('button', { name: 'Quitar foto' }))

    expect(productsApi.removePhoto).toHaveBeenCalledWith(product.id)
    expect(onChanged).toHaveBeenCalledWith({ ...product, photoUrl: null })
    expect(await screen.findByText('Este producto no tiene foto.')).toBeInTheDocument()
  })

  it('se cierra con la X', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ProductPhotoModal product={makeProduct()} canEdit={false} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(onClose).toHaveBeenCalled()
  })
})
