from __future__ import annotations

import asyncio
import logging
import signal

from .brain import DexterBrain
from .table import TableInstance
from .models import BrainState, hand_value
from .api.client import GameClient
from .api.mock import MockGameClient
from .api.events import (
    DealEvent,
    CardDealt,
    DealerReveal,
    RoundResultEvent,
    BetAccepted,
)
from .commentary import (
    commentary_bet,
    commentary_action,
    commentary_result,
    commentary_kill,
    commentary_boot,
    commentary_bankruptcy,
    commentary_reboot,
)
from .persistence import save_brain, load_brain
from .config import DexterConfig

logger = logging.getLogger("dexter")


class Orchestrator:
    def __init__(self, client: GameClient, config: DexterConfig):
        self.client = client
        self.config = config
        self.balance: int = config.initial_balance
        self.tables: list[TableInstance] = []
        self.table_ids: dict[int, str] = {}  # slot -> server table_id
        self._running = False
        self._hands_since_save = 0

        # Load or create brain
        saved = load_brain(config)
        if saved:
            brain_state = saved
            logger.info(
                "Loaded brain: %d hands, %d wins, iter %d",
                saved.total_hands, saved.wins, saved.iteration,
            )
        else:
            brain_state = BrainState(
                peak_balance=config.initial_balance,
                learning_rate=config.initial_learning_rate,
                exploration_rate=config.initial_exploration_rate,
            )
        self.brain = DexterBrain(brain_state, config)

    async def run(self) -> None:
        self._running = True

        # Register signal handlers
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, self._shutdown)

        await self.client.connect()

        # Spawn tables
        for slot in range(self.config.num_tables):
            await self._spawn_table(slot)

        # Boot log
        table_names = ", ".join(t.casino_name for t in self.tables)
        self._log_lines(commentary_boot(table_names, self.balance))

        # Main loop
        while self._running:
            if self.balance <= 0:
                await self._handle_bankruptcy()
                continue

            await self._play_round()
            await asyncio.sleep(self.config.round_pause)

        # Cleanup
        save_brain(self.brain.state, self.config)
        await self.client.disconnect()
        logger.info("Orchestrator stopped. State saved.")

    async def _play_round(self) -> None:
        """Deal all tables, then play all tables."""

        # Phase 1: Deal
        committed_bets = 0
        dealt_slots: list[int] = []

        for slot in range(len(self.tables)):
            available = self.balance - committed_bets
            if available < self.config.min_bet:
                break

            table = self.tables[slot]
            table.reset_hand()

            bet = self.brain.decide_bet(available, self.config.num_tables)
            bet = min(bet, available)
            table.current_bet = bet
            committed_bets += bet

            table_id = self.table_ids[slot]
            await self.client.place_bet(table_id, bet)

            # Wait for deal event
            deal = await self._wait_for(table_id, DealEvent)
            self._log_lines(commentary_bet(
                table.casino_name, bet, self.balance, self.brain.state
            ))

            # Store hand info for decisions
            table._player_cards = list(deal.player_cards)  # type: ignore[attr-defined]
            table._dealer_up = deal.dealer_up_card  # type: ignore[attr-defined]

            # Check if immediate blackjack already resolved
            result = await self._drain_until(table_id, RoundResultEvent)
            if result:
                await self._handle_result(slot, table, result)
            else:
                dealt_slots.append(slot)

            await asyncio.sleep(self.config.deal_delay)

        # Phase 2: Play each table's hand
        for slot in dealt_slots:
            table = self.tables[slot]
            table_id = self.table_ids[slot]
            await self._play_hand(slot, table_id, table)
            await asyncio.sleep(self.config.deal_delay)

    async def _play_hand(self, slot: int, table_id: str, table: TableInstance) -> None:
        player_cards: list = table._player_cards  # type: ignore[attr-defined]
        dealer_up_card = table._dealer_up  # type: ignore[attr-defined]
        dealer_up_value = dealer_up_card.numeric_value()

        while True:
            player_total = hand_value(player_cards)

            if player_total >= 21:
                break

            action, explored = self.brain.decide_action(player_total, dealer_up_value)
            key = DexterBrain.state_key(player_total, dealer_up_value)
            table.states_visited.append(key)
            table.actions_chosen.append(action)

            await self.client.send_action(table_id, action)

            if action == "hit":
                card_event = await self._wait_for(table_id, CardDealt)
                player_cards.append(card_event.card)
                new_total = hand_value(player_cards)

                self._log_lines(commentary_action(
                    table.casino_name, player_total, dealer_up_value,
                    action, explored, self.brain.state,
                    drawn_card_str=card_event.card.display() if card_event.card else "?",
                    new_total=new_total,
                ))

                if new_total > 21:
                    # Bust - result event follows
                    result = await self._wait_for(table_id, RoundResultEvent)
                    await self._handle_result(slot, table, result)
                    return

                if new_total == 21:
                    # Auto-stand on 21
                    break

                await asyncio.sleep(self.config.hit_delay)
            else:
                # Stand
                self._log_lines(commentary_action(
                    table.casino_name, player_total, dealer_up_value,
                    action, explored, self.brain.state,
                ))
                break

        # Send stand to trigger dealer play
        await self.client.send_action(table_id, "stand")

        # Drain dealer reveal, then get result
        await self._drain_until(table_id, DealerReveal)
        result = await self._wait_for(table_id, RoundResultEvent)
        await self._handle_result(slot, table, result)

    async def _handle_result(
        self, slot: int, table: TableInstance, event: RoundResultEvent
    ) -> None:
        result = event.result
        assert result is not None

        balance_before = self.balance
        self.balance = event.new_balance

        # Sync mock client balance if applicable
        if isinstance(self.client, MockGameClient):
            pass  # mock already updated its internal balance

        reward = DexterBrain.result_to_reward(result)

        self.brain.update_stats(result, self.balance)
        table.update_stats(result)
        self.brain.update_weights(table.states_visited, table.actions_chosen, reward)

        self._log_lines(commentary_result(
            table.casino_name, result, self.balance, balance_before,
            self.brain.state, event.dealer_total,
        ))

        # Autosave
        self._hands_since_save += 1
        if self._hands_since_save >= self.config.autosave_interval_hands:
            save_brain(self.brain.state, self.config)
            self._hands_since_save = 0
            logger.debug("Auto-saved brain state (iter %d)", self.brain.state.iteration)

        # Kill check
        if table.should_kill(self.config):
            await self._kill_and_respawn(slot)

    async def _kill_and_respawn(self, slot: int) -> None:
        old = self.tables[slot]
        old_name = old.casino_name
        reason = old.kill_reason(self.config)

        await self.client.leave_table(self.table_ids[slot])

        new_table = TableInstance.create(slot)
        self.tables[slot] = new_table

        new_table_id = await self.client.join_table(slot)
        self.table_ids[slot] = new_table_id

        self._log_lines(commentary_kill(old_name, new_table.casino_name, old, reason))

    async def _spawn_table(self, slot: int) -> None:
        table = TableInstance.create(slot)
        self.tables.append(table)
        table_id = await self.client.join_table(slot)
        self.table_ids[slot] = table_id

    async def _handle_bankruptcy(self) -> None:
        self._log_lines(commentary_bankruptcy())
        save_brain(self.brain.state, self.config)
        await asyncio.sleep(10)

        self.balance = self.config.initial_balance

        # Sync mock balance
        if isinstance(self.client, MockGameClient):
            self.client.set_balance(self.balance)

        self._log_lines(commentary_reboot(self.balance))

    def _shutdown(self) -> None:
        logger.info("Shutdown signal received...")
        self._running = False

    def _log_lines(self, lines: list[str]) -> None:
        for line in lines:
            logger.info(line)

    # ── Event helpers ──

    async def _wait_for(self, table_id: str, event_type: type) -> any:
        """Block until we get a specific event type from this table."""
        while True:
            event = await self.client.next_event(table_id)
            if isinstance(event, event_type):
                return event

    async def _drain_until(self, table_id: str, event_type: type) -> any:
        """Drain events until we find the target type, or return None if queue is empty."""
        while True:
            try:
                event = await asyncio.wait_for(
                    self.client.next_event(table_id), timeout=0.1
                )
                if isinstance(event, event_type):
                    return event
            except asyncio.TimeoutError:
                return None
