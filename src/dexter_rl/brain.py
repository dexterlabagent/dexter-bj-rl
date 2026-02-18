from __future__ import annotations

import random

from .models import Action, ActionWeights, BrainState, RoundResult
from .config import DexterConfig


class DexterBrain:
    def __init__(self, state: BrainState, config: DexterConfig):
        self.state = state
        self.config = config

    # ── Basic strategy prior ──

    @staticmethod
    def basic_strategy_action(player_total: int, dealer_up: int) -> Action:
        if player_total >= 17:
            return "stand"
        if player_total <= 11:
            return "hit"
        if 2 <= dealer_up <= 6:
            return "stand"
        return "hit"

    def _init_weights(self, player_total: int, dealer_up: int) -> ActionWeights:
        best = self.basic_strategy_action(player_total, dealer_up)
        if best == "hit":
            return ActionWeights(
                hit=0.6 + random.random() * 0.1,
                stand=0.3 + random.random() * 0.1,
            )
        return ActionWeights(
            hit=0.3 + random.random() * 0.1,
            stand=0.6 + random.random() * 0.1,
        )

    @staticmethod
    def state_key(player_total: int, dealer_up_value: int) -> str:
        return f"{player_total}_{dealer_up_value}"

    def ensure_weights(self, key: str, player_total: int, dealer_up: int) -> None:
        if key not in self.state.weights:
            self.state.weights[key] = self._init_weights(player_total, dealer_up)

    # ── Bet decision (Kelly criterion) ──

    def decide_bet(self, balance: int, num_tables: int) -> int:
        total_hands = max(self.state.total_hands, 1)
        win_rate = self.state.wins / total_hands

        kelly = win_rate * 2 - 1
        kelly = max(self.config.kelly_min, min(self.config.kelly_max, kelly))

        if self.state.total_hands < self.config.kelly_warmup_hands:
            kelly = self.config.kelly_warmup_fraction

        bet = int((balance * kelly) / num_tables)
        bet = round(bet / 5) * 5
        bet = max(self.config.min_bet, min(bet, balance))
        return bet

    # ── Action decision (epsilon-greedy) ──

    def decide_action(self, player_total: int, dealer_up_value: int) -> tuple[Action, bool]:
        key = self.state_key(player_total, dealer_up_value)
        self.ensure_weights(key, player_total, dealer_up_value)

        if random.random() < self.state.exploration_rate:
            action: Action = random.choice(["hit", "stand"])
            return action, True

        w = self.state.weights[key]
        action = "hit" if w.hit >= w.stand else "stand"
        return action, False

    # ── Weight update ──

    def update_weights(
        self,
        states_visited: list[str],
        actions_chosen: list[Action],
        reward: float,
    ) -> None:
        for key, action in zip(states_visited, actions_chosen):
            w = self.state.weights.get(key)
            if w is None:
                continue
            current = w.hit if action == "hit" else w.stand
            updated = current + self.state.learning_rate * (reward - current)
            if action == "hit":
                w.hit = updated
            else:
                w.stand = updated

        self.state.iteration += 1
        self.state.learning_rate = self.config.initial_learning_rate / (
            1 + self.state.iteration * self.config.learning_rate_decay
        )
        self.state.exploration_rate = max(
            self.config.min_exploration_rate,
            self.config.initial_exploration_rate / (
                1 + self.state.iteration * self.config.exploration_rate_decay
            ),
        )

    # ── Stats update ──

    def update_stats(self, result: RoundResult, balance: int) -> None:
        self.state.total_hands += 1

        if result == RoundResult.PLAYER_BLACKJACK:
            self.state.blackjacks += 1
            self.state.wins += 1
            self.state.win_streak += 1
            self.state.lose_streak = 0
        elif result in (RoundResult.PLAYER_WIN, RoundResult.DEALER_BUST):
            self.state.wins += 1
            self.state.win_streak += 1
            self.state.lose_streak = 0
        elif result in (RoundResult.DEALER_WIN, RoundResult.PLAYER_BUST):
            self.state.losses += 1
            self.state.lose_streak += 1
            self.state.win_streak = 0
        elif result == RoundResult.PUSH:
            self.state.pushes += 1

        if balance > self.state.peak_balance:
            self.state.peak_balance = balance

    # ── Reward mapping ──

    @staticmethod
    def result_to_reward(result: RoundResult) -> float:
        return {
            RoundResult.PLAYER_BLACKJACK: 1.5,
            RoundResult.PLAYER_WIN: 1.0,
            RoundResult.DEALER_BUST: 1.0,
            RoundResult.DEALER_WIN: -1.0,
            RoundResult.PLAYER_BUST: -1.0,
            RoundResult.PUSH: 0.0,
        }[result]
