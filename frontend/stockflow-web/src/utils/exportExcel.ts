import { exportDataGrid } from 'devextreme/excel_exporter'
import type dxDataGrid from 'devextreme/ui/data_grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'

/** Descarga la grilla (con sus filtros y orden actuales) como .xlsx. */
export function exportGridToExcel(component: dxDataGrid, sheetName: string, fileName: string) {
  const workbook = new Workbook()
  const worksheet = workbook.addWorksheet(sheetName)
  return exportDataGrid({ component, worksheet, autoFilterEnabled: true }).then(() =>
    workbook.xlsx.writeBuffer().then((buffer) => {
      saveAs(new Blob([buffer], { type: 'application/octet-stream' }), fileName)
    }),
  )
}
