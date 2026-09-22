"""
WebSocket URL patterns for queue_app.
"""

from django.urls import path, re_path
from . import consumers

websocket_urlpatterns = [
    path('ws/queue/<int:centre_id>/', consumers.QueueConsumer.as_asgi()),
    re_path(r'^ws/queue/(?P<centre_id>\w+)/?$', consumers.QueueConsumer.as_asgi()),
]
