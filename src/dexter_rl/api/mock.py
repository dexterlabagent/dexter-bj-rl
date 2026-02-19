"""
Mock game client with a built-in blackjack engine.
No network needed -- enables standalone training with `--mock`.
"""

from __future__ import annotations

import asyncio
import random

from .client import GameClient
from .events import (
    GameEvent,
    TableAssigned,
    BetAccepted,
    DealEvent,
    CardDealt,
    DealerReveal,
    RoundResultEvent,
)
from ..models import Action, Card, Suit, Rank, RoundResult, hand_value, is_blackjack, is_soft_17
from ..config import DexterConfig


def _create_deck() -> list[Card]:
    return [Card(suit=s, rank=r) for s in Suit for r in Rank]


def _shuffle(deck: list[Card]) -> list[Card]:
    d = deck[:]
    random.shuffle(d)
    return d


def _balance_delta(result: RoundResult, bet: int) -> int:
    match result:
        case RoundResult.PLAYER_BLACKJACK:
            return int(bet * 1.5)
        case RoundResult.PLAYER_WIN | RoundResult.DEALER_BUST:
            return bet
        case RoundResult.DEALER_WIN | RoundResult.PLAYER_BUST:
            return -bet
        case RoundResult.PUSH:
            return 0


class _MockTable:
    def __init__(self, table_id: str, reshuffle_threshold: int):
        self.table_id = table_id
        self.reshuffle_threshold = reshuffle_threshold
        self.deck: list[Card] = []
        self.player_hand: list[Card] = []
        self.dealer_hand: list[Card] = []
        self.bet: int = 0
        self._ensure_deck()

    def _ensure_deck(self) -> None:
        if len(self.deck) < self.reshuffle_threshold:
            self.deck = _shuffle(_create_deck())

    def draw(self) -> Card:
        self._ensure_deck()
        return self.deck.pop()


class MockGameClient(GameClient):
    def __init__(self, config: DexterConfig):
        self.config = config
        self._tables: dict[str, _MockTable] = {}
        self._queues: dict[str, asyncio.Queue[GameEvent]] = {}
        self._counter = 0
        self._balance = config.initial_balance

    def set_balance(self, balance: int) -> None:
        self._balance = balance

    async def connect(self) -> None:
        pass

    async def disconnect(self) -> None:
        pass

    async def join_table(self, slot: int) -> str:
        self._counter += 1
        table_id = f"mock-{self._counter}"
        self._tables[table_id] = _MockTable(table_id, self.config.reshuffle_threshold)
        self._queues[table_id] = asyncio.Queue()
        await self._emit(table_id, TableAssigned(table_id=table_id, slot=slot))
        return table_id

    async def leave_table(self, table_id: str) -> None:
        self._tables.pop(table_id, None)
        self._queues.pop(table_id, None)

    async def place_bet(self, table_id: str, amount: int) -> None:
        table = self._tables[table_id]
        table.bet = amount
        table.player_hand = []
        table.dealer_hand = []

        # Deal 2 cards each
        table.player_hand.append(table.draw())
        table.dealer_hand.append(table.draw())
        table.player_hand.append(table.draw())
        table.dealer_hand.append(table.draw())

        await self._emit(table_id, BetAccepted(table_id=table_id, amount=amount))
        await self._emit(
            table_id,
            DealEvent(
                table_id=table_id,
                player_cards=list(table.player_hand),
                dealer_up_card=table.dealer_hand[0],
            ),
        )

        # Check immediate blackjacks
        p_bj = is_blackjack(table.player_hand)
        d_bj = is_blackjack(table.dealer_hand)

        if p_bj and d_bj:
            await self._resolve(table_id, RoundResult.PUSH)
        elif p_bj:
            await self._resolve(table_id, RoundResult.PLAYER_BLACKJACK)
        elif d_bj:
            await self._dealer_reveal(table_id)
            await self._resolve(table_id, RoundResult.DEALER_WIN)

    async def send_action(self, table_id: str, action: Action) -> None:
        table = self._tables[table_id]

        if action == "hit":
            card = table.draw()
            table.player_hand.append(card)
            await self._emit(
                table_id,
                CardDealt(table_id=table_id, card=card, recipient="player"),
            )
            if hand_value(table.player_hand) > 21:
                await self._resolve(table_id, RoundResult.PLAYER_BUST)
        else:
            # Stand -> dealer plays
            await self._dealer_play(table_id)

    async def next_event(self, table_id: str) -> GameEvent:
        if table_id not in self._queues:
            self._queues[table_id] = asyncio.Queue()
        return await self._queues[table_id].get()

    async def _dealer_reveal(self, table_id: str) -> None:
        table = self._tables[table_id]
        await self._emit(
            table_id,
            DealerReveal(
                table_id=table_id,
                hole_card=table.dealer_hand[1],
                dealer_cards=list(table.dealer_hand),
                dealer_total=hand_value(table.dealer_hand),
            ),
        )

    async def _dealer_play(self, table_id: str) -> None:
        table = self._tables[table_id]

        # Reveal hole card
        await self._dealer_reveal(table_id)

        # Dealer hits on soft 17 and below 17
        while hand_value(table.dealer_hand) < 17 or is_soft_17(table.dealer_hand):
            card = table.draw()
            table.dealer_hand.append(card)
            await self._emit(
                table_id,
                CardDealt(table_id=table_id, card=card, recipient="dealer"),
            )

        # Determine result
        p_val = hand_value(table.player_hand)
        d_val = hand_value(table.dealer_hand)

        if d_val > 21:
            result = RoundResult.DEALER_BUST
        elif p_val > d_val:
            result = RoundResult.PLAYER_WIN
        elif d_val > p_val:
            result = RoundResult.DEALER_WIN
        else:
            result = RoundResult.PUSH

        await self._resolve(table_id, result)

    async def _resolve(self, table_id: str, result: RoundResult) -> None:
        table = self._tables[table_id]
        delta = _balance_delta(result, table.bet)
        self._balance += delta

        await self._emit(
            table_id,
            RoundResultEvent(
                table_id=table_id,
                result=result,
                payout=delta,
                new_balance=self._balance,
                dealer_total=hand_value(table.dealer_hand),
            ),
        )

    async def _emit(self, table_id: str, event: GameEvent) -> None:
        if table_id in self._queues:
            await self._queues[table_id].put(event)
