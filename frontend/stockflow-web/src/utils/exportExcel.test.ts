import type dxDataGrid from 'devextreme/ui/data_grid'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  exportDataGrid: vi.fn(),
  saveAs: vi.fn(),
  addWorksheet: vi.fn(),
  writeBuffer: vi.fn(),
}))

vi.mock('devextreme/excel_exporter', () => ({ exportDataGrid: mocks.exportDataGrid }))
vi.mock('file-saver', () => ({ saveAs: mocks.saveAs }))
vi.mock('exceljs', () => ({
  Workbook: class {
    addWorksheet = mocks.addWorksheet
    xlsx = { writeBuffer: mocks.writeBuffer }
  },
}))

import { exportGridToExcel } from './exportExcel.ts'

describe('exportGridToExcel', () => {
  beforeEach(() => {
    mocks.addWorksheet.mockReturnValue({ name: 'hoja' })
    mocks.exportDataGrid.mockResolvedValue(undefined)
    mocks.writeBuffer.mockResolvedValue(new ArrayBuffer(8))
  })

  it('exporta la grilla a una hoja y descarga el archivo', async () => {
    const component = { name: 'grid' }
    await exportGridToExcel(component as unknown as dxDataGrid, 'Productos', 'productos.xlsx')

    expect(mocks.addWorksheet).toHaveBeenCalledWith('Productos')
    expect(mocks.exportDataGrid).toHaveBeenCalledWith({
      component,
      worksheet: { name: 'hoja' },
      autoFilterEnabled: true,
    })
    expect(mocks.saveAs).toHaveBeenCalledOnce()
    const [blob, fileName] = mocks.saveAs.mock.calls[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(fileName).toBe('productos.xlsx')
  })
})
