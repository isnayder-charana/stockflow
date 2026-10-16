import { exportDataGrid } from 'devextreme/excel_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'

/** Handler de onExporting para DataGrid: descarga la grilla (con sus filtros) como .xlsx. */
export function excelExporter(sheetName, fileName) {
  return (e) => {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet(sheetName)
    exportDataGrid({ component: e.component, worksheet, autoFilterEnabled: true }).then(() =>
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), fileName)
      }),
    )
  }
}
