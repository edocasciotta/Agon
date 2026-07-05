"""Tests for Stripe billing data models (Phase 1: schema + config)."""

import os

os.environ["AGON_ENV"] = "test"

import app.models  # noqa — registers all models with Base.metadata
import pytest
from app.database import Base
from app.models.membership_type import MembershipType
from app.models.stripe_checkout_session import StripeCheckoutSession
from app.models.stripe_customer import StripeCustomer
from app.models.stripe_price import StripePrice
from app.models.stripe_subscription import StripeSubscription
from app.models.stripe_webhook_event import StripeWebhookEvent
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture(scope="module")
def engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture(scope="module")
def db(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


# ---------------------------------------------------------------------------
# Table-existence tests
# ---------------------------------------------------------------------------


def test_stripe_customers_table_exists(engine):
    insp = inspect(engine)
    assert "stripe_customers" in insp.get_table_names()


def test_stripe_prices_table_exists(engine):
    insp = inspect(engine)
    assert "stripe_prices" in insp.get_table_names()


def test_stripe_subscriptions_table_exists(engine):
    insp = inspect(engine)
    assert "stripe_subscriptions" in insp.get_table_names()


def test_stripe_checkout_sessions_table_exists(engine):
    insp = inspect(engine)
    assert "stripe_checkout_sessions" in insp.get_table_names()


def test_stripe_webhook_events_table_exists(engine):
    insp = inspect(engine)
    assert "stripe_webhook_events" in insp.get_table_names()


# ---------------------------------------------------------------------------
# Query-each-table (no error == table accessible)
# ---------------------------------------------------------------------------


def test_query_stripe_customers(db):
    result = db.query(StripeCustomer).all()
    assert isinstance(result, list)


def test_query_stripe_prices(db):
    result = db.query(StripePrice).all()
    assert isinstance(result, list)


def test_query_stripe_subscriptions(db):
    result = db.query(StripeSubscription).all()
    assert isinstance(result, list)


def test_query_stripe_checkout_sessions(db):
    result = db.query(StripeCheckoutSession).all()
    assert isinstance(result, list)


def test_query_stripe_webhook_events(db):
    result = db.query(StripeWebhookEvent).all()
    assert isinstance(result, list)


# ---------------------------------------------------------------------------
# MembershipType.sellable_online defaults to False
# ---------------------------------------------------------------------------


def test_membership_type_sellable_online_default(db):
    mt = MembershipType(
        name="Test Pack",
        type="credit_pack",
        price=50.0,
        credits_included=5,
        is_active=True,
    )
    db.add(mt)
    db.commit()
    db.refresh(mt)
    assert mt.sellable_online is False


def test_membership_type_sellable_online_can_be_set_true(db):
    mt = MembershipType(
        name="Online Pack",
        type="credit_pack",
        price=60.0,
        credits_included=6,
        is_active=True,
        sellable_online=True,
    )
    db.add(mt)
    db.commit()
    db.refresh(mt)
    assert mt.sellable_online is True
