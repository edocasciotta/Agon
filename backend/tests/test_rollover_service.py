"""Tests for the rollover credits service."""

import datetime

import pytest
from app.models.membership import Membership
from app.models.membership_type import MembershipType
from app.services.rollover_service import process_rollover


@pytest.fixture
def recurring_mt_rollover(db_session):
    """A recurring membership type with rollover enabled and a cap of 2."""
    mt = MembershipType(
        name="Monthly Yoga",
        type="recurring",
        price=50.0,
        billing_interval="monthly",
        credits_included=10,
        credits_per_interval=10,
        unlimited=False,
        rollover_enabled=True,
        max_rollover_credits=2,
        is_active=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


@pytest.fixture
def recurring_mt_rollover_uncapped(db_session):
    """A recurring membership type with rollover enabled and no cap."""
    mt = MembershipType(
        name="Monthly Pilates",
        type="recurring",
        price=60.0,
        billing_interval="monthly",
        credits_included=10,
        credits_per_interval=10,
        unlimited=False,
        rollover_enabled=True,
        max_rollover_credits=None,
        is_active=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


@pytest.fixture
def recurring_mt_no_rollover(db_session):
    """A recurring membership type with rollover disabled."""
    mt = MembershipType(
        name="Monthly HIIT",
        type="recurring",
        price=40.0,
        billing_interval="monthly",
        credits_included=8,
        credits_per_interval=8,
        unlimited=False,
        rollover_enabled=False,
        is_active=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


@pytest.fixture
def unlimited_mt(db_session):
    """An unlimited membership type."""
    mt = MembershipType(
        name="Unlimited Monthly",
        type="recurring",
        price=100.0,
        billing_interval="monthly",
        unlimited=True,
        rollover_enabled=True,  # even if enabled, should be ignored
        is_active=True,
    )
    db_session.add(mt)
    db_session.commit()
    db_session.refresh(mt)
    return mt


def _make_membership(db_session, mt, credits_remaining, credits_used=0):
    """Helper to create a membership for testing."""
    from app.auth import hash_password
    from app.models.client import Client

    # Create a client for the membership
    client = Client(
        email=f"rollover-{mt.id}-{credits_remaining}@test.com",
        password_hash=hash_password("testpass123"),
        full_name="Test Rollover",
        is_active=True,
    )
    db_session.add(client)
    db_session.commit()

    m = Membership(
        client_id=client.id,
        membership_type_id=mt.id,
        status="active",
        starts_at=datetime.date.today(),
        credits_remaining=credits_remaining,
        credits_used=credits_used,
        rollover_credits=0,
    )
    db_session.add(m)
    db_session.commit()
    db_session.refresh(m)
    return m


def test_rollover_with_cap(db_session, recurring_mt_rollover):
    """3 credits remaining, max_rollover is 2 -> new cycle gets 10 + 2 = 12."""
    m = _make_membership(db_session, recurring_mt_rollover, credits_remaining=3, credits_used=7)

    rolled = process_rollover(db_session, m)

    assert rolled == 2
    assert m.rollover_credits == 2
    assert m.credits_remaining == 12  # 10 (per_interval) + 2 (rollover)
    assert m.credits_used == 0


def test_rollover_without_cap(db_session, recurring_mt_rollover_uncapped):
    """5 credits remaining, no cap -> new cycle gets 10 + 5 = 15."""
    m = _make_membership(
        db_session, recurring_mt_rollover_uncapped, credits_remaining=5, credits_used=5
    )

    rolled = process_rollover(db_session, m)

    assert rolled == 5
    assert m.rollover_credits == 5
    assert m.credits_remaining == 15  # 10 + 5
    assert m.credits_used == 0


def test_rollover_disabled(db_session, recurring_mt_no_rollover):
    """3 credits remaining, rollover disabled -> returns 0, no changes to credits."""
    m = _make_membership(db_session, recurring_mt_no_rollover, credits_remaining=3, credits_used=5)

    rolled = process_rollover(db_session, m)

    assert rolled == 0
    # process_rollover does NOT reset credits when disabled -- caller handles that
    assert m.credits_remaining == 3  # unchanged by process_rollover
    assert m.credits_used == 5  # unchanged


def test_rollover_zero_remaining(db_session, recurring_mt_rollover):
    """0 credits remaining -> rollover is 0, credits reset to base."""
    m = _make_membership(db_session, recurring_mt_rollover, credits_remaining=0, credits_used=10)

    rolled = process_rollover(db_session, m)

    assert rolled == 0
    assert m.rollover_credits == 0
    assert m.credits_remaining == 10  # just the base credits_per_interval
    assert m.credits_used == 0


def test_rollover_unlimited_membership(db_session, unlimited_mt):
    """Unlimited memberships should not roll over credits."""
    m = _make_membership(db_session, unlimited_mt, credits_remaining=None, credits_used=0)

    rolled = process_rollover(db_session, m)

    assert rolled == 0
    assert m.rollover_credits == 0
    assert m.credits_remaining is None  # unchanged


def test_rollover_remaining_less_than_cap(db_session, recurring_mt_rollover):
    """1 credit remaining, cap is 2 -> rollover is 1 (min of remaining and cap)."""
    m = _make_membership(db_session, recurring_mt_rollover, credits_remaining=1, credits_used=9)

    rolled = process_rollover(db_session, m)

    assert rolled == 1
    assert m.rollover_credits == 1
    assert m.credits_remaining == 11  # 10 + 1
    assert m.credits_used == 0
