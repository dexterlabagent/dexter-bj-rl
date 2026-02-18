from __future__ import annotations

from dataclasses import dataclass, field

from .models import Action, RoundResult
from .config import DexterConfig

_instance_counter: int = 0


def next_instance_id() -> int:
    global _instance_counter
    _instance_counter += 1
    return _instance_counter


def instance_name(instance_id: int) -> str:
    return f"Stake-{instance_id:03d}"


@dataclass
class TableInstance:
    slot_id: int
    instance_id: int
    casino_name: str
    # Per-instance stats (reset on respawn)
    table_wins: int = 0
    table_losses: int = 0
    table_hands: int = 0
    table_lose_streak: int = 0
    # Current hand tracking (reset each round)
    current_bet: int = 0
    states_visited: list[str] = field(default_factory=list)
    actions_chosen: list[Action] = field(default_factory=list)

    @classmethod
    def create(cls, slot_id: int) -> TableInstance:
        iid = next_instance_id()
        return cls(slot_id=slot_id, instance_id=iid, casino_name=instance_name(iid))

    def reset_hand(self) -> None:
        self.current_bet = 0
        self.states_visited = []
        self.actions_chosen = []

    def update_stats(self, result: RoundResult) -> None:
        self.table_hands += 1
        if result in (
            RoundResult.PLAYER_BLACKJACK,
            RoundResult.PLAYER_WIN,
            RoundResult.DEALER_BUST,
        ):
            self.table_wins += 1
            self.table_lose_streak = 0
        elif result in (RoundResult.DEALER_WIN, RoundResult.PLAYER_BUST):
            self.table_losses += 1
            self.table_lose_streak += 1

    def should_kill(self, config: DexterConfig) -> bool:
        if self.table_lose_streak >= config.kill_lose_streak:
            return True
        if self.table_hands >= config.kill_min_hands:
            wr = self.table_wins / self.table_hands
            if wr < config.kill_win_rate_threshold:
                return True
        return False

    def kill_reason(self, config: DexterConfig) -> str:
        if self.table_lose_streak >= config.kill_lose_streak:
            return f"{self.table_lose_streak} consecutive losses"
        wr = (self.table_wins / self.table_hands * 100) if self.table_hands > 0 else 0
        return f"win rate {wr:.0f}% after {self.table_hands} hands"
