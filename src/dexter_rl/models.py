from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Literal


class Suit(str, Enum):
    SPADES = "spades"
    HEARTS = "hearts"
    DIAMONDS = "diamonds"
    CLUBS = "clubs"


class Rank(str, Enum):
    TWO = "2"
    THREE = "3"
    FOUR = "4"
    FIVE = "5"
    SIX = "6"
    SEVEN = "7"
    EIGHT = "8"
    NINE = "9"
    TEN = "10"
    JACK = "J"
    QUEEN = "Q"
    KING = "K"
    ACE = "A"


class RoundResult(str, Enum):
    PLAYER_BLACKJACK = "player_blackjack"
    PLAYER_WIN = "player_win"
    DEALER_WIN = "dealer_win"
    PUSH = "push"
    PLAYER_BUST = "player_bust"
    DEALER_BUST = "dealer_bust"


class GamePhase(str, Enum):
    IDLE = "idle"
    BETTING = "betting"
    DEALING = "dealing"
    PLAYING = "playing"
    DEALER_TURN = "dealer_turn"
    RESOLVED = "resolved"


Action = Literal["hit", "stand", "double"]


@dataclass
class Card:
    suit: Suit
    rank: Rank

    def numeric_value(self) -> int:
        if self.rank == Rank.ACE:
            return 11
        if self.rank in (Rank.KING, Rank.QUEEN, Rank.JACK):
            return 10
        return int(self.rank.value)

    def display(self) -> str:
        symbols = {
            Suit.SPADES: "\u2660",
            Suit.HEARTS: "\u2665",
            Suit.DIAMONDS: "\u2666",
            Suit.CLUBS: "\u2663",
        }
        return f"{self.rank.value}{symbols[self.suit]}"


@dataclass
class ActionWeights:
    hit: float = 0.0
    stand: float = 0.0
    double: float = 0.0


@dataclass
class BrainState:
    weights: dict[str, ActionWeights] = field(default_factory=dict)
    total_hands: int = 0
    wins: int = 0
    losses: int = 0
    pushes: int = 0
    blackjacks: int = 0
    win_streak: int = 0
    lose_streak: int = 0
    peak_balance: int = 1000
    learning_rate: float = 0.3
    exploration_rate: float = 0.15
    iteration: int = 0


@dataclass
class HandRecord:
    hand_id: int
    timestamp: float
    table_name: str
    player_score: int
    dealer_score: int
    result: RoundResult
    bet: int
    delta: int


@dataclass
class SessionRecord:
    session_id: int
    start_time: float
    end_time: float
    hands_played: int
    wins: int
    losses: int
    peak_balance: int
    end_balance: int


# ── Hand evaluation helpers ──

def hand_value(cards: list[Card]) -> int:
    total = 0
    aces = 0
    for card in cards:
        if card.rank == Rank.ACE:
            total += 11
            aces += 1
        elif card.rank in (Rank.KING, Rank.QUEEN, Rank.JACK):
            total += 10
        else:
            total += int(card.rank.value)
    while total > 21 and aces > 0:
        total -= 10
        aces -= 1
    return total


def is_bust(cards: list[Card]) -> bool:
    return hand_value(cards) > 21


def is_blackjack(cards: list[Card]) -> bool:
    return len(cards) == 2 and hand_value(cards) == 21


def is_soft_hand(cards: list[Card]) -> bool:
    """True if the hand contains a usable ace (counted as 11 without busting)."""
    total = 0
    aces = 0
    for card in cards:
        if card.rank == Rank.ACE:
            total += 11
            aces += 1
        elif card.rank in (Rank.KING, Rank.QUEEN, Rank.JACK):
            total += 10
        else:
            total += int(card.rank.value)
    # Reduce aces from 11 to 1 until we're under 21 — mirrors hand_value logic
    while total > 21 and aces > 0:
        total -= 10
        aces -= 1
    return aces > 0 and total <= 21


def is_soft_17(cards: list[Card]) -> bool:
    if hand_value(cards) != 17:
        return False
    total = 0
    aces = 0
    for card in cards:
        if card.rank == Rank.ACE:
            total += 11
            aces += 1
        elif card.rank in (Rank.KING, Rank.QUEEN, Rank.JACK):
            total += 10
        else:
            total += int(card.rank.value)
    return aces > 0 and total <= 21
