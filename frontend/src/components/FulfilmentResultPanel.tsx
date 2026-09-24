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
      <span className="result-panel__label">Backorder Quantity</span>
      <span className="result-panel__value">{result.backorderQuantity.toLocaleString()}</span>
    </div>
    <div className="result-panel__row">
      <span className="result-panel__label">Allocation</span>
      <span className="result-panel__value">
        {result.allocation
          ? `${result.allocation.warehouseId} — ${result.allocation.allocatedQuantity.toLocaleString()} units`
          : '—'}
      </span>
    </div>
  </div>
);
