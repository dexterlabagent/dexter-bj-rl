"""Tests for DexterBrain: strategy prior, betting, weight updates."""
import pytest
from dexter_rl.brain import DexterBrain
from dexter_rl.models import BrainState, ActionWeights
from dexter_rl.config import DexterConfig


def make_brain(exploration_rate: float = 0.0) -> DexterBrain:
    config = DexterConfig()
    state = BrainState(
        peak_balance=1000,
        learning_rate=0.3,
        exploration_rate=exploration_rate,
    )
    return DexterBrain(state, config)


# ── basic_strategy_action ────────────────────────────────────────────────────

class TestBasicStrategy:
    def test_stand_on_hard_17_and_above(self):
        for total in range(17, 22):
            assert DexterBrain.basic_strategy_action(total, 7) == "stand"

    def test_hit_on_hard_11_and_below(self):
        for total in range(4, 12):
            assert DexterBrain.basic_strategy_action(total, 7) == "hit"

    def test_stand_vs_weak_dealer_12_to_16(self):
        for total in range(12, 17):
            for dealer in range(2, 7):
                assert DexterBrain.basic_strategy_action(total, dealer) == "stand"

    def test_hit_vs_strong_dealer_12_to_16(self):
        for total in range(12, 17):
            for dealer in range(7, 12):
                assert DexterBrain.basic_strategy_action(total, dealer) == "hit"

    def test_soft_17_always_hits(self):
        for dealer in range(2, 12):
            assert DexterBrain.basic_strategy_action(17, dealer, is_soft=True) == "hit"

    def test_soft_18_stands_vs_weak_dealer(self):
        for dealer in range(2, 9):
            assert DexterBrain.basic_strategy_action(18, dealer, is_soft=True) == "stand"

    def test_soft_18_hits_vs_strong_dealer(self):
        for dealer in [9, 10, 11]:
            assert DexterBrain.basic_strategy_action(18, dealer, is_soft=True) == "hit"

    def test_soft_19_and_above_always_stands(self):
        for total in range(19, 22):
            for dealer in range(2, 12):
                assert DexterBrain.basic_strategy_action(total, dealer, is_soft=True) == "stand"


# ── state_key ────────────────────────────────────────────────────────────────

class TestStateKey:
    def test_hard_key_has_H_suffix(self):
        assert DexterBrain.state_key(17, 6) == "17_6_H"

    def test_soft_key_has_S_suffix(self):
        assert DexterBrain.state_key(17, 6, is_soft=True) == "17_6_S"

    def test_hard_and_soft_keys_are_different(self):
        hard = DexterBrain.state_key(17, 6, is_soft=False)
        soft = DexterBrain.state_key(17, 6, is_soft=True)
        assert hard != soft

    def test_key_encodes_all_components(self):
        key = DexterBrain.state_key(15, 10, is_soft=False)
        assert "15" in key and "10" in key


# ── decide_bet ───────────────────────────────────────────────────────────────

class TestDecideBet:
    def test_respects_min_bet(self):
        brain = make_brain()
        assert brain.decide_bet(balance=50, num_tables=1) >= brain.config.min_bet

    def test_never_exceeds_balance(self):
        brain = make_brain()
        bet = brain.decide_bet(balance=80, num_tables=1)
        assert bet <= 80

    def test_warmup_uses_fixed_fraction(self):
        brain = make_brain()
        brain.state.total_hands = 0
        bet = brain.decide_bet(balance=1000, num_tables=1)
        expected = round((1000 * brain.config.kelly_warmup_fraction) / 5) * 5
        assert abs(bet - expected) <= 5  # allow one rounding step

    def test_kelly_stays_within_configured_bounds(self):
        brain = make_brain()
        brain.state.total_hands = 200
        brain.state.wins = 110
        brain.state.losses = 90
        bet = brain.decide_bet(balance=1000, num_tables=1)
        assert bet >= brain.config.min_bet
        assert bet <= brain.config.kelly_max * 1000 + 5


# ── update_weights ───────────────────────────────────────────────────────────

class TestUpdateWeights:
    def test_positive_reward_increases_chosen_action(self):
        brain = make_brain()
        key = "15_7_H"
        brain.state.weights[key] = ActionWeights(hit=0.5, stand=0.4, double=0.0)
        brain.update_weights([key], ["hit"], reward=1.0)
        assert brain.state.weights[key].hit > 0.5

    def test_negative_reward_decreases_chosen_action(self):
        brain = make_brain()
        key = "15_7_H"
        brain.state.weights[key] = ActionWeights(hit=0.5, stand=0.4, double=0.0)
        brain.update_weights([key], ["hit"], reward=-1.0)
        assert brain.state.weights[key].hit < 0.5

    def test_unchosen_actions_are_not_modified(self):
        brain = make_brain()
        key = "15_7_H"
        brain.state.weights[key] = ActionWeights(hit=0.5, stand=0.4, double=0.1)
        stand_before = brain.state.weights[key].stand
        double_before = brain.state.weights[key].double
        brain.update_weights([key], ["hit"], reward=1.0)
        assert brain.state.weights[key].stand == stand_before
        assert brain.state.weights[key].double == double_before

    def test_double_weight_updates_on_double_action(self):
        brain = make_brain()
        key = "11_6_H"
        brain.state.weights[key] = ActionWeights(hit=0.4, stand=0.3, double=0.5)
        brain.update_weights([key], ["double"], reward=1.0)
        assert brain.state.weights[key].double > 0.5

    def test_multi_step_trace_all_updated(self):
        brain = make_brain()
        k1, k2 = "12_9_H", "15_9_H"
        brain.state.weights[k1] = ActionWeights(hit=0.4, stand=0.5)
        brain.state.weights[k2] = ActionWeights(hit=0.6, stand=0.3)
        brain.update_weights([k1, k2], ["hit", "stand"], reward=1.0)
        assert brain.state.weights[k1].hit > 0.4
        assert brain.state.weights[k2].stand > 0.3

    def test_iteration_increments_once_per_call(self):
        brain = make_brain()
        key = "15_7_H"
        brain.state.weights[key] = ActionWeights(hit=0.5, stand=0.4)
        before = brain.state.iteration
        brain.update_weights([key], ["hit"], reward=1.0)
        assert brain.state.iteration == before + 1

    def test_learning_rate_decays_after_update(self):
        brain = make_brain()
        key = "15_7_H"
        brain.state.weights[key] = ActionWeights(hit=0.5, stand=0.4)
        lr_before = brain.state.learning_rate
        brain.update_weights([key], ["hit"], reward=1.0)
        assert brain.state.learning_rate < lr_before

    def test_exploration_rate_decays_after_update(self):
        brain = make_brain(exploration_rate=0.15)
        key = "15_7_H"
        brain.state.weights[key] = ActionWeights(hit=0.5, stand=0.4)
        eps_before = brain.state.exploration_rate
        brain.update_weights([key], ["hit"], reward=1.0)
        assert brain.state.exploration_rate <= eps_before
