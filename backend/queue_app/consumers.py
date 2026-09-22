"""
WebSocket Consumers for real-time Queue updates.
Smart India Hackathon 2026 - Problem Statement 26032
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger('queue_app')


class QueueConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for live token queue updates at a specific procurement centre.
    Path: ws://<host>/ws/queue/<centre_id>/
    """

    async def connect(self):
        # Extract centre_id from the URL route kwargs
        self.centre_id = self.scope['url_route']['kwargs'].get('centre_id')
        if not self.centre_id:
            await self.close()
            return

        self.group_name = f"queue_{self.centre_id}"

        # Join the centre queue channel group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()
        logger.info(f"[WS CONNECTED] Client connected to {self.group_name}")

    async def disconnect(self, close_code):
        # Leave the group cleanly on disconnect
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
            logger.info(f"[WS DISCONNECTED] Client left {self.group_name} (code: {close_code})")

    async def receive(self, text_data=None, bytes_data=None):
        """
        Handle incoming messages from client (e.g. ping / keepalive).
        """
        if text_data:
            try:
                data = json.loads(text_data)
                if data.get('type') == 'ping':
                    await self.send(text_data=json.dumps({'type': 'pong'}))
            except Exception:
                pass

    async def queue_update(self, event):
        """
        Handler matching the "type": "queue.update" message type sent from
        bookings/views.py. Sends the message content to the connected client as JSON.
        """
        message_data = event.get('message', {})
        await self.send(text_data=json.dumps(message_data))
