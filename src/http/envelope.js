/**
 * V3 standard envelope parser (API Contract §1.3).
 * Respons non-envelope (MSW legacy / transitional) dilewati apa adanya.
 */

function looksLikeV3Envelope(body) {
  return (
    body != null &&
    typeof body === "object" &&
    Object.prototype.hasOwnProperty.call(body, "data") &&
    Object.prototype.hasOwnProperty.call(body, "meta") &&
    Object.prototype.hasOwnProperty.call(body, "error")
  );
}

/**
 * @param {*} body — axios response.data
 * @returns {*} inner data payload atau body asli
 */
export function unwrapEnvelope(body) {
  if (!looksLikeV3Envelope(body)) return body;
  if (body.error) {
    const e = new Error(body.error.message || "API error");
    e.code = body.error.code;
    e.details = body.error.details;
    e.isApiEnvelopeError = true;
    throw e;
  }
  return body.data;
}
