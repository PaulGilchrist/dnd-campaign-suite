import { useState, useEffect, useRef } from 'react';

export function useAsyncData(asyncFn, deps = [], initialValue = null) {
  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setLoading(true);
    setError(null);

    Promise.resolve(asyncFn())
      .then(result => {
        if (!cancelledRef.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelledRef.current) {
          setError(err?.message ?? err);
          setLoading(false);
        }
      });

    return () => {
      cancelledRef.current = true;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}
