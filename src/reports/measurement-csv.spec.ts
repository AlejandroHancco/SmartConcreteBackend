import { buildCsv, csvPreamble, rowsToCsvLines, CSV_HEADER, measurementToRows, CsvMeasurement } from './measurement-csv';

const channel = (n: number, alias = `Canal ${n}`) => ({
  channelNumber: n, channelAlias: alias, concreteMix: 0.45, hasEmulsifier: false,
  sampleAge: 7, temperature: 22.5, humidity: 60, notes: 'ok',
});

const base: CsvMeasurement = {
  id: 32,
  takenAt: new Date('2026-10-12T14:03:00Z'),
  takenByName: 'Alejandro Hancco',
  presetName: 'Default',
  watcherStatus: 'correct',
  data: [
    { frequency: 1000, g: [0.1, 0.2, 0, 0], b: [0.01, 0.02, 0, 0] },
    { frequency: 2000, g: [0.3, 0.4, 0, 0], b: [0.03, 0.04, 0, 0] },
  ],
  channels: [channel(2), channel(1)],
};

describe('measurementToRows', () => {
  it('una fila por (frecuencia, canal medido), canales ordenados', () => {
    const rows = measurementToRows(base);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual([
      32, '2026-10-12T14:03:00.000Z', 'Alejandro Hancco', 'Default', 'correct',
      1000, 1, 'Canal 1', 0.1, 0.01, 0.45, false, 7, 22.5, 60, 'ok',
    ]);
    expect(rows[1][6]).toBe(2);
    expect(rows[1][8]).toBe(0.2);
    expect(rows[2][5]).toBe(2000);
  });

  it('cada fila tiene tantas columnas como el encabezado', () => {
    for (const row of measurementToRows(base)) expect(row).toHaveLength(CSV_HEADER.length);
  });

  it('sin filas si data está vacío o no es array', () => {
    expect(measurementToRows({ ...base, data: [] })).toEqual([]);
    expect(measurementToRows({ ...base, data: null })).toEqual([]);
  });
});

describe('buildCsv', () => {
  it('BOM, metadatos con #, encabezado y filas con CRLF', () => {
    const csv = buildCsv(['Kronos | Tarea: Viga A'], [base]);
    expect(csv.startsWith('﻿# Kronos | Tarea: Viga A\r\n')).toBe(true);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[1]).toBe(CSV_HEADER.join(','));
    expect(lines).toHaveLength(2 + 4);
  });

  it('protege nombres que parecen fórmulas', () => {
    const csv = buildCsv([], [{ ...base, presetName: '=HACK()' }]);
    expect(csv).toContain(",'=HACK(),");
  });

  it('cita una nota de canal que contiene comas', () => {
    const withComma: CsvMeasurement = {
      ...base,
      channels: [{ ...channel(1), notes: 'ok, revisar' }],
      data: [{ frequency: 1000, g: [0.1], b: [0.01] }],
    };
    const csv = buildCsv([], [withComma]);
    expect(csv).toContain('"ok, revisar"');
  });

  it('protege metadatos con nombres de tarea/proyecto maliciosos (CSV injection)', () => {
    // Un nombre de tarea con coma + fórmula no debe "partirse" en columnas evaluables por Excel.
    const maliciousLine = 'Kronos | Tarea: Viga,=HYPERLINK("http://evil","x")';
    const csv = buildCsv([maliciousLine], [base]);
    const firstLine = csv.replace('﻿', '').split('\r\n')[0];
    // Una sola celda citada: sin comas "sueltas" fuera de las comillas.
    expect(firstLine.startsWith('"#')).toBe(true);
    expect(firstLine.endsWith('"')).toBe(true);
    expect(firstLine).toContain('""http://evil""');
  });
});

describe('csvPreamble / rowsToCsvLines', () => {
  it('csvPreamble: BOM, metadatos citados y encabezado', () => {
    const preamble = csvPreamble(['Kronos | Tarea: Viga A']);
    expect(preamble).toBe('﻿# Kronos | Tarea: Viga A\r\n' + CSV_HEADER.join(','));
  });

  it('csvPreamble cita metadatos con coma y fórmula como una sola celda', () => {
    const preamble = csvPreamble(['Tarea: Viga,=HACK()']);
    const [firstLine] = preamble.replace('﻿', '').split('\r\n');
    expect(firstLine.startsWith('"#')).toBe(true);
    expect(firstLine.endsWith('"')).toBe(true);
  });

  it('rowsToCsvLines: una línea por fila, igual que buildCsv sin preámbulo', () => {
    const lines = rowsToCsvLines(base);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(
      '32,2026-10-12T14:03:00.000Z,Alejandro Hancco,Default,correct,1000,1,Canal 1,0.1,0.01,0.45,false,7,22.5,60,ok',
    );
  });

  it('rowsToCsvLines vacío cuando no hay data', () => {
    expect(rowsToCsvLines({ ...base, data: [] })).toEqual([]);
  });
});
