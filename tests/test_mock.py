"""Integration tests for the mock game engine."""
import asyncio
import pytest
from dexter_rl.api.mock import MockGameClient
from dexter_rl.api.events import (
    TableAssigned, BetAccepted, DealEvent, CardDealt, DealerReveal, RoundResultEvent,
)
from dexter_rl.models import RoundResult, hand_value
from dexter_rl.config import DexterConfig


@pytest.fixture
def config() -> DexterConfig:
    return DexterConfig(initial_balance=1000, min_bet=10)


@pytest.fixture
def client(config: DexterConfig) -> MockGameClient:
    return MockGameClient(config)


async def _drain(client: MockGameClient, table_id: str, n: int = 10) -> list:
    """Pull up to n events from the queue with a short timeout."""
    events = []
    for _ in range(n):
        try:
            e = await asyncio.wait_for(client.next_event(table_id), timeout=0.2)
            events.append(e)
        except asyncio.TimeoutError:
            break
    return events


# ── join / leave ─────────────────────────────────────────────────────────────

async def test_join_returns_unique_ids(client):
    id1 = await client.join_table(0)
    id2 = await client.join_table(1)
    assert id1 != id2
    assert id1.startswith("mock-")
    assert id2.startswith("mock-")


async def test_join_emits_table_assigned(client):
    table_id = await client.join_table(0)
    event = await client.next_event(table_id)
    assert isinstance(event, TableAssigned)
    assert event.table_id == table_id


async def test_leave_removes_table(client):
    table_id = await client.join_table(0)
    await client.leave_table(table_id)
    assert table_id not in client._tables
    assert table_id not in client._queues


# ── place_bet ────────────────────────────────────────────────────────────────

async def test_place_bet_emits_bet_accepted_and_deal(client):
    table_id = await client.join_table(0)
    await client.next_event(table_id)  # TableAssigned
    await client.place_bet(table_id, 50)
    events = await _drain(client, table_id)
    types = {type(e) for e in events}
    assert BetAccepted in types
    assert DealEvent in types


async def test_deal_event_has_two_player_cards(client):
    table_id = await client.join_table(0)
    await client.next_event(table_id)
    await client.place_bet(table_id, 50)
    events = await _drain(client, table_id)
    deal = next((e for e in events if isinstance(e, DealEvent)), None)
    assert deal is not None
    assert len(deal.player_cards) == 2
    assert deal.dealer_up_card is not None


# ── hit ──────────────────────────────────────────────────────────────────────

async def test_hit_delivers_a_card(client):
    table_id = await client.join_table(0)
    await client.next_event(table_id)
    await client.place_bet(table_id, 10)
    events = await _drain(client, table_id)

    # Skip if hand resolved immediately (blackjack)
    if any(isinstance(e, RoundResultEvent) for e in events):
        return

    deal = next(e for e in events if isinstance(e, DealEvent))
    if hand_value(deal.player_cards) >= 21:
        return

    await client.send_action(table_id, "hit")
    events = await _drain(client, table_id)
    player_cards = [e for e in events if isinstance(e, CardDealt) and e.recipient == "player"]
    assert len(player_cards) >= 1


# ── double ───────────────────────────────────────────────────────────────────

async def test_double_doubles_the_bet(client):
    table_id = await client.join_table(0)
    await client.next_event(table_id)
    await client.place_bet(table_id, 50)
    events = await _drain(client, table_id)

    if any(isinstance(e, RoundResultEvent) for e in events):
        return  # immediate blackjack — can't double

    initial = client._balance
    await client.send_action(table_id, "double")
    events = await _drain(client, table_id)

    result = next((e for e in events if isinstance(e, RoundResultEvent)), None)
    assert result is not None
    # With bet doubled to 100, delta must be ±100 or 0 (push)
    delta = abs(result.new_balance - initial)
    assert delta in (0, 100)


async def test_double_draws_exactly_one_player_card(client):
    table_id = await client.join_table(0)
    await client.next_event(table_id)
    await client.place_bet(table_id, 10)
    events = await _drain(client, table_id)

    if any(isinstance(e, RoundResultEvent) for e in events):
        return

    await client.send_action(table_id, "double")
    events = await _drain(client, table_id)
    player_hits = [e for e in events if isinstance(e, CardDealt) and e.recipient == "player"]
    assert len(player_hits) == 1


# ── stand / result ───────────────────────────────────────────────────────────

async def test_stand_triggers_dealer_play(client):
    table_id = await client.join_table(0)
    await client.next_event(table_id)
    await client.place_bet(table_id, 10)
    events = await _drain(client, table_id)

    if any(isinstance(e, RoundResultEvent) for e in events):
        return

    await client.send_action(table_id, "stand")
    events = await _drain(client, table_id)
    types = {type(e) for e in events}
    assert DealerReveal in types
    assert RoundResultEvent in types


async def test_result_balance_is_consistent(client):
    table_id = await client.join_table(0)
    await client.next_event(table_id)
    initial = client._balance

    await client.place_bet(table_id, 100)
    events = await _drain(client, table_id)

    if not any(isinstance(e, RoundResultEvent) for e in events):
        await client.send_action(table_id, "stand")
        events += await _drain(client, table_id)

    result = next(e for e in events if isinstance(e, RoundResultEvent))
    expected_deltas = {
        RoundResult.PLAYER_BLACKJACK: 150,
        RoundResult.PLAYER_WIN: 100,
        RoundResult.DEALER_BUST: 100,
        RoundResult.DEALER_WIN: -100,
        RoundResult.PLAYER_BUST: -100,
        RoundResult.PUSH: 0,
    }
    expected = initial + expected_deltas[result.result]
    assert result.new_balance == expected
