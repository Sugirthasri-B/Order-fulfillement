import { ReactNode } from 'react';
import { classNames } from '../utils/format';

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
}

/**
 * A plain data table. Loading/empty/error states are the caller's
 * responsibility (via Loading/EmptyState/ErrorMessage) so this component
 * only ever renders when there are rows to show.
 */
export const Table = <T,>({ columns, rows, keyExtractor, onRowClick }: TableProps<T>) => (
  <div className="table-wrapper">
    <table className={classNames('data-table', onRowClick && 'data-table--clickable')}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} style={{ textAlign: column.align ?? 'left' }}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={keyExtractor(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            role={onRowClick ? 'button' : undefined}
            onKeyDown={
              onRowClick
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
          >
            {columns.map((column) => (
              <td key={column.key} style={{ textAlign: column.align ?? 'left' }}>
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
