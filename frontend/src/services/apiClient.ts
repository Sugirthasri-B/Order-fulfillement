import axios, { AxiosError } from 'axios';
import { ApiErrorBody } from '../types/api';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Extracts a human-readable message from any error the API client can
 * throw (a backend error body, a network failure, or anything else),
 * so every page can show one consistent error string.
 */
export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>;

    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }

    if (axiosError.response) {
      return `Request failed with status ${axiosError.response.status}`;
    }

    return 'Unable to reach the server. Check your connection and try again.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
};
