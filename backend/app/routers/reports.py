import csv
from collections import defaultdict
from datetime import date, datetime, timedelta
from io import StringIO
from typing import Optional

from app.auth import require_manager
from app.database import get_db
from app.utils import utcnow
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


def _parse_dates(start_date: Optional[str], end_date: Optional[str]):
    """Parse ISO date strings; default to last 30 days."""
    if end_date:
        end_dt = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59)
    else:
        end_dt = utcnow()
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
    else:
        start_dt = end_dt - timedelta(days=30)
    return start_dt, end_dt


def _weekday_name(n: int) -> str:
    return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][n]


@router.get("/attendance")
def get_attendance_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _manager=Depends(require_manager),
):
    from app.models.booking import Booking
    from app.models.checkin import Checkin
    from app.models.class_template import ClassTemplate
    from app.models.scheduled_class import ScheduledClass

    start_dt, end_dt = _parse_dates(start_date, end_date)

    classes = (
        db.query(ScheduledClass)
        .filter(ScheduledClass.starts_at >= start_dt, ScheduledClass.starts_at <= end_dt)
        .all()
    )
    total_classes = len(classes)
    classes_cancelled = sum(1 for c in classes if c.status == "cancelled")
    classes_completed = sum(1 for c in classes if c.status == "completed")

    # Busiest day of week
    day_counts = defaultdict(int)
    for c in classes:
        day_counts[c.starts_at.weekday()] += 1
    if day_counts:
        busiest_day_num = max(day_counts, key=lambda k: day_counts[k])
        busiest_day = _weekday_name(busiest_day_num)
    else:
        busiest_day = None

    total_bookings = (
        db.query(Booking)
        .filter(
            Booking.created_at >= start_dt,
            Booking.created_at <= end_dt,
            Booking.status == "confirmed",
        )
        .count()
    )
    total_checkins = (
        db.query(Checkin)
        .filter(Checkin.checked_in_at >= start_dt, Checkin.checked_in_at <= end_dt)
        .count()
    )

    checkin_rate = round(total_checkins / total_bookings * 100, 1) if total_bookings else 0.0
    avg_class_size = round(total_bookings / total_classes, 1) if total_classes else 0.0

    # By class template
    template_ids = list({c.template_id for c in classes})
    by_template = []
    for tmpl_id in template_ids:
        tmpl = db.query(ClassTemplate).filter(ClassTemplate.id == tmpl_id).first()
        if not tmpl:
            continue
        tmpl_classes = [c for c in classes if c.template_id == tmpl_id]
        tmpl_class_ids = [c.id for c in tmpl_classes]
        tmpl_bookings = (
            db.query(Booking)
            .filter(
                Booking.scheduled_class_id.in_(tmpl_class_ids),
                Booking.status == "confirmed",
            )
            .count()
        )
        tmpl_checkins = (
            db.query(Checkin).filter(Checkin.scheduled_class_id.in_(tmpl_class_ids)).count()
        )
        by_template.append(
            {
                "template_name": tmpl.name,
                "classes": len(tmpl_classes),
                "bookings": tmpl_bookings,
                "checkins": tmpl_checkins,
            }
        )

    return {
        "period": {"start": start_dt.date().isoformat(), "end": end_dt.date().isoformat()},
        "total_classes": total_classes,
        "total_bookings": total_bookings,
        "total_checkins": total_checkins,
        "checkin_rate": checkin_rate,
        "avg_class_size": avg_class_size,
        "classes_cancelled": classes_cancelled,
        "classes_completed": classes_completed,
        "busiest_day": busiest_day,
        "by_class_template": by_template,
    }


