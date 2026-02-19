"""
Abstract game client protocol + HTTP SSE/REST implementation.

The abstract base allows swapping between the real HTTP client
and the mock client with a built-in engine.
"""

from __future__ import annotations

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import AsyncIterator

import aiohttp

from .events import (
    GameEvent,
    TableAssigned,
    BetAccepted,
    DealEvent,
    CardDealt,
    DealerReveal,
    RoundResultEvent,
    ErrorEvent,
    Heartbeat,
)
from ..models import Action, Card, Suit, Rank, RoundResult
from ..config import DexterConfig

logger = logging.getLogger("dexter")


class GameClient(ABC):
    @abstractmethod
    async def connect(self) -> None: ...

    @abstractmethod
    async def disconnect(self) -> None: ...

    @abstractmethod
    async def join_table(self, slot: int) -> str: ...

    @abstractmethod
    async def leave_table(self, table_id: str) -> None: ...

    @abstractmethod
    async def place_bet(self, table_id: str, amount: int) -> None: ...

    @abstractmethod
    async def send_action(self, table_id: str, action: Action) -> None: ...

    @abstractmethod
    async def next_event(self, table_id: str) -> GameEvent: ...


def _parse_card(data: dict) -> Card:
    return Card(suit=Suit(data["suit"]), rank=Rank(data["rank"]))


def _parse_event(event_type: str, data: dict) -> GameEvent | None:
    match event_type:
        case "table_assigned":
            return TableAssigned(table_id=data["table_id"], slot=data["slot"])
        case "bet_accepted":
            return BetAccepted(table_id=data["table_id"], amount=data["amount"])
        case "deal":
            return DealEvent(
                table_id=data["table_id"],
                player_cards=[_parse_card(c) for c in data["player_cards"]],
                dealer_up_card=_parse_card(data["dealer_up_card"]),
            )
        case "card":
            return CardDealt(
                table_id=data["table_id"],
                card=_parse_card(data["card"]),
                recipient=data["recipient"],
            )
        case "dealer_reveal":
            return DealerReveal(
                table_id=data["table_id"],
                hole_card=_parse_card(data["hole_card"]),
                dealer_cards=[_parse_card(c) for c in data["dealer_cards"]],
                dealer_total=data["dealer_total"],
            )
        case "result":
            return RoundResultEvent(
                table_id=data["table_id"],
                result=RoundResult(data["result"]),
                payout=data["payout"],
                new_balance=data["new_balance"],
                dealer_total=data.get("dealer_total", 0),
            )
        case "error":
            return ErrorEvent(table_id=data.get("table_id", ""), message=data["message"])
        case "heartbeat":
            return Heartbeat()
        case _:
            return None


class HttpGameClient(GameClient):
    """Real HTTP SSE + REST client."""

    def __init__(self, config: DexterConfig):
        self.config = config
        self.base_url = config.api_base_url
        self._session: aiohttp.ClientSession | None = None
        self._sse_task: asyncio.Task | None = None
        self._queues: dict[str, asyncio.Queue[GameEvent]] = {}

    async def connect(self) -> None:
        self._session = aiohttp.ClientSession()
        self._sse_task = asyncio.create_task(self._consume_sse())
        logger.info("Connected to game server at %s", self.base_url)

    async def _consume_sse(self) -> None:
        url = f"{self.base_url}{self.config.sse_endpoint}"
        try:
            async with self._session.get(url) as resp:  # type: ignore[union-attr]
                buffer = ""
                async for chunk in resp.content:
                    buffer += chunk.decode()
                    while "\n\n" in buffer:
                        frame, buffer = buffer.split("\n\n", 1)
                        event_type = ""
                        event_data = ""
                        for line in frame.split("\n"):
                            if line.startswith("event: "):
                                event_type = line[7:]
                            elif line.startswith("data: "):
                                event_data = line[6:]
                            elif line.startswith(":"):
                                continue
                        if not event_type or not event_data:
                            continue
                        try:
                            data = json.loads(event_data)
                        except json.JSONDecodeError:
                            continue
                        event = _parse_event(event_type, data)
                        if event is None:
                            continue
                        table_id = getattr(event, "table_id", None)
                        if table_id and table_id in self._queues:
                            await self._queues[table_id].put(event)
        except asyncio.CancelledError:
            return
        except Exception:
            logger.exception("SSE connection error")

    async def disconnect(self) -> None:
        if self._sse_task:
            self._sse_task.cancel()
            try:
                await self._sse_task
            except asyncio.CancelledError:
                pass
        if self._session:
            await self._session.close()

    async def join_table(self, slot: int) -> str:
        async with self._session.post(  # type: ignore[union-attr]
            f"{self.base_url}/join", json={"slot": slot}
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
            table_id = data["table_id"]
            self._queues[table_id] = asyncio.Queue()
            return table_id

    async def leave_table(self, table_id: str) -> None:
        async with self._session.post(  # type: ignore[union-attr]
            f"{self.base_url}/leave", json={"table_id": table_id}
        ) as resp:
            resp.raise_for_status()
        self._queues.pop(table_id, None)

    async def place_bet(self, table_id: str, amount: int) -> None:
        async with self._session.post(  # type: ignore[union-attr]
            f"{self.base_url}{self.config.bet_endpoint}",
            json={"table_id": table_id, "amount": amount},
        ) as resp:
            resp.raise_for_status()

    async def send_action(self, table_id: str, action: Action) -> None:
        async with self._session.post(  # type: ignore[union-attr]
            f"{self.base_url}{self.config.action_endpoint}",
            json={"table_id": table_id, "action": action},
        ) as resp:
            resp.raise_for_status()

    async def next_event(self, table_id: str) -> GameEvent:
        if table_id not in self._queues:
            self._queues[table_id] = asyncio.Queue()
        return await self._queues[table_id].get()
