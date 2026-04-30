/**
 * W3C TraceContext helpers for Digital Letters using OpenTelemetry.
 *
 * Uses the OpenTelemetry API only. No SDK is initialised here as the TracerProvider
 * is supplied at runtime by the ADOT Lambda Layer.
 * - traceparent strings are standard W3C format: 00-<trace-id:32hex>-<parent-id:16hex>-<flags:2hex>
 */

import {
  context,
  propagation,
  trace,
  TraceFlags,
  ROOT_CONTEXT,
} from '@opentelemetry/api';

const tracer = trace.getTracer('dl-trace-context');

/** Create a new root W3C traceparent via the OTel tracer */
export function createTraceparent(): string {
  const span = tracer.startSpan('root', undefined, ROOT_CONTEXT);
  const ctx = span.spanContext();
  span.end();
  const traceId = ctx.traceId;
  const spanId = ctx.spanId;
  return `00-${traceId}-${spanId}-01`; // Formats into W3C traceparent string
}

/** Return a child traceparent that shares the incoming trace-id, via OTel context */
export function deriveChildTraceparent(incoming: string): string {
  const carrier: Record<string, string> = { traceparent: incoming };
  const parentCtx = propagation.extract(ROOT_CONTEXT, carrier);
  const span = tracer.startSpan('child', undefined, parentCtx);
  const ctx = span.spanContext();
  span.end();
  const flags = (ctx.traceFlags & TraceFlags.SAMPLED) ? '01' : '00';
  return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
}
