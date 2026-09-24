import { useCallback, useState } from 'react';
import { getApiErrorMessage } from '../services/apiClient';

interface UseMutationState {
  loading: boolean;
  error: string | null;
}

/**
 * Wraps a one-off async action (create/submit) with loading/error state.
 * `mutate` returns the result on success, or `null` after setting `error`.
 */
export const useMutation = <Input, Output>(action: (input: Input) => Promise<Output>) => {
  const [state, setState] = useState<UseMutationState>({ loading: false, error: null });

  const mutate = useCallback(
    async (input: Input): Promise<Output | null> => {
      setState({ loading: true, error: null });
      try {
        const result = await action(input);
        setState({ loading: false, error: null });
        return result;
      } catch (error) {
        setState({ loading: false, error: getApiErrorMessage(error) });
        return null;
      }
    },
    [action]
  );

  const reset = useCallback(() => setState({ loading: false, error: null }), []);

  return { ...state, mutate, reset };
};
