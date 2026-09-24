import { FulfilmentResult } from '../types/order';
import { StatusBadge } from './StatusBadge';

export interface FulfilmentResultPanelProps {
  result: FulfilmentResult;
}

export const FulfilmentResultPanel = ({ result }: FulfilmentResultPanelProps) => (
  <div className="result-panel">
    <div className="result-panel__row">
      <span className="result-panel__label">Order ID</span>
      <span className="result-panel__value">{result.orderId}</span>
    </div>
    <div className="result-panel__row">
      <span className="result-panel__label">Status</span>
      <span className="result-panel__value">
        <StatusBadge status={result.status} />
      </span>
    </div>
    <div className="result-panel__row">
      <span className="result-panel__label">Reason</span>
      <span className="result-panel__value">{result.reason ?? '—'}</span>
    </div>
    <div className="result-panel__row">
      <span className="result-panel__label">Released Quantity</span>
      <span className="result-panel__value">{result.releasedQuantity.toLocaleString()}</span>
    </div>
    <div className="result-panel__row">
      <span className="result-panel__label">Backordered Quantity</span>
      <span className="result-panel__value">{result.backorderedQuantity.toLocaleString()}</span>
    </div>
    <div className="result-panel__row">
      <span className="result-panel__label">Allocation{result.allocations && result.allocations.length > 1 ? 's' : ''}</span>
      <span className="result-panel__value">
        {result.allocations && result.allocations.length > 0
          ? result.allocations
              .map((a) => `${a.warehouseId} — ${a.allocatedQuantity.toLocaleString()} units`)
              .join(', ')
          : '—'}
      </span>
    </div>
  </div>
);
