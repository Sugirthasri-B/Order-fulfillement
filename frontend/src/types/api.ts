export interface ApiEnvelope<T> {
  status: 'ok';
  data: T;
}

export interface ApiErrorBody {
  status?: 'error';
  message: string;
}
