/**
 * SR MVP — useSafeRequest Hook
 * src/hooks/useSafeRequest.js
 *
 * Reusable hook untuk fetch dengan lifecycle safety:
 *  - AbortController per request
 *  - isMounted guard
 *  - Race condition protection via requestId
 *  - Automatic cleanup on unmount
 *
 * USAGE:
 *   const { data, isLoading, error, refetch } = useSafeRequest(
 *     (signal) => getLeaderboard({ kelas_id, mode, signal }),
 *     [kelas_id, mode] // dependencies
 *   );
 */
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} fetcher
 * @param {readonly any[]} deps
 * @param {{ initialData?: T, skip?: boolean }} options
 * @returns {{ data: T|null, isLoading: boolean, error: Error|null, refetch: () => void }}
 */
export function useSafeRequest(fetcher, deps = [], { initialData = null, skip = false } = {}) {
    const [data, setData] = useState(initialData);
    const [isLoading, setIsLoading] = useState(!skip);
    const [error, setError] = useState(null);

    const isMountedRef = useRef(true);
    const abortControllerRef = useRef(null);
    const requestIdRef = useRef(0);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const execute = useCallback(async () => {
        if (skip) {
            setIsLoading(false);
            return;
        }

        // Batalkan request sebelumnya
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Race condition guard: setiap request dapat ID unik
        requestIdRef.current += 1;
        const currentRequestId = requestIdRef.current;

        if (isMountedRef.current) {
            setIsLoading(true);
            setError(null);
        }

        try {
            const result = await fetcher(controller.signal);

            // Guard: hanya apply state jika ini masih request terbaru dan component mounted
            if (!isMountedRef.current || currentRequestId !== requestIdRef.current) return;

            setData(result);
        } catch (err) {
            if (!isMountedRef.current || currentRequestId !== requestIdRef.current) return;

            const isAbort = err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED';
            if (isAbort) return; // bukan error UI

            setError(err);
        } finally {
            if (isMountedRef.current && currentRequestId === requestIdRef.current) {
                setIsLoading(false);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [skip, fetcher]);

    useEffect(() => {
        execute();
        return () => {
            // Cleanup: batalkan request saat deps berubah atau unmount
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [execute]);

    const refetch = useCallback(() => execute(), [execute]);

    return { data, isLoading, error, refetch };
}

/**
 * Simplified version menggunakan useSafeRequest dengan useCallback di luar
 * untuk kasus di mana fetcher berubah tiap render (biasanya karena parameter).
 *
 * USAGE:
 *   const { data, isLoading, error, refetch } = useFetch(
 *     '/leaderboard',
 *     { kelas_id, mode },
 *     [kelas_id, mode]
 *   );
 */
export function useFetch(fetchFn, params, deps = []) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stableFetcher = useCallback((signal) => fetchFn({ ...params, signal }), deps);
    return useSafeRequest(stableFetcher, deps);
}