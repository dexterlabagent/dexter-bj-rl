"""Tests for card/hand model helpers."""
import pytest
from dexter_rl.models import (
    Card, Suit, Rank,
    hand_value, is_bust, is_blackjack, is_soft_hand, is_soft_17,
)


def c(rank: Rank, suit: Suit = Suit.SPADES) -> Card:
    return Card(suit=suit, rank=rank)


# ── hand_value ──────────────────────────────────────────────────────────────

class TestHandValue:
    def test_empty_hand(self):
        assert hand_value([]) == 0

    def test_simple_sum(self):
        assert hand_value([c(Rank.FIVE), c(Rank.SEVEN)]) == 12

    def test_face_cards_count_as_ten(self):
        assert hand_value([c(Rank.JACK), c(Rank.KING)]) == 20
        assert hand_value([c(Rank.QUEEN), c(Rank.TEN)]) == 20

    def test_ace_counts_as_eleven(self):
        assert hand_value([c(Rank.ACE), c(Rank.NINE)]) == 20

    def test_ace_reduces_to_avoid_bust(self):
        # A + K + 5 → 16 (ace counted as 1)
        assert hand_value([c(Rank.ACE), c(Rank.KING), c(Rank.FIVE)]) == 16

    def test_double_ace(self):
        # A + A → 12 (one as 11, one as 1)
        assert hand_value([c(Rank.ACE), c(Rank.ACE)]) == 12

    def test_blackjack(self):
        assert hand_value([c(Rank.ACE), c(Rank.KING)]) == 21
        assert hand_value([c(Rank.ACE), c(Rank.JACK)]) == 21

    def test_bust(self):
        assert hand_value([c(Rank.KING), c(Rank.QUEEN), c(Rank.FIVE)]) == 25

    def test_exactly_21_three_cards(self):
        assert hand_value([c(Rank.SEVEN), c(Rank.SEVEN), c(Rank.SEVEN)]) == 21


# ── is_bust ──────────────────────────────────────────────────────────────────

class TestIsBust:
    def test_bust(self):
        assert is_bust([c(Rank.KING), c(Rank.QUEEN), c(Rank.FIVE)]) is True

    def test_not_bust_on_21(self):
        assert is_bust([c(Rank.KING), c(Rank.ACE)]) is False

    def test_not_bust_below_21(self):
        assert is_bust([c(Rank.EIGHT), c(Rank.NINE)]) is False


# ── is_blackjack ─────────────────────────────────────────────────────────────

class TestIsBlackjack:
    def test_ace_king(self):
        assert is_blackjack([c(Rank.ACE), c(Rank.KING)]) is True

    def test_ace_ten(self):
        assert is_blackjack([c(Rank.ACE), c(Rank.TEN)]) is True

    def test_21_on_three_cards_is_not_blackjack(self):
        assert is_blackjack([c(Rank.SEVEN), c(Rank.SEVEN), c(Rank.SEVEN)]) is False

    def test_two_cards_not_21(self):
        assert is_blackjack([c(Rank.TEN), c(Rank.NINE)]) is False


# ── is_soft_hand ─────────────────────────────────────────────────────────────

class TestIsSoftHand:
    def test_soft_17(self):
        # A + 6 = soft 17
        assert is_soft_hand([c(Rank.ACE), c(Rank.SIX)]) is True

    def test_hard_17(self):
        # 9 + 8 = hard 17
        assert is_soft_hand([c(Rank.NINE), c(Rank.EIGHT)]) is False

    def test_double_ace_is_soft(self):
        # A + A = 12, the 11-ace is still usable
        assert is_soft_hand([c(Rank.ACE), c(Rank.ACE)]) is True

    def test_ace_busts_if_counted_as_11(self):
        # A + K + 5 = 16 — ace must be 1, so not soft
        assert is_soft_hand([c(Rank.ACE), c(Rank.KING), c(Rank.FIVE)]) is False

    def test_soft_blackjack(self):
        # A + K = soft 21
        assert is_soft_hand([c(Rank.ACE), c(Rank.KING)]) is True

    def test_no_ace_is_never_soft(self):
        assert is_soft_hand([c(Rank.TEN), c(Rank.SIX)]) is False


# ── is_soft_17 ───────────────────────────────────────────────────────────────

class TestIsSoft17:
    def test_ace_six(self):
        assert is_soft_17([c(Rank.ACE), c(Rank.SIX)]) is True

    def test_hard_17(self):
        assert is_soft_17([c(Rank.NINE), c(Rank.EIGHT)]) is False

    def test_other_soft_total(self):
        # A + 5 = soft 16, not 17
        assert is_soft_17([c(Rank.ACE), c(Rank.FIVE)]) is False

    def test_hard_21_not_soft_17(self):
        assert is_soft_17([c(Rank.ACE), c(Rank.KING)]) is False
