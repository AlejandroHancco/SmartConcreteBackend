import { toCsvCell, toCsvRow } from './csv.util';

describe('toCsvCell', () => {
  it('deja números tal cual, incluidos negativos', () => {
    expect(toCsvCell(0.00123)).toBe('0.00123');
    expect(toCsvCell(-5)).toBe('-5');
  });

  it('vacío para null, undefined y números no finitos', () => {
    expect(toCsvCell(null)).toBe('');
    expect(toCsvCell(undefined)).toBe('');
    expect(toCsvCell(NaN)).toBe('');
  });

  it('booleanos y fechas', () => {
    expect(toCsvCell(true)).toBe('true');
    expect(toCsvCell(new Date('2026-10-12T14:03:00Z'))).toBe('2026-10-12T14:03:00.000Z');
  });

  it('protege texto que empieza como fórmula', () => {
    expect(toCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(toCsvCell('+1')).toBe("'+1");
    expect(toCsvCell('-x')).toBe("'-x");
    expect(toCsvCell('@cmd')).toBe("'@cmd");
    expect(toCsvCell('\tx')).toBe("'\tx");
  });

  it('entrecomilla comas, comillas y saltos de línea', () => {
    expect(toCsvCell('a,b')).toBe('"a,b"');
    expect(toCsvCell('di "hola"')).toBe('"di ""hola"""');
    expect(toCsvCell('l1\nl2')).toBe('"l1\nl2"');
  });

  it('protege y entrecomilla a la vez', () => {
    expect(toCsvCell('=1,2')).toBe(`"'=1,2"`);
  });
});

describe('toCsvRow', () => {
  it('une celdas con coma', () => {
    expect(toCsvRow([1, 'a,b', null, 'ok'])).toBe('1,"a,b",,ok');
  });
});
