/**
 * Axios helpers — selalu unwrap envelope V3 ketika ada.
 */
import { apiClient } from "../api/client";
import { unwrapEnvelope } from "./envelope";

async function wrap(promise) {
  const res = await promise;
  return unwrapEnvelope(res.data);
}

export const v3 = {
  get: (path, config) => wrap(apiClient.get(path, config)),
  delete: (path, config) => wrap(apiClient.delete(path, config)),
  post: (path, body, config) => wrap(apiClient.post(path, body, config)),
  put: (path, body, config) => wrap(apiClient.put(path, body, config)),
  patch: (path, body, config) => wrap(apiClient.patch(path, body, config)),
};
