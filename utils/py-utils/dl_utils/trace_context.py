"""W3C TraceContext helpers for Digital Letters using OpenTelemetry.

Uses the OpenTelemetry API only. No SDK is initialised here as the TracerProvider
is supplied at runtime by the ADOT Lambda Layer.
- traceparent strings are standard W3C format: 00-<trace-id:32hex>-<parent-id:16hex>-<flags:2hex>
"""

from opentelemetry import trace
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

_propagator = TraceContextTextMapPropagator()
_tracer = trace.get_tracer(__name__)


def create_traceparent() -> str:
    """Create a new root W3C traceparent via the OTel tracer."""
    span = _tracer.start_span("root")
    ctx = span.get_span_context()
    span.end()
    trace_id = format(ctx.trace_id, '032x')
    span_id = format(ctx.span_id, '016x')
    return f'00-{trace_id}-{span_id}-01'


def derive_child_traceparent(incoming: str) -> str:
    """Return a child traceparent that shares the incoming trace-id, via OTel context."""
    carrier = {'traceparent': incoming}
    parent_ctx = _propagator.extract(carrier=carrier)
    span = _tracer.start_span("child", context=parent_ctx)
    ctx = span.get_span_context()
    span.end()
    trace_id = format(ctx.trace_id, '032x')
    span_id = format(ctx.span_id, '016x')
    flags = format(ctx.trace_flags, '02x')
    return f'00-{trace_id}-{span_id}-{flags}'
