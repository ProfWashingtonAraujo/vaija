/** Planilha no formato que o Excel em português abre direto: separador ";", vírgula decimal e BOM para os acentos. */
export const csvNumber = (value: number) => value.toFixed(2).replace('.', ',')

export const csvText = (value: string) => `"${value.replace(/"/g, '""')}"`

/** Uma linha da planilha a partir de células já formatadas com csvText/csvNumber (ou números inteiros em texto). */
export const csvRow = (cells: string[]) => cells.join(';')

export function downloadCsv(filename: string, lines: string[]) {
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
