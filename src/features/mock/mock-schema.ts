import type { DbObjectItem, TableDataset } from '@/app/session/types';

const vehiclesRows = Array.from({ length: 220 }, (_, idx) => {
  const year = 1990 + (idx % 32);
  const brands = [
    'Acura',
    'Toyota',
    'Honda',
    'Ford',
    'Chevrolet',
    'Volkswagen',
  ];
  const models = [
    'Integra GS 1.8',
    'Legend 3.2/3.5',
    'Corolla XEI',
    'Civic EX',
    'Focus 2.0',
    'Gol 1.6',
  ];

  return {
    id: idx + 1,
    type: 'Carro',
    brand: brands[idx % brands.length],
    model: models[idx % models.length],
    modelYear: year,
    fuelAcronym: idx % 3 === 0 ? 'D' : 'G',
    price: Number((12000 + idx * 158.37).toFixed(2)),
    referenceMonth: 'marco',
    referenceYear: 2026,
    fipeCode: `03${(8000 + idx).toString().padStart(4, '0')}-${(idx % 9) + 1}`,
  };
});

export const mockObjects: DbObjectItem[] = [
  { name: 'sqlite_sequence', type: 'table', estimatedRows: 2 },
  { name: 'vehicles', type: 'table', estimatedRows: vehiclesRows.length },
  {
    name: 'vehicle_prices_view',
    type: 'view',
    estimatedRows: vehiclesRows.length,
  },
];

export const mockTables: TableDataset = {
  vehicles: {
    columns: [
      'id',
      'type',
      'brand',
      'model',
      'modelYear',
      'fuelAcronym',
      'price',
      'referenceMonth',
      'referenceYear',
      'fipeCode',
    ],
    rows: vehiclesRows,
  },
  sqlite_sequence: {
    columns: ['name', 'seq'],
    rows: [
      { name: 'vehicles', seq: vehiclesRows.length },
      { name: 'audit_log', seq: 15 },
    ],
  },
  vehicle_prices_view: {
    columns: ['brand', 'model', 'modelYear', 'price'],
    rows: vehiclesRows.slice(0, 100).map(row => ({
      brand: row.brand,
      model: row.model,
      modelYear: row.modelYear,
      price: row.price,
    })),
  },
};

export const defaultSql =
  'SELECT * FROM "vehicles" ORDER BY "id" LIMIT 300 OFFSET 0;';