@router.get("/revenue")
def get_revenue_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _manager=Depends(require_manager),
):
    from app.models.membership import Membership
    from app.models.membership_type import MembershipType
    from app.models.payment import Payment

    start_dt, end_dt = _parse_dates(start_date, end_date)

    payments = (
        db.query(Payment)
        .filter(
            Payment.paid_at >= start_dt,
            Payment.paid_at <= end_dt,
            Payment.status == "completed",
        )
        .all()
    )

    total_revenue = sum(p.amount for p in payments)
    payment_count = len(payments)
    avg_payment = round(total_revenue / payment_count, 2) if payment_count else 0.0

    # Currency: use first payment's currency or default EUR
    currency = payments[0].currency if payments else "EUR"

    # By provider
    by_provider: dict = defaultdict(float)
    for p in payments:
        by_provider[p.provider] += p.amount

    # By membership type
    type_revenue: dict = defaultdict(lambda: {"revenue": 0.0, "count": 0})
    for p in payments:
        if p.membership_id:
            membership = db.query(Membership).filter(Membership.id == p.membership_id).first()
            if membership:
                mtype = (
                    db.query(MembershipType)
                    .filter(MembershipType.id == membership.membership_type_id)
                    .first()
                )
                if mtype:
                    type_revenue[mtype.name]["revenue"] += p.amount
                    type_revenue[mtype.name]["count"] += 1

    by_membership_type = [
        {"name": name, "revenue": round(data["revenue"], 2), "count": data["count"]}
        for name, data in type_revenue.items()
    ]

    # Monthly trend — group by YYYY-MM
    monthly: dict = defaultdict(float)
    for p in payments:
        if p.paid_at:
            key = p.paid_at.strftime("%Y-%m")
            monthly[key] += p.amount
    monthly_trend = [
        {"month": month, "revenue": round(revenue, 2)} for month, revenue in sorted(monthly.items())
    ]

    return {
        "period": {"start": start_dt.date().isoformat(), "end": end_dt.date().isoformat()},
        "total_revenue": round(total_revenue, 2),
        "currency": currency,
        "payment_count": payment_count,
        "avg_payment": avg_payment,
        "by_provider": dict(by_provider),
        "by_membership_type": by_membership_type,
        "monthly_trend": monthly_trend,
    }


@router.get("/memberships")
def get_memberships_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _manager=Depends(require_manager),
):
    from app.models.membership import Membership
    from app.models.membership_type import MembershipType

    start_dt, end_dt = _parse_dates(start_date, end_date)

    all_memberships = db.query(Membership).all()
    total_active = sum(1 for m in all_memberships if m.status == "active")
    total_expired = sum(1 for m in all_memberships if m.status == "expired")
    total_cancelled = sum(1 for m in all_memberships if m.status == "cancelled")

    new_this_period = (
        db.query(Membership)
        .filter(Membership.created_at >= start_dt, Membership.created_at <= end_dt)
        .count()
    )

    # By type
    type_stats: dict = defaultdict(lambda: {"active": 0, "expired": 0})
    for m in all_memberships:
        mtype = db.query(MembershipType).filter(MembershipType.id == m.membership_type_id).first()
        if mtype:
            if m.status == "active":
                type_stats[mtype.name]["active"] += 1
            elif m.status == "expired":
                type_stats[mtype.name]["expired"] += 1

    by_type = [
        {"name": name, "active": data["active"], "expired": data["expired"]}
        for name, data in type_stats.items()
    ]

    from datetime import timedelta

    in_7_days = date.today() + timedelta(days=7)
    expiring_soon = sum(
        1
        for m in all_memberships
        if m.status == "active" and m.expires_at is not None and m.expires_at <= in_7_days
    )

    return {
        "period": {"start": start_dt.date().isoformat(), "end": end_dt.date().isoformat()},
        "total_active": total_active,
        "total_expired": total_expired,
        "total_cancelled": total_cancelled,
        "new_this_period": new_this_period,
        "expiring_soon": expiring_soon,
        "by_type": by_type,
    }


