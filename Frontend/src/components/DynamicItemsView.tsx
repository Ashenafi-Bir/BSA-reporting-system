import React, { useMemo } from 'react';

export interface DynamicItem {
  Code: string;
  Value: string;
  _description?: string;
  _dataType?: string;
  _required?: boolean;
}

export interface DynamicArea {
  Area: number;
  _areaName: string | null;
  DynamicItems: DynamicItem[];
}

interface NormalizedArea {
  area: number;
  areaName: string;
  columns: { code: string; description: string }[];
  rows: Record<string, string>[];
  totalItems: number;
}

/**
 * Normalize a DynamicItemsList into per-area tables.
 * Handles:
 *  - Multiple entries with the same Area (each entry = one row)
 *  - Codes repeated within a single area (split into rows)
 *  - Single row per area
 */
export const normalizeDynamicAreas = (
  items: DynamicArea[] | undefined,
  dictionary?: DynamicArea[] | undefined
): NormalizedArea[] => {
  if (!items || items.length === 0) return [];

  // Build a lookup: area → code → description  (from dictionary schema)
  const dictDescMap: Record<string, Record<string, string>> = {};
  if (dictionary) {
    dictionary.forEach(area => {
      const key = String(area.Area);
      dictDescMap[key] = dictDescMap[key] || {};
      area.DynamicItems?.forEach(di => {
        if (di._description) dictDescMap[key][di.Code] = di._description;
      });
    });
  }

  // Group payload entries by Area
  const grouped: Record<string, DynamicArea[]> = {};
  items.forEach(entry => {
    const key = String(entry.Area);
    (grouped[key] = grouped[key] || []).push(entry);
  });

  const result: NormalizedArea[] = [];

  Object.entries(grouped).forEach(([areaKey, entries]) => {
    const dictArea = dictionary?.find(a => String(a.Area) === areaKey);

    // ---- Build columns (order from dictionary schema, then any extras) ----
    const seenCodes = new Set<string>();
    const columns: { code: string; description: string }[] = [];

    if (dictArea?.DynamicItems?.length) {
      dictArea.DynamicItems.forEach(item => {
        if (!seenCodes.has(item.Code)) {
          seenCodes.add(item.Code);
          columns.push({
            code: item.Code,
            description:
              dictDescMap[areaKey]?.[item.Code] ||
              item._description ||
              item.Code,
          });
        }
      });
    }
    entries.forEach(entry => {
      entry.DynamicItems?.forEach(item => {
        if (!seenCodes.has(item.Code)) {
          seenCodes.add(item.Code);
          columns.push({
            code: item.Code,
            description:
              dictDescMap[areaKey]?.[item.Code] ||
              item._description ||
              item.Code,
          });
        }
      });
    });

    // ---- Flatten all items ----
    const allItems: DynamicItem[] = [];
    entries.forEach(entry => {
      entry.DynamicItems?.forEach(item => allItems.push(item));
    });

    // ---- Detect row structure ----
    const codeCounts: Record<string, number> = {};
    allItems.forEach(item => {
      codeCounts[item.Code] = (codeCounts[item.Code] || 0) + 1;
    });
    const maxRepeats = Math.max(0, ...Object.values(codeCounts));

    const rows: Record<string, string>[] = [];

    if (entries.length > 1) {
      // Each entry = one row
      entries.forEach(entry => {
        const row: Record<string, string> = {};
        entry.DynamicItems?.forEach(item => {
          row[item.Code] = String(item.Value ?? '');
        });
        rows.push(row);
      });
    } else if (maxRepeats > 1) {
      // Codes repeated inside a single entry → split into rows
      let currentRow: Record<string, string> = {};
      const seenInRow = new Set<string>();
      allItems.forEach(item => {
        if (seenInRow.has(item.Code)) {
          rows.push(currentRow);
          currentRow = {};
          seenInRow.clear();
        }
        currentRow[item.Code] = String(item.Value ?? '');
        seenInRow.add(item.Code);
      });
      if (Object.keys(currentRow).length > 0) rows.push(currentRow);
    } else {
      // Single row
      const row: Record<string, string> = {};
      allItems.forEach(item => {
        row[item.Code] = String(item.Value ?? '');
      });
      if (Object.keys(row).length > 0) rows.push(row);
    }

    result.push({
      area: Number(areaKey),
      areaName:
        entries[0]._areaName ||
        dictArea?._areaName ||
        `Area ${areaKey}`,
      columns,
      rows,
      totalItems: allItems.length,
    });
  });

  return result.sort((a, b) => a.area - b.area);
};

interface Props {
  items: DynamicArea[] | undefined;
  dictionary?: DynamicArea[] | undefined;
  showZeroValues?: boolean;
}

const isRowEmpty = (row: Record<string, string>) =>
  Object.values(row).every(v => v === '' || v === '0' || v === '0.00');

const DynamicItemsView: React.FC<Props> = ({
  items,
  dictionary,
  showZeroValues = true,
}) => {
  const areas = useMemo(
    () => normalizeDynamicAreas(items, dictionary),
    [items, dictionary]
  );

  const filteredAreas = useMemo(() => {
    if (showZeroValues) return areas;
    return areas
      .map(a => ({ ...a, rows: a.rows.filter(r => !isRowEmpty(r)) }))
      .filter(a => a.rows.length > 0);
  }, [areas, showZeroValues]);

  if (filteredAreas.length === 0) return null;

  return (
    <div className="dynamic-areas">
      {filteredAreas.map(area => (
        <div key={area.area} className="dynamic-area">
          <div className="dynamic-area-header">
            <div className="dynamic-area-title">
              <span className="dynamic-area-badge">{area.area}</span>
              <h4>{area.areaName}</h4>
            </div>
            <div className="dynamic-area-meta">
              <span>
                {area.rows.length} row{area.rows.length !== 1 ? 's' : ''}
              </span>
              <span className="dot">·</span>
              <span>
                {area.columns.length} column{area.columns.length !== 1 ? 's' : ''}
              </span>
              <span className="dot">·</span>
              <span>
                {area.totalItems} field{area.totalItems !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="dynamic-table">
              <thead>
                <tr>
                  <th className="row-number-col">#</th>
                  {area.columns.map(col => (
                    <th key={col.code}>
                      <div className="col-code">{col.code}</div>
                      <div className="col-desc">{col.description}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {area.rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="row-number-col">{idx + 1}</td>
                    {area.columns.map(col => {
                      const val = row[col.code];
                      const isEmpty = val === undefined || val === '';
                      return (
                        <td
                          key={col.code}
                          className={isEmpty ? 'empty-value' : 'value'}
                        >
                          {isEmpty ? '—' : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DynamicItemsView;