import { exportDataGrid } from 'devextreme/excel_exporter'
import type { ExportingEvent } from 'devextreme/ui/data_grid'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'

/** Handler de onExporting para DataGrid: descarga la grilla (con sus filtros) como .xlsx. */
export function excelExporter(sheetName: string, fileName: string) {
  return (e: ExportingEvent) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet(sheetName)
    exportDataGrid({ component: e.component, worksheet, autoFilterEnabled: true }).then(() =>
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), fileName)
      }),
    )
  }
}