@router.get("/retention")
def get_retention_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _manager=Depends(require_manager),
):
    from app.models.booking import Booking
    from app.models.client import Client

    start_dt, end_dt = _parse_dates(start_date, end_date)

    total_clients = db.query(Client).filter(Client.is_active == True).count()  # noqa: E712

    # New clients created in period
    new_clients = (
        db.query(Client).filter(Client.created_at >= start_dt, Client.created_at <= end_dt).count()
    )

    # Active clients: had at least one confirmed booking in the period
    active_client_ids = (
        db.query(Booking.client_id)
        .filter(
            Booking.created_at >= start_dt,
            Booking.created_at <= end_dt,
            Booking.status == "confirmed",
        )
        .distinct()
        .all()
    )
    active_clients = len(active_client_ids)

    # Churned: had bookings before the period but none in the period
    had_before_ids = set(
        row[0]
        for row in db.query(Booking.client_id)
        .filter(Booking.created_at < start_dt, Booking.status == "confirmed")
        .distinct()
        .all()
    )
    had_in_period_ids = set(row[0] for row in active_client_ids)
    churned_clients = len(had_before_ids - had_in_period_ids)

    denominator = total_clients - new_clients
    retention_rate = round(active_clients / denominator * 100, 1) if denominator > 0 else 0.0

    return {
        "period": {"start": start_dt.date().isoformat(), "end": end_dt.date().isoformat()},
        "total_clients": total_clients,
        "active_clients": active_clients,
        "new_clients": new_clients,
        "churned_clients": churned_clients,
        "retention_rate": retention_rate,
    }


@router.get("/attendance/export")
def export_attendance_csv(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _manager=Depends(require_manager),
):
    from app.models.booking import Booking
    from app.models.checkin import Checkin
    from app.models.class_template import ClassTemplate
    from app.models.instructor import Instructor
    from app.models.scheduled_class import ScheduledClass
    from app.models.user import User

    start_dt, end_dt = _parse_dates(start_date, end_date)

    classes = (
        db.query(ScheduledClass)
        .filter(ScheduledClass.starts_at >= start_dt, ScheduledClass.starts_at <= end_dt)
        .all()
    )

    headers = ["date", "class_name", "instructor", "capacity", "bookings", "checkins", "status"]
    rows = []
    for sc in classes:
        tmpl = db.query(ClassTemplate).filter(ClassTemplate.id == sc.template_id).first()
        class_name = tmpl.name if tmpl else ""

        instructor_name = ""
        if sc.instructor_id:
            instructor = db.query(Instructor).filter(Instructor.id == sc.instructor_id).first()
            if instructor:
                user = db.query(User).filter(User.id == instructor.user_id).first()
                if user:
                    instructor_name = user.full_name

        booking_count = (
            db.query(Booking)
            .filter(Booking.scheduled_class_id == sc.id, Booking.status == "confirmed")
            .count()
        )
        checkin_count = db.query(Checkin).filter(Checkin.scheduled_class_id == sc.id).count()
        rows.append(
            [
                sc.starts_at.date().isoformat(),
                class_name,
                instructor_name,
                sc.capacity,
                booking_count,
                checkin_count,
                sc.status,
            ]
        )

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance.csv"},
    )


@router.get("/revenue/export")
def export_revenue_csv(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _manager=Depends(require_manager),
):
    from app.models.client import Client
    from app.models.membership import Membership
    from app.models.membership_type import MembershipType
    from app.models.payment import Payment

    start_dt, end_dt = _parse_dates(start_date, end_date)

    payments = (
        db.query(Payment)
        .filter(
            Payment.paid_at >= start_dt,
            Payment.paid_at <= end_dt,
            Payment.status == "completed",
        )
        .all()
    )

    headers = ["date", "client_name", "membership_type", "amount", "currency", "provider", "status"]
    rows = []
    for p in payments:
        c = db.query(Client).filter(Client.id == p.client_id).first()
        client_name = c.full_name if c else ""

        mtype_name = ""
        if p.membership_id:
            m = db.query(Membership).filter(Membership.id == p.membership_id).first()
            if m:
                mt = (
                    db.query(MembershipType)
                    .filter(MembershipType.id == m.membership_type_id)
                    .first()
                )
                if mt:
                    mtype_name = mt.name

        rows.append(
            [
                p.paid_at.date().isoformat() if p.paid_at else "",
                client_name,
                mtype_name,
                p.amount,
                p.currency,
                p.provider,
                p.status,
            ]
        )

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=revenue.csv"},
    )
