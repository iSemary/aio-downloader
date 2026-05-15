from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.response import Response


def custom_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is not None:
        detail = response.data
        code = getattr(exc, "default_code", "error")
        if isinstance(detail, dict) and "detail" in detail and len(detail) == 1:
            payload = {
                "error": code,
                "detail": detail["detail"],
                "code": str(code),
            }
        else:
            payload = {
                "error": code,
                "detail": detail,
                "code": str(code),
            }
        response.data = payload
    return response
