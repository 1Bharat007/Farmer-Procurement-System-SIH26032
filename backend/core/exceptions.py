"""
Custom DRF Global Exception Handler for KisanSlot Platform.
Smart India Hackathon 2026 - Problem Statement 26032

Catches all DRF exceptions (validation errors, auth, permission, throttles)
as well as unexpected internal exceptions (which DRF leaves as None),
ensuring the API returns clean, structured JSON responses without exposing raw 500 stack traces.
"""

import logging
from django.conf import settings
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger('backend.exceptions')


def _format_error_detail(detail):
    """
    Recursively extract human-readable error messages from DRF error detail structures.
    """
    if isinstance(detail, list):
        if len(detail) == 1:
            return _format_error_detail(detail[0])
        return [_format_error_detail(item) for item in detail]
    if isinstance(detail, dict):
        formatted = {}
        for key, value in detail.items():
            formatted[key] = _format_error_detail(value)
        return formatted
    return str(detail)


def _get_primary_error_message(detail):
    """
    Derives a single primary user-facing error message from error details.
    """
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list) and detail:
        first = detail[0]
        return _get_primary_error_message(first)
    if isinstance(detail, dict) and detail:
        # Check priority keys
        for key in ['error', 'message', 'detail', 'non_field_errors']:
            if key in detail:
                return _get_primary_error_message(detail[key])
        first_key = next(iter(detail))
        val = detail[first_key]
        msg = _get_primary_error_message(val)
        return f"{first_key.replace('_', ' ').capitalize()}: {msg}"
    return "An error occurred while processing your request."


def custom_exception_handler(exc, context):
    """
    Global exception handler for all DRF views.
    Guarantees that no unhandled exception leaks a raw 500 HTML/text trace.
    """
    # Call REST framework's default exception handler first to get standard response
    response = exception_handler(exc, context)

    view_name = "unknown_view"
    request_path = "unknown_path"
    method = "UNKNOWN"
    if context and 'view' in context:
        view_name = context['view'].__class__.__name__
    if context and 'request' in context:
        request_path = getattr(context['request'], 'path', '')
        method = getattr(context['request'], 'method', '')

    if response is not None:
        # Standard DRF handled exception (Validation, Auth, Throttling, NotFound, etc.)
        formatted_detail = _format_error_detail(response.data)
        primary_msg = _get_primary_error_message(response.data)

        # Standardize error envelope
        envelope = {
            "status": "error",
            "status_code": response.status_code,
            "error": primary_msg,
            "detail": formatted_detail,
        }

        # Keep top-level keys for backward compatibility with frontend
        if isinstance(response.data, dict):
            for k, v in response.data.items():
                if k not in envelope:
                    envelope[k] = v

        if response.status_code >= 400 and response.status_code < 500:
            logger.warning(
                f"[API 4xx] {method} {request_path} in {view_name} -> {response.status_code}: {primary_msg}"
            )
        else:
            logger.error(
                f"[API 5xx handled] {method} {request_path} in {view_name} -> {response.status_code}: {primary_msg}"
            )

        response.data = envelope
        return response

    # Unhandled unexpected exceptions (DatabaseError, KeyError, ValueError, etc.)
    logger.exception(
        f"[UNHANDLED 500 ERROR] Uncaught exception in {view_name} during {method} {request_path}: {exc}"
    )

    error_message = (
        f"Server error: {str(exc)}"
        if settings.DEBUG
        else "An unexpected server error occurred. Our technical team has been notified. Please try again shortly."
    )

    return Response(
        {
            "status": "error",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "error": error_message,
            "detail": str(exc) if settings.DEBUG else "Internal server error",
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )
