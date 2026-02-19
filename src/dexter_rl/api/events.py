"""
Event types for the SSE stream (server -> agent) and REST actions (agent -> server).

SSE contract:
  event: <event_type>
  data: {"table_id": "...", ...}

REST contract:
  POST /join    {"slot": int}            -> TableAssigned via SSE
  POST /leave   {"table_id": str}        -> 200 OK
  POST /bet     {"table_id": str, "amount": int}  -> BetAccepted + DealEvent via SSE
  POST /action  {"table_id": str, "action": "hit"|"stand"} -> CardDealt / DealerReveal + RoundResultEvent via SSE
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Union

from ..models import Card, RoundResult


@dataclass
class TableAssigned:
    table_id: str = ""
    slot: int = 0


@dataclass
class BetAccepted:
    table_id: str = ""
    amount: int = 0


@dataclass
class DealEvent:
    table_id: str = ""
    player_cards: list[Card] = field(default_factory=list)
    dealer_up_card: Card | None = None


@dataclass
class CardDealt:
    table_id: str = ""
    card: Card | None = None
    recipient: str = ""  # "player" or "dealer"


@dataclass
class DealerReveal:
    table_id: str = ""
    hole_card: Card | None = None
    dealer_cards: list[Card] = field(default_factory=list)
    dealer_total: int = 0


@dataclass
class RoundResultEvent:
    table_id: str = ""
    result: RoundResult | None = None
    payout: int = 0
    new_balance: int = 0
    dealer_total: int = 0


@dataclass
class ErrorEvent:
    table_id: str = ""
    message: str = ""


@dataclass
class Heartbeat:
    pass


GameEvent = Union[
    TableAssigned,
    BetAccepted,
    DealEvent,
    CardDealt,
    DealerReveal,
    RoundResultEvent,
    ErrorEvent,
    Heartbeat,
]
