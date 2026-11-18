// Exportação de relatórios para planilha (.xlsx) no navegador.
export async function exportXlsx(
  fileName: string,
  sheets: { name: string; rows: Record<string, unknown>[] }[],
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    const headers = Object.keys(s.rows[0] ?? { "Sem dados": "" });
    ws.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: Math.max(12, Math.min(40, h.length + 4)),
    }));
    ws.getRow(1).font = { bold: true };
    s.rows.forEach((r) => ws.addRow(r));
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
