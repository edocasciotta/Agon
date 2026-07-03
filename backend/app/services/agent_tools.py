"""Entity resolution and execution logic for the AI action agent.

The LLM only extracts natural-language slots (names, dates, times) via
tool calling — it never sees or invents database IDs. This module resolves
those slots deterministically against the database and only executes a
mutation once every required field is unambiguously resolved.

Read tools allow the agent to query live studio data (class types,
instructors, locations, clients, scheduled classes, membership types)
so it can answer data questions with real information instead of hallucinating.
"""

import difflib
import json
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Generic, Optional, TypeVar

from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.checkin import Checkin
from app.models.class_template import ClassTemplate
from app.models.client import Client
from app.models.instructor import Instructor
from app.models.location import Location
from app.models.membership import Membership
from app.models.membership_type import MembershipType
from app.models.scheduled_class import ScheduledClass
from app.models.user import User
from app.utils import utcnow

T = TypeVar("T")

# ─── Localised agent messages ───────────────────────────────────────────────
# Keys: snake_case placeholder names. Values: per-lang strings.
# Only the strings that come from tool handlers (bypassing the LLM) need
# to be translated here — LLM-generated replies are controlled by the
# system-prompt language rule.

_MSG: dict[str, dict[str, str]] = {
    "class_type_ambiguous": {
        "en": "Multiple class types match. Which one do you mean: {options}?",
        "it": "Ci sono più tipi di classe che corrispondono. Quale intendi: {options}?",
        "fr": "Plusieurs types de cours correspondent. Lequel voulez-vous dire : {options} ?",
        "de": "Mehrere Kurstypen stimmen überein. Welchen meinen Sie: {options}?",
        "es": "Varios tipos de clase coinciden. ¿Cuál quiere decir: {options}?",
        "pt": "Vários tipos de aula correspondem. Qual você quer dizer: {options}?",
        "nl": "Meerdere les types komen overeen. Welke bedoelt u: {options}?",
    },
    "class_type_missing": {
        "en": "What type of class do you want to create? Available types: {options}.",
        "it": "Che tipo di classe vuoi creare? Tipi disponibili: {options}.",
        "fr": "Quel type de cours voulez-vous créer ? Types disponibles : {options}.",
        "de": "Welchen Kurstyp möchten Sie erstellen? Verfügbare Typen: {options}.",
        "es": "¿Qué tipo de clase quiere crear? Tipos disponibles: {options}.",
        "pt": "Que tipo de aula você quer criar? Tipos disponíveis: {options}.",
        "nl": "Welk type les wilt u aanmaken? Beschikbare typen: {options}.",
    },
    "location_ambiguous": {
        "en": "Multiple locations match. Which one do you mean: {options}?",
        "it": "Ci sono più sedi che corrispondono. Quale intendi: {options}?",
        "fr": "Plusieurs lieux correspondent. Lequel voulez-vous dire : {options} ?",
        "de": "Mehrere Standorte stimmen überein. Welchen meinen Sie: {options}?",
        "es": "Varias ubicaciones coinciden. ¿Cuál quiere decir: {options}?",
        "pt": "Vários locais correspondem. Qual você quer dizer: {options}?",
        "nl": "Meerdere locaties komen overeen. Welke bedoelt u: {options}?",
    },
    "location_missing": {
        "en": "Which location? Available locations: {options}.",
        "it": "In quale sede? Sedi disponibili: {options}.",
        "fr": "Quel lieu ? Lieux disponibles : {options}.",
        "de": "Welcher Standort? Verfügbare Standorte: {options}.",
        "es": "¿Qué ubicación? Ubicaciones disponibles: {options}.",
        "pt": "Qual local? Locais disponíveis: {options}.",
        "nl": "Welke locatie? Beschikbare locaties: {options}.",
    },
    "instructor_ambiguous": {
        "en": "Multiple instructors match. Which one do you mean: {options}?",
        "it": "Ci sono più istruttori che corrispondono. Quale intendi: {options}?",
        "fr": "Plusieurs instructeurs correspondent. Lequel voulez-vous dire : {options} ?",
        "de": "Mehrere Kursleiter stimmen überein. Welchen meinen Sie: {options}?",
        "es": "Varios instructores coinciden. ¿Cuál quiere decir: {options}?",
        "pt": "Vários instrutores correspondem. Qual você quer dizer: {options}?",
        "nl": "Meerdere instructeurs komen overeen. Welke bedoelt u: {options}?",
    },
    "instructor_not_found": {
        "en": "I can't find an instructor named '{name}'. Can you check the name?",
        "it": "Non trovo un istruttore chiamato '{name}'. Puoi controllare il nome?",
        "fr": "Je ne trouve pas d'instructeur nommé '{name}'. Pouvez-vous vérifier le nom ?",
        "de": "Ich finde keinen Kursleiter namens '{name}'. Können Sie den Namen prüfen?",
        "es": "No encuentro un instructor llamado '{name}'. ¿Puede comprobar el nombre?",
        "pt": "Não encontro um instrutor chamado '{name}'. Pode verificar o nome?",
        "nl": "Ik kan geen instructeur vinden met de naam '{name}'. Kunt u de naam controleren?",
    },
    "date_missing": {
        "en": "What date do you want the class on? (e.g. 'next Wednesday' or an exact date)",
        "it": "Per quale data vuoi creare la classe? (es. 'mercoledì prossimo' o una data precisa)",
        "fr": "Pour quelle date voulez-vous le cours ? (ex. 'mercredi prochain' ou une date précise)",
        "de": "Für welches Datum möchten Sie den Kurs? (z.B. 'nächsten Mittwoch' oder ein genaues Datum)",
        "es": "¿Para qué fecha quiere la clase? (ej. 'el próximo miércoles' o una fecha exacta)",
        "pt": "Para qual data você quer a aula? (ex. 'próxima quarta-feira' ou uma data exata)",
        "nl": "Voor welke datum wilt u de les? (bijv. 'volgende woensdag' of een exacte datum)",
    },
    "time_missing": {
        "en": "What time should the class start?",
        "it": "A che ora deve iniziare la classe?",
        "fr": "À quelle heure le cours doit-il commencer ?",
        "de": "Um wie viel Uhr soll der Kurs beginnen?",
        "es": "¿A qué hora debe empezar la clase?",
        "pt": "A que horas deve começar a aula?",
        "nl": "Hoe laat moet de les beginnen?",
    },
    "date_in_past": {
        "en": "The date/time you specified is in the past. Can you provide a future one?",
        "it": "La data/ora indicata è nel passato. Puoi indicarne una futura?",
        "fr": "La date/heure indiquée est dans le passé. Pouvez-vous en indiquer une future ?",
        "de": "Das angegebene Datum/Uhrzeit liegt in der Vergangenheit. Können Sie ein zukünftiges angeben?",
        "es": "La fecha/hora indicada está en el pasado. ¿Puede indicar una futura?",
        "pt": "A data/hora indicada está no passado. Pode indicar uma futura?",
        "nl": "De opgegeven datum/tijd ligt in het verleden. Kunt u een toekomstige opgeven?",
    },
    "class_created": {
        "en": 'Done. I created "{name}" for {date} at {time}, location {location}{instructor}, capacity {capacity}.',
        "it": 'Fatto. Ho creato "{name}" per {date} alle {time}, sede {location}{instructor}, capienza {capacity}.',
        "fr": 'Fait. J\'ai créé "{name}" pour le {date} à {time}, lieu {location}{instructor}, capacité {capacity}.',
        "de": 'Erledigt. Ich habe "{name}" für {date} um {time} Uhr erstellt, Standort {location}{instructor}, Kapazität {capacity}.',
        "es": 'Listo. He creado "{name}" para el {date} a las {time}, sede {location}{instructor}, capacidad {capacity}.',
        "pt": 'Feito. Criei "{name}" para {date} às {time}, local {location}{instructor}, capacidade {capacity}.',
        "nl": 'Klaar. Ik heb "{name}" aangemaakt voor {date} om {time}, locatie {location}{instructor}, capaciteit {capacity}.',
    },
    "instructor_suffix": {
        "en": ", instructor {name}",
        "it": ", istruttore {name}",
        "fr": ", instructeur {name}",
        "de": ", Kursleiter {name}",
        "es": ", instructor {name}",
        "pt": ", instrutor {name}",
        "nl": ", instructeur {name}",
    },
}


_MSG.update(
    {
        "client_not_found": {
            "en": "I can't find a client matching '{name}'. Can you check the name or email?",
            "it": "Non trovo un cliente corrispondente a '{name}'. Puoi controllare il nome o la mail?",
            "fr": "Je ne trouve pas de client correspondant à '{name}'. Pouvez-vous vérifier le nom ou l'email ?",
            "de": "Ich finde keinen Kunden mit '{name}'. Können Sie den Namen oder die E-Mail prüfen?",
            "es": "No encuentro un cliente que coincida con '{name}'. ¿Puede verificar el nombre o el email?",
            "pt": "Não encontro um cliente correspondente a '{name}'. Pode verificar o nome ou o email?",
            "nl": "Ik kan geen klant vinden die overeenkomt met '{name}'. Kunt u de naam of het e-mailadres controleren?",
        },
        "client_ambiguous": {
            "en": "Multiple clients match '{name}'. Which one did you mean: {options}?",
            "it": "Più clienti corrispondono a '{name}'. Quale intendi: {options}?",
            "fr": "Plusieurs clients correspondent à '{name}'. Lequel vouliez-vous dire : {options} ?",
            "de": "Mehrere Kunden stimmen mit '{name}' überein. Welchen meinten Sie: {options}?",
            "es": "Varios clientes coinciden con '{name}'. ¿A cuál se refería: {options}?",
            "pt": "Vários clientes correspondem a '{name}'. Qual você quis dizer: {options}?",
            "nl": "Meerdere klanten komen overeen met '{name}'. Welke bedoelde u: {options}?",
        },
        "client_missing": {
            "en": "Which client? Please provide a name or email.",
            "it": "Quale cliente? Indica un nome o una mail.",
            "fr": "Quel client ? Veuillez indiquer un nom ou un email.",
            "de": "Welcher Kunde? Bitte geben Sie einen Namen oder eine E-Mail an.",
            "es": "¿Qué cliente? Proporcione un nombre o email.",
            "pt": "Qual cliente? Por favor, forneça um nome ou email.",
            "nl": "Welke klant? Geef een naam of e-mailadres op.",
        },
        "class_not_found_for_action": {
            "en": "I can't find a matching class. Please specify the class type, date, and time.",
            "it": "Non trovo la classe corrispondente. Specifica tipo, data e ora della classe.",
            "fr": "Je ne trouve pas le cours correspondant. Veuillez préciser le type, la date et l'heure.",
            "de": "Ich finde den passenden Kurs nicht. Bitte geben Sie Kurstyp, Datum und Uhrzeit an.",
            "es": "No encuentro la clase correspondiente. Especifique el tipo, fecha y hora.",
            "pt": "Não encontro a aula correspondente. Especifique o tipo, data e hora.",
            "nl": "Ik kan de bijpassende les niet vinden. Geef het lestype, de datum en de tijd op.",
        },
        "class_ambiguous_time": {
            "en": "Multiple {class_type} classes on {date}. Which time: {options}?",
            "it": "Più classi {class_type} il {date}. A che ora: {options}?",
            "fr": "Plusieurs cours {class_type} le {date}. À quelle heure : {options} ?",
            "de": "Mehrere {class_type}-Kurse am {date}. Welche Uhrzeit: {options}?",
            "es": "Varias clases {class_type} el {date}. ¿A qué hora: {options}?",
            "pt": "Várias aulas {class_type} em {date}. Qual horário: {options}?",
            "nl": "Meerdere {class_type} lessen op {date}. Welk tijdstip: {options}?",
        },
        "booking_created": {
            "en": 'Done. {client} is booked for "{class_type}" on {date} at {time}.',
            "it": 'Fatto. {client} è prenotato/a per "{class_type}" il {date} alle {time}.',
            "fr": 'Fait. {client} est inscrit(e) à "{class_type}" le {date} à {time}.',
            "de": 'Erledigt. {client} ist für "{class_type}" am {date} um {time} Uhr eingebucht.',
            "es": 'Listo. {client} está reservado/a para "{class_type}" el {date} a las {time}.',
            "pt": 'Feito. {client} está reservado/a para "{class_type}" em {date} às {time}.',
            "nl": 'Klaar. {client} is geboekt voor "{class_type}" op {date} om {time}.',
        },
        "booking_class_full": {
            "en": 'The "{class_type}" class on {date} at {time} is full ({booked}/{capacity} spots taken).',
            "it": 'La classe "{class_type}" del {date} alle {time} è piena ({booked}/{capacity} posti occupati).',
            "fr": 'Le cours "{class_type}" du {date} à {time} est complet ({booked}/{capacity} places prises).',
            "de": 'Der "{class_type}"-Kurs am {date} um {time} ist voll ({booked}/{capacity} Plätze belegt).',
            "es": 'La clase "{class_type}" del {date} a las {time} está llena ({booked}/{capacity} plazas ocupadas).',
            "pt": 'A aula "{class_type}" em {date} às {time} está cheia ({booked}/{capacity} vagas ocupadas).',
            "nl": 'De "{class_type}" les op {date} om {time} is vol ({booked}/{capacity} plaatsen bezet).',
        },
        "booking_duplicate": {
            "en": "{client} is already booked for this class.",
            "it": "{client} è già prenotato/a per questa classe.",
            "fr": "{client} est déjà inscrit(e) à ce cours.",
            "de": "{client} ist bereits für diesen Kurs eingebucht.",
            "es": "{client} ya está reservado/a para esta clase.",
            "pt": "{client} já está reservado/a para esta aula.",
            "nl": "{client} is al geboekt voor deze les.",
        },
        "booking_no_membership": {
            "en": "{client} has no active membership or credits. Assign a membership plan first.",
            "it": "{client} non ha un abbonamento attivo o crediti. Assegna prima un piano.",
            "fr": "{client} n'a pas d'abonnement actif ni de crédits. Assignez d'abord un plan.",
            "de": "{client} hat keine aktive Mitgliedschaft oder Credits. Weisen Sie zuerst ein Abo zu.",
            "es": "{client} no tiene membresía activa ni créditos. Asigne primero un plan.",
            "pt": "{client} não tem assinatura ativa ou créditos. Atribua primeiro um plano.",
            "nl": "{client} heeft geen actief lidmaatschap of credits. Wijs eerst een plan toe.",
        },
        "booking_not_found": {
            "en": "No confirmed booking found for {client} in {class_type} on {date}.",
            "it": "Nessuna prenotazione confermata trovata per {client} in {class_type} il {date}.",
            "fr": "Aucune réservation confirmée trouvée pour {client} dans {class_type} le {date}.",
            "de": "Keine bestätigte Buchung für {client} in {class_type} am {date} gefunden.",
            "es": "No se encontró reserva confirmada para {client} en {class_type} el {date}.",
            "pt": "Nenhuma reserva confirmada encontrada para {client} em {class_type} em {date}.",
            "nl": "Geen bevestigde boeking gevonden voor {client} in {class_type} op {date}.",
        },
        "booking_cancelled": {
            "en": "Cancelled {client}'s booking for {class_type} on {date} at {time}.",
            "it": "Prenotazione di {client} per {class_type} del {date} alle {time} cancellata.",
            "fr": "Réservation de {client} pour {class_type} le {date} à {time} annulée.",
            "de": "Buchung von {client} für {class_type} am {date} um {time} Uhr storniert.",
            "es": "Reserva de {client} para {class_type} el {date} a las {time} cancelada.",
            "pt": "Reserva de {client} para {class_type} em {date} às {time} cancelada.",
            "nl": "Boeking van {client} voor {class_type} op {date} om {time} geannuleerd.",
        },
        "checkin_done": {
            "en": "Checked in {client} for {class_type} on {date} at {time}.",
            "it": "Check-in effettuato per {client} alla classe {class_type} del {date} alle {time}.",
            "fr": "Présence enregistrée pour {client} au cours {class_type} du {date} à {time}.",
            "de": "Check-in für {client} im Kurs {class_type} am {date} um {time} Uhr durchgeführt.",
            "es": "Check-in realizado para {client} en la clase {class_type} del {date} a las {time}.",
            "pt": "Check-in realizado para {client} na aula {class_type} em {date} às {time}.",
            "nl": "Ingecheckt {client} voor {class_type} op {date} om {time}.",
        },
        "checkin_already": {
            "en": "{client} is already checked in for this class.",
            "it": "{client} è già registrato/a per questa classe.",
            "fr": "{client} est déjà enregistré(e) pour ce cours.",
            "de": "{client} ist bereits für diesen Kurs eingecheckt.",
            "es": "{client} ya tiene check-in en esta clase.",
            "pt": "{client} já fez check-in para esta aula.",
            "nl": "{client} is al ingecheckt voor deze les.",
        },
        "checkin_no_booking": {
            "en": "{client} has no confirmed booking for this class. Book them first.",
            "it": "{client} non ha una prenotazione confermata per questa classe. Prima prenotalo/a.",
            "fr": "{client} n'a pas de réservation confirmée pour ce cours. Réservez d'abord.",
            "de": "{client} hat keine bestätigte Buchung für diesen Kurs. Erst buchen.",
            "es": "{client} no tiene reserva confirmada para esta clase. Resérvela primero.",
            "pt": "{client} não tem reserva confirmada para esta aula. Reserve primeiro.",
            "nl": "{client} heeft geen bevestigde boeking voor deze les. Boek eerst.",
        },
        "client_created": {
            "en": 'Client "{name}" ({email}) created successfully.',
            "it": 'Cliente "{name}" ({email}) creato con successo.',
            "fr": 'Client "{name}" ({email}) créé avec succès.',
            "de": 'Kunde "{name}" ({email}) erfolgreich erstellt.',
            "es": 'Cliente "{name}" ({email}) creado correctamente.',
            "pt": 'Cliente "{name}" ({email}) criado com sucesso.',
            "nl": 'Klant "{name}" ({email}) succesvol aangemaakt.',
        },
        "client_email_duplicate": {
            "en": "A client with email {email} already exists.",
            "it": "Esiste già un cliente con la mail {email}.",
            "fr": "Un client avec l'email {email} existe déjà.",
            "de": "Ein Kunde mit der E-Mail {email} existiert bereits.",
            "es": "Ya existe un cliente con el email {email}.",
            "pt": "Já existe um cliente com o email {email}.",
            "nl": "Er bestaat al een klant met het e-mailadres {email}.",
        },
        "client_name_missing": {
            "en": "Please provide the client's full name.",
            "it": "Indica il nome completo del cliente.",
            "fr": "Veuillez indiquer le nom complet du client.",
            "de": "Bitte geben Sie den vollständigen Namen des Kunden an.",
            "es": "Por favor, proporcione el nombre completo del cliente.",
            "pt": "Por favor, forneça o nome completo do cliente.",
            "nl": "Geef de volledige naam van de klant op.",
        },
        "client_email_missing": {
            "en": "Please provide the client's email address.",
            "it": "Indica l'indirizzo mail del cliente.",
            "fr": "Veuillez indiquer l'adresse email du client.",
            "de": "Bitte geben Sie die E-Mail-Adresse des Kunden an.",
            "es": "Por favor, proporcione el email del cliente.",
            "pt": "Por favor, forneça o email do cliente.",
            "nl": "Geef het e-mailadres van de klant op.",
        },
        "membership_assigned": {
            "en": '"{plan}" assigned to {client}. Active from {starts_at}{expires}.',
            "it": '"{plan}" assegnato a {client}. Attivo dal {starts_at}{expires}.',
            "fr": '"{plan}" assigné à {client}. Actif du {starts_at}{expires}.',
            "de": '"{plan}" an {client} vergeben. Aktiv ab {starts_at}{expires}.',
            "es": '"{plan}" asignado a {client}. Activo desde {starts_at}{expires}.',
            "pt": '"{plan}" atribuído a {client}. Ativo a partir de {starts_at}{expires}.',
            "nl": '"{plan}" toegewezen aan {client}. Actief vanaf {starts_at}{expires}.',
        },
        "membership_expires_suffix": {
            "en": ", expires {date}",
            "it": ", scade il {date}",
            "fr": ", expire le {date}",
            "de": ", läuft ab am {date}",
            "es": ", vence el {date}",
            "pt": ", expira em {date}",
            "nl": ", verloopt op {date}",
        },
        "membership_type_not_found": {
            "en": "I can't find a plan matching '{name}'. Available plans: {options}.",
            "it": "Non trovo un piano corrispondente a '{name}'. Piani disponibili: {options}.",
            "fr": "Je ne trouve pas de plan correspondant à '{name}'. Plans disponibles : {options}.",
            "de": "Ich finde kein Abo passend zu '{name}'. Verfügbare Pläne: {options}.",
            "es": "No encuentro un plan que coincida con '{name}'. Planes disponibles: {options}.",
            "pt": "Não encontro um plano correspondente a '{name}'. Planos disponíveis: {options}.",
            "nl": "Ik kan geen plan vinden dat overeenkomt met '{name}'. Beschikbare plannen: {options}.",
        },
        "membership_type_missing": {
            "en": "Which membership plan? Available plans: {options}.",
            "it": "Quale piano di abbonamento? Piani disponibili: {options}.",
            "fr": "Quel plan d'abonnement ? Plans disponibles : {options}.",
            "de": "Welches Abo? Verfügbare Pläne: {options}.",
            "es": "¿Qué plan de membresía? Planes disponibles: {options}.",
            "pt": "Qual plano de assinatura? Planos disponíveis: {options}.",
            "nl": "Welk lidmaatschapsplan? Beschikbare plannen: {options}.",
        },
        "roster_result": {
            "en": '"{class_type}" on {date} at {time} — {booked}/{capacity} spots taken:\n{list}',
            "it": '"{class_type}" del {date} alle {time} — {booked}/{capacity} posti occupati:\n{list}',
            "fr": '"{class_type}" du {date} à {time} — {booked}/{capacity} places prises :\n{list}',
            "de": '"{class_type}" am {date} um {time} — {booked}/{capacity} Plätze belegt:\n{list}',
            "es": '"{class_type}" del {date} a las {time} — {booked}/{capacity} plazas ocupadas:\n{list}',
            "pt": '"{class_type}" em {date} às {time} — {booked}/{capacity} vagas ocupadas:\n{list}',
            "nl": '"{class_type}" op {date} om {time} — {booked}/{capacity} plaatsen bezet:\n{list}',
        },
        "roster_empty": {
            "en": 'No bookings yet for "{class_type}" on {date} at {time}.',
            "it": 'Nessuna prenotazione ancora per "{class_type}" del {date} alle {time}.',
            "fr": 'Aucune réservation pour "{class_type}" du {date} à {time}.',
            "de": 'Noch keine Buchungen für "{class_type}" am {date} um {time}.',
            "es": 'Sin reservas para "{class_type}" del {date} a las {time}.',
            "pt": 'Sem reservas para "{class_type}" em {date} às {time}.',
            "nl": 'Nog geen boekingen voor "{class_type}" op {date} om {time}.',
        },
    }
)


def _m(key: str, lang: str, **kwargs: str) -> str:
    """Look up a localised message and format it with kwargs."""
    translations = _MSG.get(key, {})
    template = translations.get(lang) or translations.get("en", key)
    return template.format(**kwargs) if kwargs else template


_WEEKDAYS_EN = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]
_WEEKDAYS_IT = [
    "lunedì",
    "martedì",
    "mercoledì",
    "giovedì",
    "venerdì",
    "sabato",
    "domenica",
]


@dataclass
class ResolveResult(Generic[T]):
    """Result of resolving a natural-language name against the database."""

    value: Optional[T] = None
    candidates: list[str] = field(default_factory=list)
    status: str = "resolved"  # resolved | not_found | ambiguous | not_specified


CREATE_CLASS_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "create_class",
        "description": (
            "Schedule a new class. Extract each field from the user's message as plain "
            "natural-language text — do NOT invent IDs, do NOT guess a date if unsure. "
            "Leave a field empty/omit it if the user did not mention it."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "class_type": {
                    "type": "string",
                    "description": "The class type/template name mentioned, e.g. 'Yoga Flow'. Omit if not mentioned.",
                },
                "location": {
                    "type": "string",
                    "description": "The studio location name mentioned, e.g. 'Milano'. Omit if not mentioned.",
                },
                "instructor": {
                    "type": "string",
                    "description": "The instructor name mentioned. Omit if not mentioned.",
                },
                "date": {
                    "type": "string",
                    "description": (
                        "The class date normalized to YYYY-MM-DD, computed using the "
                        "current date given in the system prompt. If you cannot compute "
                        "a confident date, leave this empty rather than guessing."
                    ),
                },
                "start_time": {
                    "type": "string",
                    "description": "Start time in 24h HH:MM format, e.g. '18:00'. Omit if not mentioned.",
                },
                "duration_minutes": {
                    "type": "string",
                    "description": "Class duration in minutes as a number, e.g. '60' for '1 hour'. Omit if not mentioned.",
                },
                "capacity": {
                    "type": "string",
                    "description": "Maximum number of clients. Omit if not mentioned.",
                },
                "notes": {
                    "type": "string",
                    "description": "Free-text notes for this class (e.g. 'bring a mat'). Omit if not mentioned.",
                },
            },
            "required": [],
        },
    },
}


def _best_match(text: str, options: dict[str, T]) -> ResolveResult[T]:
    """Match free text against a name -> value map: exact, then substring, then fuzzy."""
    if not options:
        return ResolveResult(status="not_found")

    normalized = text.strip().lower()
    names = list(options.keys())

    exact = [n for n in names if n.lower() == normalized]
    if len(exact) == 1:
        return ResolveResult(value=options[exact[0]], status="resolved")

    # Query is a substring of the option name ("yoga" → "Yoga Flow")
    # OR option name is a substring of the query ("Pack" → "Piano Pack", "Abbonamento Pack")
    substring = [n for n in names if normalized in n.lower() or n.lower() in normalized]
    if len(substring) == 1:
        return ResolveResult(value=options[substring[0]], status="resolved")
    if len(substring) > 1:
        return ResolveResult(candidates=substring, status="ambiguous")

    close = difflib.get_close_matches(normalized, [n.lower() for n in names], n=3, cutoff=0.6)
    matched_names = [n for n in names if n.lower() in close]
    if len(matched_names) == 1:
        return ResolveResult(value=options[matched_names[0]], status="resolved")
    if len(matched_names) > 1:
        return ResolveResult(candidates=matched_names, status="ambiguous")

    return ResolveResult(status="not_found", candidates=names[:5])


def resolve_location(db: Session, text: Optional[str]) -> ResolveResult[Location]:
    locations = db.query(Location).filter(Location.is_active.is_(True)).all()
    if not text or not text.strip():
        if len(locations) == 1:
            return ResolveResult(value=locations[0], status="resolved")
        return ResolveResult(status="not_specified", candidates=[loc.name for loc in locations])
    options = {loc.name: loc for loc in locations}
    return _best_match(text, options)


def resolve_instructor(db: Session, text: Optional[str]) -> ResolveResult[Instructor]:
    rows = (
        db.query(Instructor, User)
        .join(User, Instructor.user_id == User.id)
        .filter(User.is_active.is_(True))
        .all()
    )
    if not text or not text.strip():
        return ResolveResult(status="not_specified")
    options = {user.full_name: instructor for instructor, user in rows}
    return _best_match(text, options)


def resolve_class_template(db: Session, text: Optional[str]) -> ResolveResult[ClassTemplate]:
    templates = db.query(ClassTemplate).filter(ClassTemplate.is_active.is_(True)).all()
    if not text or not text.strip():
        if len(templates) == 1:
            return ResolveResult(value=templates[0], status="resolved")
        return ResolveResult(status="not_specified", candidates=[t.name for t in templates])
    options = {t.name: t for t in templates}
    return _best_match(text, options)


_RELATIVE_DAYS = {
    "oggi": 0,
    "today": 0,
    "domani": 1,
    "tomorrow": 1,
    "dopodomani": 2,
    "day after tomorrow": 2,
}


def resolve_date(date_str: Optional[str], today: date) -> Optional[date]:
    """Parse an ISO date (YYYY-MM-DD), a relative day, or a bare weekday name.

    Only trusts the model's arithmetic if it produced a valid ISO date in the
    future. Falls back to deterministic relative-day and weekday math for
    common phrasing the model may not compute reliably. Never guesses beyond
    that — an unparseable value returns None so the caller asks for clarification.
    """
    if not date_str or not date_str.strip():
        return None

    candidate = date_str.strip()

    try:
        parsed = datetime.strptime(candidate, "%Y-%m-%d").date()
        if parsed >= today:
            return parsed
    except ValueError:
        pass

    normalized = candidate.lower()

    # Longest phrase first — "domani" is a substring of "dopodomani" and
    # "tomorrow" a substring of "day after tomorrow", so a shorter phrase
    # must never shadow a more specific longer one.
    for phrase, offset in sorted(_RELATIVE_DAYS.items(), key=lambda item: -len(item[0])):
        if phrase in normalized:
            return today + timedelta(days=offset)

    for idx, name in enumerate(_WEEKDAYS_EN + _WEEKDAYS_IT):
        weekday = idx % 7
        if name in normalized:
            days_ahead = (weekday - today.weekday()) % 7
            if days_ahead == 0:
                days_ahead = 7  # "next <weekday>" always means a future occurrence
            return today + timedelta(days=days_ahead)

    return None


def resolve_time(time_str: Optional[str]) -> Optional[tuple[int, int]]:
    if not time_str or not time_str.strip():
        return None
    candidate = time_str.strip()
    for fmt in ("%H:%M", "%H.%M", "%H"):
        try:
            parsed = datetime.strptime(candidate, fmt)
            return parsed.hour, parsed.minute
        except ValueError:
            continue
    return None


@dataclass
class AgentActionResult:
    status: str  # executed | needs_clarification | error
    message: str
    scheduled_class: Optional[ScheduledClass] = None


def handle_create_class(
    db: Session, args: dict, today: Optional[date] = None, lang: str = "en"
) -> AgentActionResult:
    """Resolve every slot for create_class and execute only if unambiguous.

    `today` anchors relative-day resolution ("domani", "mercoledì prossimo")
    and must be the studio's *local* calendar date — not raw UTC — since a
    manager saying "domani" means tomorrow in the studio's timezone. Defaults
    to `utcnow().date()` only as a fallback for callers that don't have a
    studio timezone available (e.g. direct unit tests).
    """
    template_result = resolve_class_template(db, args.get("class_type"))
    if template_result.status == "ambiguous":
        return AgentActionResult(
            status="needs_clarification",
            message=_m("class_type_ambiguous", lang, options=", ".join(template_result.candidates)),
        )
    if template_result.status in ("not_found", "not_specified"):
        options = ", ".join(template_result.candidates) if template_result.candidates else "—"
        return AgentActionResult(
            status="needs_clarification",
            message=_m("class_type_missing", lang, options=options),
        )

    location_result = resolve_location(db, args.get("location"))
    if location_result.status == "ambiguous":
        return AgentActionResult(
            status="needs_clarification",
            message=_m("location_ambiguous", lang, options=", ".join(location_result.candidates)),
        )
    if location_result.status in ("not_found", "not_specified"):
        options = ", ".join(location_result.candidates) if location_result.candidates else "—"
        return AgentActionResult(
            status="needs_clarification",
            message=_m("location_missing", lang, options=options),
        )

    instructor_result = resolve_instructor(db, args.get("instructor"))
    if instructor_result.status == "ambiguous":
        return AgentActionResult(
            status="needs_clarification",
            message=_m(
                "instructor_ambiguous", lang, options=", ".join(instructor_result.candidates)
            ),
        )
    if instructor_result.status == "not_found":
        return AgentActionResult(
            status="needs_clarification",
            message=_m("instructor_not_found", lang, name=args.get("instructor", "?")),
        )

    today = today or utcnow().date()
    resolved_date = resolve_date(args.get("date"), today)
    if resolved_date is None:
        return AgentActionResult(
            status="needs_clarification",
            message=_m("date_missing", lang),
        )

    resolved_time = resolve_time(args.get("start_time"))
    if resolved_time is None:
        return AgentActionResult(
            status="needs_clarification",
            message=_m("time_missing", lang),
        )

    template = template_result.value

    raw_duration = args.get("duration_minutes")
    try:
        duration_minutes = int(raw_duration) if raw_duration else template.duration_minutes
    except (ValueError, TypeError):
        duration_minutes = template.duration_minutes

    raw_capacity = args.get("capacity")
    try:
        capacity = int(raw_capacity) if raw_capacity else template.default_capacity
    except (ValueError, TypeError):
        capacity = template.default_capacity

    notes: str | None = args.get("notes") or None

    starts_at = datetime.combine(resolved_date, datetime.min.time()).replace(
        hour=resolved_time[0], minute=resolved_time[1]
    )
    ends_at = starts_at + timedelta(minutes=duration_minutes)

    if starts_at <= utcnow():
        return AgentActionResult(
            status="error",
            message=_m("date_in_past", lang),
        )

    scheduled_class = ScheduledClass(
        template_id=template.id,
        instructor_id=instructor_result.value.id if instructor_result.value else None,
        location_id=location_result.value.id,
        starts_at=starts_at,
        ends_at=ends_at,
        capacity=capacity,
        notes=notes,
        status="scheduled",
    )
    db.add(scheduled_class)
    db.flush()  # populate scheduled_class.id without committing — router commits

    instructor_name = (
        db.query(User.full_name)
        .join(Instructor)
        .filter(Instructor.id == scheduled_class.instructor_id)
        .scalar()
        if scheduled_class.instructor_id
        else None
    )
    instr_suffix = _m("instructor_suffix", lang, name=instructor_name) if instructor_name else ""
    summary = _m(
        "class_created",
        lang,
        name=template.name,
        date=resolved_date.strftime("%A %d %B %Y"),
        time=f"{resolved_time[0]:02d}:{resolved_time[1]:02d}",
        location=location_result.value.name,
        instructor=instr_suffix,
        capacity=str(capacity),
    )
    if notes:
        summary += f" Notes: {notes}"
    return AgentActionResult(status="executed", message=summary, scheduled_class=scheduled_class)


# ─── Read tool schemas ──────────────────────────────────────────────────────

LIST_CLASS_TYPES_TOOL = {
    "type": "function",
    "function": {
        "name": "list_class_types",
        "description": "List all class types (templates) configured in the studio. Use this to answer questions about available class types.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

LIST_LOCATIONS_TOOL = {
    "type": "function",
    "function": {
        "name": "list_locations",
        "description": "List all active studio locations/establishments.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

LIST_INSTRUCTORS_TOOL = {
    "type": "function",
    "function": {
        "name": "list_instructors",
        "description": "List all active instructors.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

LIST_CLIENTS_TOOL = {
    "type": "function",
    "function": {
        "name": "list_clients",
        "description": "List clients. Optionally filter by name or email.",
        "parameters": {
            "type": "object",
            "properties": {
                "search": {
                    "type": "string",
                    "description": "Search term to filter by name or email. Omit to list all.",
                },
            },
            "required": [],
        },
    },
}

LIST_SCHEDULED_CLASSES_TOOL = {
    "type": "function",
    "function": {
        "name": "list_scheduled_classes",
        "description": "List scheduled classes with their details (type, instructor, location, date/time, capacity, bookings count). Optionally filter by date range.",
        "parameters": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date filter (YYYY-MM-DD). Defaults to today.",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date filter (YYYY-MM-DD). Defaults to 7 days from start.",
                },
            },
            "required": [],
        },
    },
}

LIST_MEMBERSHIP_TYPES_TOOL = {
    "type": "function",
    "function": {
        "name": "list_membership_types",
        "description": "List all active membership types/plans available in the studio.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

CANCEL_CLASS_TOOL = {
    "type": "function",
    "function": {
        "name": "cancel_class",
        "description": "Cancel a scheduled class. Identify the class by describing its type, date, and time.",
        "parameters": {
            "type": "object",
            "properties": {
                "class_type": {
                    "type": "string",
                    "description": "The class type/template name.",
                },
                "date": {
                    "type": "string",
                    "description": "The class date (YYYY-MM-DD or relative like 'tomorrow').",
                },
                "start_time": {
                    "type": "string",
                    "description": "Start time in HH:MM format.",
                },
            },
            "required": [],
        },
    },
}

ALL_READ_TOOLS = [
    LIST_CLASS_TYPES_TOOL,
    LIST_LOCATIONS_TOOL,
    LIST_INSTRUCTORS_TOOL,
    LIST_CLIENTS_TOOL,
    LIST_SCHEDULED_CLASSES_TOOL,
    LIST_MEMBERSHIP_TYPES_TOOL,
]

ALL_WRITE_TOOLS = [
    CREATE_CLASS_TOOL_SCHEMA,
    CANCEL_CLASS_TOOL,
]

ALL_TOOLS = ALL_READ_TOOLS + ALL_WRITE_TOOLS

READ_TOOL_NAMES = {t["function"]["name"] for t in ALL_READ_TOOLS}
WRITE_TOOL_NAMES = {t["function"]["name"] for t in ALL_WRITE_TOOLS}


# ─── Read tool handlers ─────────────────────────────────────────────────────


def handle_list_class_types(db: Session) -> str:
    templates = db.query(ClassTemplate).filter(ClassTemplate.is_active.is_(True)).all()
    if not templates:
        return json.dumps({"class_types": [], "note": "No class types configured yet."})
    data = [
        {
            "name": t.name,
            "duration_minutes": t.duration_minutes,
            "default_capacity": t.default_capacity,
            "color": t.color,
            "description": t.description,
        }
        for t in templates
    ]
    return json.dumps({"class_types": data})


def handle_list_locations(db: Session) -> str:
    locations = db.query(Location).filter(Location.is_active.is_(True)).all()
    if not locations:
        return json.dumps({"locations": [], "note": "No locations configured yet."})
    data = [{"name": loc.name, "address": loc.address} for loc in locations]
    return json.dumps({"locations": data})


def handle_list_instructors(db: Session) -> str:
    rows = (
        db.query(Instructor, User)
        .join(User, Instructor.user_id == User.id)
        .filter(User.is_active.is_(True))
        .all()
    )
    if not rows:
        return json.dumps({"instructors": [], "note": "No instructors configured yet."})
    data = [{"name": user.full_name, "email": user.email} for instructor, user in rows]
    return json.dumps({"instructors": data})


def handle_list_clients(db: Session, args: dict[str, Any]) -> str:
    query = db.query(Client).filter(Client.is_active.is_(True))
    search = args.get("search", "").strip()
    if search:
        query = query.filter(
            Client.full_name.ilike(f"%{search}%") | Client.email.ilike(f"%{search}%")
        )
    clients = query.order_by(Client.full_name).limit(50).all()
    data = [{"name": c.full_name, "email": c.email, "phone": c.phone} for c in clients]
    return json.dumps({"clients": data, "total": len(data)})


def handle_list_scheduled_classes(db: Session, args: dict[str, Any], today: date) -> str:
    start_str = args.get("start_date", "")
    end_str = args.get("end_date", "")
    try:
        start = datetime.strptime(start_str, "%Y-%m-%d").date() if start_str else today
    except ValueError:
        start = today
    try:
        end = (
            datetime.strptime(end_str, "%Y-%m-%d").date() if end_str else start + timedelta(days=7)
        )
    except ValueError:
        end = start + timedelta(days=7)

    start_dt = datetime.combine(start, datetime.min.time())
    end_dt = datetime.combine(end, datetime.max.time())

    classes = (
        db.query(ScheduledClass)
        .filter(
            ScheduledClass.starts_at >= start_dt,
            ScheduledClass.starts_at <= end_dt,
            ScheduledClass.status != "cancelled",
        )
        .order_by(ScheduledClass.starts_at)
        .limit(100)
        .all()
    )

    template_ids = {c.template_id for c in classes}
    templates = (
        {
            t.id: t.name
            for t in db.query(ClassTemplate).filter(ClassTemplate.id.in_(template_ids)).all()
        }
        if template_ids
        else {}
    )

    instructor_ids = {c.instructor_id for c in classes if c.instructor_id}
    instr_map: dict[int, str] = {}
    if instructor_ids:
        rows = (
            db.query(Instructor.id, User.full_name)
            .join(User, Instructor.user_id == User.id)
            .filter(Instructor.id.in_(instructor_ids))
            .all()
        )
        instr_map = {r[0]: r[1] for r in rows}

    location_ids = {c.location_id for c in classes}
    loc_map: dict[int, str] = {}
    if location_ids:
        locs = db.query(Location).filter(Location.id.in_(location_ids)).all()
        loc_map = {loc.id: loc.name for loc in locs}

    data = []
    for c in classes:
        bookings_count = (
            db.query(Booking)
            .filter(Booking.scheduled_class_id == c.id, Booking.status == "confirmed")
            .count()
        )
        data.append(
            {
                "class_type": templates.get(c.template_id, f"#{c.template_id}"),
                "date": c.starts_at.strftime("%Y-%m-%d"),
                "start_time": c.starts_at.strftime("%H:%M"),
                "end_time": c.ends_at.strftime("%H:%M"),
                "instructor": instr_map.get(c.instructor_id, None) if c.instructor_id else None,
                "location": loc_map.get(c.location_id, f"#{c.location_id}"),
                "capacity": c.capacity,
                "bookings": bookings_count,
                "status": c.status,
            }
        )
    return json.dumps(
        {
            "scheduled_classes": data,
            "total": len(data),
            "from": start.isoformat(),
            "to": end.isoformat(),
        }
    )


def handle_list_membership_types(db: Session) -> str:
    types = db.query(MembershipType).filter(MembershipType.is_active.is_(True)).all()
    if not types:
        return json.dumps({"membership_types": [], "note": "No membership types configured yet."})
    data = [
        {
            "name": mt.name,
            "type": mt.type,
            "price": mt.price,
            "currency": mt.currency,
            "billing_interval": mt.billing_interval,
            "credits_included": mt.credits_included,
            "unlimited": mt.unlimited,
            "validity_days": mt.validity_days,
            "description": mt.description,
        }
        for mt in types
    ]
    return json.dumps({"membership_types": data})


def handle_cancel_class(
    db: Session, args: dict[str, Any], today: date, lang: str = "en"
) -> AgentActionResult:
    template_result = resolve_class_template(db, args.get("class_type"))
    if template_result.status != "resolved":
        options = ", ".join(template_result.candidates) if template_result.candidates else "?"
        return AgentActionResult(
            status="needs_clarification",
            message=f"Which class type? Options: {options}.",
        )

    resolved_date = resolve_date(args.get("date"), today)
    if resolved_date is None:
        return AgentActionResult(
            status="needs_clarification",
            message="Which date is this class on?",
        )

    resolved_time = resolve_time(args.get("start_time"))

    query = db.query(ScheduledClass).filter(
        ScheduledClass.template_id == template_result.value.id,
        ScheduledClass.status == "scheduled",
    )

    start_dt = datetime.combine(resolved_date, datetime.min.time())
    end_dt = datetime.combine(resolved_date, datetime.max.time())
    query = query.filter(
        ScheduledClass.starts_at >= start_dt,
        ScheduledClass.starts_at <= end_dt,
    )

    if resolved_time:
        exact_dt = datetime.combine(resolved_date, datetime.min.time()).replace(
            hour=resolved_time[0], minute=resolved_time[1]
        )
        query = query.filter(ScheduledClass.starts_at == exact_dt)

    matches = query.all()

    if len(matches) == 0:
        return AgentActionResult(
            status="needs_clarification",
            message=f"No scheduled {template_result.value.name} class found on {resolved_date.isoformat()}.",
        )
    if len(matches) > 1:
        times = ", ".join(m.starts_at.strftime("%H:%M") for m in matches)
        return AgentActionResult(
            status="needs_clarification",
            message=f"Multiple {template_result.value.name} classes on that date at: {times}. Which one?",
        )

    sc = matches[0]
    sc.status = "cancelled"

    return AgentActionResult(
        status="executed",
        message=(
            f"Cancelled {template_result.value.name} on "
            f"{resolved_date.strftime('%A %d %B %Y')} at {sc.starts_at.strftime('%H:%M')}."
        ),
        scheduled_class=sc,
    )


# ─── Client resolver ────────────────────────────────────────────────────────


def resolve_client(db: Session, text: Optional[str]) -> ResolveResult[Client]:
    """Resolve a client by full name or email."""
    clients = db.query(Client).filter(Client.is_active.is_(True)).all()
    if not text or not text.strip():
        return ResolveResult(status="not_specified", candidates=[c.full_name for c in clients[:5]])

    normalized = text.strip().lower()

    # Exact email match
    for c in clients:
        if c.email.lower() == normalized:
            return ResolveResult(value=c, status="resolved")

    # Name matching via _best_match
    options = {c.full_name: c for c in clients}
    return _best_match(normalized, options)


def resolve_scheduled_class_instance(
    db: Session,
    class_type_text: Optional[str],
    date_str: Optional[str],
    time_str: Optional[str],
    today: date,
) -> tuple[ResolveResult[ScheduledClass], Optional[ClassTemplate]]:
    """Find a specific ScheduledClass by type + date + optional time.

    Returns (result, template) — template is set even when result.status != 'resolved'
    so callers can include the class name in error messages.
    """
    template_result = resolve_class_template(db, class_type_text)
    if template_result.status != "resolved":
        return ResolveResult(status="not_found"), None

    tmpl = template_result.value
    resolved_date = resolve_date(date_str, today)
    if resolved_date is None:
        return ResolveResult(status="not_specified"), tmpl

    start_dt = datetime.combine(resolved_date, datetime.min.time())
    end_dt = datetime.combine(resolved_date, datetime.max.time())

    query = db.query(ScheduledClass).filter(
        ScheduledClass.template_id == tmpl.id,
        ScheduledClass.starts_at >= start_dt,
        ScheduledClass.starts_at <= end_dt,
        ScheduledClass.status != "cancelled",
    )

    resolved_time = resolve_time(time_str)
    if resolved_time:
        exact_dt = start_dt.replace(hour=resolved_time[0], minute=resolved_time[1])
        query = query.filter(ScheduledClass.starts_at == exact_dt)

    matches = query.all()
    if len(matches) == 0:
        return ResolveResult(status="not_found"), tmpl
    if len(matches) == 1:
        return ResolveResult(value=matches[0], status="resolved"), tmpl

    times = [m.starts_at.strftime("%H:%M") for m in matches]
    return ResolveResult(candidates=times, status="ambiguous"), tmpl


# ─── New action tool schemas ─────────────────────────────────────────────────

_CLIENT_SLOT = {
    "client": {
        "type": "string",
        "description": "Client full name or email address.",
    }
}

_CLASS_SLOTS = {
    "class_type": {"type": "string", "description": "Class type name, e.g. 'Yoga Flow'."},
    "date": {"type": "string", "description": "Date in YYYY-MM-DD format."},
    "start_time": {"type": "string", "description": "Start time in HH:MM format."},
}

BOOK_CLIENT_TOOL = {
    "type": "function",
    "function": {
        "name": "book_client",
        "description": "Book a client into a scheduled class.",
        "parameters": {
            "type": "object",
            "properties": {**_CLIENT_SLOT, **_CLASS_SLOTS},
            "required": [],
        },
    },
}

CANCEL_BOOKING_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "cancel_booking",
        "description": (
            "Cancel a client's booking for a class. "
            "ALWAYS ask the manager to confirm before calling this tool."
        ),
        "parameters": {
            "type": "object",
            "properties": {**_CLIENT_SLOT, **_CLASS_SLOTS},
            "required": [],
        },
    },
}

GET_CLASS_ROSTER_TOOL = {
    "type": "function",
    "function": {
        "name": "get_class_roster",
        "description": "List who has booked a specific class.",
        "parameters": {
            "type": "object",
            "properties": _CLASS_SLOTS,
            "required": [],
        },
    },
}

CHECK_IN_CLIENT_TOOL = {
    "type": "function",
    "function": {
        "name": "check_in_client",
        "description": "Manually check in a client for a class (marks attendance).",
        "parameters": {
            "type": "object",
            "properties": {**_CLIENT_SLOT, **_CLASS_SLOTS},
            "required": [],
        },
    },
}

CREATE_CLIENT_TOOL = {
    "type": "function",
    "function": {
        "name": "create_client",
        "description": "Create a new client in the studio.",
        "parameters": {
            "type": "object",
            "properties": {
                "full_name": {"type": "string", "description": "Client's full name."},
                "email": {"type": "string", "description": "Client's email address."},
                "phone": {"type": "string", "description": "Client's phone number (optional)."},
            },
            "required": [],
        },
    },
}

ASSIGN_MEMBERSHIP_TOOL = {
    "type": "function",
    "function": {
        "name": "assign_membership",
        "description": "Assign a membership plan to a client.",
        "parameters": {
            "type": "object",
            "properties": {
                **_CLIENT_SLOT,
                "membership_type": {
                    "type": "string",
                    "description": "Membership plan name, e.g. 'Monthly Unlimited'.",
                },
                "starts_at": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD. Defaults to today if omitted.",
                },
            },
            "required": [],
        },
    },
}

GET_REPORT_TOOL = {
    "type": "function",
    "function": {
        "name": "get_report",
        "description": (
            "Retrieve a summary report. type must be one of: "
            "attendance, revenue, membership, retention."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Report type: attendance | revenue | membership | retention.",
                },
                "start_date": {
                    "type": "string",
                    "description": "Start date YYYY-MM-DD. Defaults to 30 days ago.",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date YYYY-MM-DD. Defaults to today.",
                },
            },
            "required": [],
        },
    },
}

# Extend ALL_WRITE_TOOLS now that the new schemas are defined.
ALL_WRITE_TOOLS.extend(
    [
        BOOK_CLIENT_TOOL,
        CANCEL_BOOKING_TOOL_SCHEMA,
        GET_CLASS_ROSTER_TOOL,
        CHECK_IN_CLIENT_TOOL,
        CREATE_CLIENT_TOOL,
        ASSIGN_MEMBERSHIP_TOOL,
        GET_REPORT_TOOL,
    ]
)
WRITE_TOOL_NAMES.update(t["function"]["name"] for t in ALL_WRITE_TOOLS)

# ─── New action handlers ─────────────────────────────────────────────────────


def handle_book_client(
    db: Session, args: dict, today: Optional[date] = None, lang: str = "en"
) -> AgentActionResult:
    """Book a client into a scheduled class."""
    today = today or utcnow().date()

    client_result = resolve_client(db, args.get("client"))
    if client_result.status == "not_specified":
        return AgentActionResult(status="needs_clarification", message=_m("client_missing", lang))
    if client_result.status == "ambiguous":
        return AgentActionResult(
            status="needs_clarification",
            message=_m(
                "client_ambiguous",
                lang,
                name=args.get("client", "?"),
                options=", ".join(client_result.candidates),
            ),
        )
    if client_result.status == "not_found":
        return AgentActionResult(
            status="needs_clarification",
            message=_m("client_not_found", lang, name=args.get("client", "?")),
        )

    sc_result, tmpl = resolve_scheduled_class_instance(
        db, args.get("class_type"), args.get("date"), args.get("start_time"), today
    )
    if sc_result.status == "not_found" or sc_result.status == "not_specified":
        return AgentActionResult(
            status="needs_clarification", message=_m("class_not_found_for_action", lang)
        )
    if sc_result.status == "ambiguous":
        return AgentActionResult(
            status="needs_clarification",
            message=_m(
                "class_ambiguous_time",
                lang,
                class_type=tmpl.name if tmpl else args.get("class_type", "?"),
                date=args.get("date", "?"),
                options=", ".join(sc_result.candidates),
            ),
        )

    sc = sc_result.value
    client = client_result.value

    # Duplicate check
    existing = (
        db.query(Booking)
        .filter(
            Booking.client_id == client.id,
            Booking.scheduled_class_id == sc.id,
            Booking.status == "confirmed",
        )
        .first()
    )
    if existing:
        return AgentActionResult(
            status="needs_clarification",
            message=_m("booking_duplicate", lang, client=client.full_name),
        )

    # Capacity check
    booked = (
        db.query(Booking)
        .filter(Booking.scheduled_class_id == sc.id, Booking.status == "confirmed")
        .count()
    )
    if booked >= sc.capacity:
        return AgentActionResult(
            status="needs_clarification",
            message=_m(
                "booking_class_full",
                lang,
                class_type=tmpl.name if tmpl else "?",
                date=sc.starts_at.strftime("%d %b %Y"),
                time=sc.starts_at.strftime("%H:%M"),
                booked=str(booked),
                capacity=str(sc.capacity),
            ),
        )

    # Membership / credit check
    from app.services.booking_service import (
        can_book,
        deduct_credit,
        get_active_membership,
        get_studio_settings,
    )

    studio_settings = get_studio_settings(db)
    if not can_book(db, client.id, studio_settings):
        return AgentActionResult(
            status="needs_clarification",
            message=_m("booking_no_membership", lang, client=client.full_name),
        )

    membership = get_active_membership(db, client.id)
    credit_deducted = deduct_credit(db, membership)

    booking = Booking(
        client_id=client.id,
        scheduled_class_id=sc.id,
        status="confirmed",
        credit_deducted=credit_deducted,
        location_id=sc.location_id,
    )
    db.add(booking)
    db.flush()

    return AgentActionResult(
        status="executed",
        message=_m(
            "booking_created",
            lang,
            client=client.full_name,
            class_type=tmpl.name if tmpl else "?",
            date=sc.starts_at.strftime("%A %d %B %Y"),
            time=sc.starts_at.strftime("%H:%M"),
        ),
    )


def handle_cancel_booking(
    db: Session, args: dict, today: Optional[date] = None, lang: str = "en"
) -> AgentActionResult:
    """Cancel a client's booking for a class."""
    today = today or utcnow().date()

    client_result = resolve_client(db, args.get("client"))
    if client_result.status in ("not_specified", "not_found", "ambiguous"):
        opts = ", ".join(client_result.candidates) if client_result.candidates else ""
        if client_result.status == "not_specified":
            return AgentActionResult(
                status="needs_clarification", message=_m("client_missing", lang)
            )
        if client_result.status == "ambiguous":
            return AgentActionResult(
                status="needs_clarification",
                message=_m(
                    "client_ambiguous",
                    lang,
                    name=args.get("client", "?"),
                    options=opts,
                ),
            )
        return AgentActionResult(
            status="needs_clarification",
            message=_m("client_not_found", lang, name=args.get("client", "?")),
        )

    sc_result, tmpl = resolve_scheduled_class_instance(
        db, args.get("class_type"), args.get("date"), args.get("start_time"), today
    )
    if sc_result.status != "resolved":
        return AgentActionResult(
            status="needs_clarification", message=_m("class_not_found_for_action", lang)
        )

    sc = sc_result.value
    client = client_result.value

    booking = (
        db.query(Booking)
        .filter(
            Booking.client_id == client.id,
            Booking.scheduled_class_id == sc.id,
            Booking.status == "confirmed",
        )
        .first()
    )
    if not booking:
        return AgentActionResult(
            status="needs_clarification",
            message=_m(
                "booking_not_found",
                lang,
                client=client.full_name,
                class_type=tmpl.name if tmpl else "?",
                date=sc.starts_at.strftime("%d %b %Y"),
            ),
        )

    from app.services.booking_service import get_active_membership, refund_credit

    if booking.credit_deducted:
        membership = get_active_membership(db, client.id)
        refund_credit(db, membership, credit_deducted=True)

    booking.status = "cancelled"
    booking.cancelled_at = utcnow()

    return AgentActionResult(
        status="executed",
        message=_m(
            "booking_cancelled",
            lang,
            client=client.full_name,
            class_type=tmpl.name if tmpl else "?",
            date=sc.starts_at.strftime("%A %d %B %Y"),
            time=sc.starts_at.strftime("%H:%M"),
        ),
    )


def handle_get_class_roster(
    db: Session, args: dict, today: date, lang: str = "en"
) -> AgentActionResult:
    """Return the list of clients booked for a class."""
    sc_result, tmpl = resolve_scheduled_class_instance(
        db, args.get("class_type"), args.get("date"), args.get("start_time"), today
    )
    if sc_result.status != "resolved":
        return AgentActionResult(
            status="needs_clarification", message=_m("class_not_found_for_action", lang)
        )

    sc = sc_result.value
    bookings = (
        db.query(Booking)
        .filter(Booking.scheduled_class_id == sc.id, Booking.status == "confirmed")
        .all()
    )

    date_str = sc.starts_at.strftime("%A %d %B %Y")
    time_str = sc.starts_at.strftime("%H:%M")
    class_name = tmpl.name if tmpl else "?"

    if not bookings:
        return AgentActionResult(
            status="executed",
            message=_m("roster_empty", lang, class_type=class_name, date=date_str, time=time_str),
        )

    checkin_ids = {
        c.booking_id for c in db.query(Checkin).filter(Checkin.scheduled_class_id == sc.id).all()
    }
    client_ids = [b.client_id for b in bookings]
    client_map = {
        c.id: c.full_name for c in db.query(Client).filter(Client.id.in_(client_ids)).all()
    }

    lines = []
    for i, b in enumerate(bookings, 1):
        name = client_map.get(b.client_id, f"Client #{b.client_id}")
        checked = " ✓" if b.id in checkin_ids else ""
        lines.append(f"{i}. {name}{checked}")

    return AgentActionResult(
        status="executed",
        message=_m(
            "roster_result",
            lang,
            class_type=class_name,
            date=date_str,
            time=time_str,
            booked=str(len(bookings)),
            capacity=str(sc.capacity),
            list="\n".join(lines),
        ),
    )


def handle_check_in_client(
    db: Session, args: dict, today: Optional[date] = None, lang: str = "en"
) -> AgentActionResult:
    """Manually check in a client for a class."""
    today = today or utcnow().date()

    client_result = resolve_client(db, args.get("client"))
    if client_result.status == "not_specified":
        return AgentActionResult(status="needs_clarification", message=_m("client_missing", lang))
    if client_result.status == "ambiguous":
        return AgentActionResult(
            status="needs_clarification",
            message=_m(
                "client_ambiguous",
                lang,
                name=args.get("client", "?"),
                options=", ".join(client_result.candidates),
            ),
        )
    if client_result.status == "not_found":
        return AgentActionResult(
            status="needs_clarification",
            message=_m("client_not_found", lang, name=args.get("client", "?")),
        )

    sc_result, tmpl = resolve_scheduled_class_instance(
        db, args.get("class_type"), args.get("date"), args.get("start_time"), today
    )
    if sc_result.status != "resolved":
        return AgentActionResult(
            status="needs_clarification", message=_m("class_not_found_for_action", lang)
        )

    sc = sc_result.value
    client = client_result.value

    booking = (
        db.query(Booking)
        .filter(
            Booking.client_id == client.id,
            Booking.scheduled_class_id == sc.id,
            Booking.status == "confirmed",
        )
        .first()
    )
    if not booking:
        return AgentActionResult(
            status="needs_clarification",
            message=_m("checkin_no_booking", lang, client=client.full_name),
        )

    existing_checkin = db.query(Checkin).filter(Checkin.booking_id == booking.id).first()
    if existing_checkin:
        return AgentActionResult(
            status="needs_clarification",
            message=_m("checkin_already", lang, client=client.full_name),
        )

    checkin = Checkin(
        booking_id=booking.id,
        client_id=client.id,
        scheduled_class_id=sc.id,
        method="manual",
        location_id=sc.location_id,
    )
    db.add(checkin)
    db.flush()

    return AgentActionResult(
        status="executed",
        message=_m(
            "checkin_done",
            lang,
            client=client.full_name,
            class_type=tmpl.name if tmpl else "?",
            date=sc.starts_at.strftime("%A %d %B %Y"),
            time=sc.starts_at.strftime("%H:%M"),
        ),
    )


def handle_create_client(db: Session, args: dict, lang: str = "en") -> AgentActionResult:
    """Create a new client in the studio."""
    full_name = (args.get("full_name") or "").strip()
    email = (args.get("email") or "").strip()
    phone = (args.get("phone") or "").strip() or None

    if not full_name:
        return AgentActionResult(
            status="needs_clarification", message=_m("client_name_missing", lang)
        )
    if not email:
        return AgentActionResult(
            status="needs_clarification", message=_m("client_email_missing", lang)
        )

    existing = db.query(Client).filter(Client.email == email).first()
    if existing:
        return AgentActionResult(
            status="needs_clarification",
            message=_m("client_email_duplicate", lang, email=email),
        )

    client = Client(full_name=full_name, email=email, phone=phone, is_active=True)
    db.add(client)
    db.flush()

    return AgentActionResult(
        status="executed",
        message=_m("client_created", lang, name=full_name, email=email),
    )


def handle_assign_membership(
    db: Session, args: dict, today: Optional[date] = None, lang: str = "en"
) -> AgentActionResult:
    """Assign a membership plan to a client."""
    today = today or utcnow().date()

    client_result = resolve_client(db, args.get("client"))
    if client_result.status == "not_specified":
        return AgentActionResult(status="needs_clarification", message=_m("client_missing", lang))
    if client_result.status == "ambiguous":
        return AgentActionResult(
            status="needs_clarification",
            message=_m(
                "client_ambiguous",
                lang,
                name=args.get("client", "?"),
                options=", ".join(client_result.candidates),
            ),
        )
    if client_result.status == "not_found":
        return AgentActionResult(
            status="needs_clarification",
            message=_m("client_not_found", lang, name=args.get("client", "?")),
        )

    mt_text = (args.get("membership_type") or "").strip()
    membership_types = db.query(MembershipType).filter(MembershipType.is_active.is_(True)).all()
    if not mt_text:
        options = ", ".join(mt.name for mt in membership_types)
        return AgentActionResult(
            status="needs_clarification",
            message=_m("membership_type_missing", lang, options=options),
        )
    mt_options = {mt.name: mt for mt in membership_types}
    mt_result = _best_match(mt_text, mt_options)
    if mt_result.status != "resolved":
        options = ", ".join(mt.name for mt in membership_types)
        return AgentActionResult(
            status="needs_clarification",
            message=_m("membership_type_not_found", lang, name=mt_text, options=options),
        )

    mt = mt_result.value
    client = client_result.value

    starts_raw = (args.get("starts_at") or "").strip()
    try:
        starts_at = datetime.strptime(starts_raw, "%Y-%m-%d").date() if starts_raw else today
    except ValueError:
        starts_at = today

    expires_at = starts_at + timedelta(days=mt.validity_days) if mt.validity_days else None
    credits_remaining = mt.credits_included

    membership = Membership(
        client_id=client.id,
        membership_type_id=mt.id,
        status="active",
        starts_at=starts_at,
        expires_at=expires_at,
        credits_remaining=credits_remaining,
        credits_used=0,
        location_id=1,
    )
    db.add(membership)
    db.flush()

    expires_suffix = (
        _m("membership_expires_suffix", lang, date=expires_at.strftime("%d %b %Y"))
        if expires_at
        else ""
    )
    return AgentActionResult(
        status="executed",
        message=_m(
            "membership_assigned",
            lang,
            plan=mt.name,
            client=client.full_name,
            starts_at=starts_at.strftime("%d %b %Y"),
            expires=expires_suffix,
        ),
    )


def handle_get_report(db: Session, args: dict, today: date, lang: str = "en") -> AgentActionResult:
    """Return a plain-text summary of a report."""
    report_type = (args.get("type") or "attendance").strip().lower()

    start_raw = args.get("start_date", "")
    end_raw = args.get("end_date", "")
    try:
        start = (
            datetime.strptime(start_raw, "%Y-%m-%d").date()
            if start_raw
            else today - timedelta(days=30)
        )
    except ValueError:
        start = today - timedelta(days=30)
    try:
        end = datetime.strptime(end_raw, "%Y-%m-%d").date() if end_raw else today
    except ValueError:
        end = today

    start_dt = datetime.combine(start, datetime.min.time())
    end_dt = datetime.combine(end, datetime.max.time())
    period = f"{start.strftime('%d %b %Y')} — {end.strftime('%d %b %Y')}"

    if report_type == "attendance":
        from app.models.checkin import Checkin as CheckinModel

        classes = (
            db.query(ScheduledClass)
            .filter(ScheduledClass.starts_at >= start_dt, ScheduledClass.starts_at <= end_dt)
            .all()
        )
        total_classes = len(classes)
        cancelled = sum(1 for c in classes if c.status == "cancelled")
        completed = sum(1 for c in classes if c.status == "completed")

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
            db.query(CheckinModel)
            .filter(
                CheckinModel.checked_in_at >= start_dt,
                CheckinModel.checked_in_at <= end_dt,
            )
            .count()
        )
        rate = round(total_checkins / total_bookings * 100, 1) if total_bookings else 0.0
        avg = round(total_bookings / total_classes, 1) if total_classes else 0.0

        text = (
            f"Attendance report ({period}):\n"
            f"- Classes: {total_classes} total ({completed} completed, {cancelled} cancelled)\n"
            f"- Bookings: {total_bookings}\n"
            f"- Check-ins: {total_checkins}\n"
            f"- Check-in rate: {rate}%\n"
            f"- Average bookings per class: {avg}"
        )

    elif report_type == "revenue":
        from app.models.payment import Payment

        payments = (
            db.query(Payment)
            .filter(
                Payment.created_at >= start_dt,
                Payment.created_at <= end_dt,
                Payment.status == "succeeded",
            )
            .all()
        )
        total = sum(p.amount for p in payments)
        currency = payments[0].currency.upper() if payments else "EUR"

        text = (
            f"Revenue report ({period}):\n"
            f"- Payments processed: {len(payments)}\n"
            f"- Total revenue: {total:.2f} {currency}"
        )

    elif report_type == "membership":
        from app.models.membership import Membership as MembershipModel

        active = (
            db.query(MembershipModel)
            .filter(
                MembershipModel.status == "active",
                MembershipModel.starts_at <= end,
            )
            .count()
        )
        new_this_period = (
            db.query(MembershipModel)
            .filter(
                MembershipModel.starts_at >= start,
                MembershipModel.starts_at <= end,
            )
            .count()
        )

        text = (
            f"Membership report ({period}):\n"
            f"- Active memberships: {active}\n"
            f"- New memberships this period: {new_this_period}"
        )

    elif report_type == "retention":
        from app.models.booking import Booking as BookingModel

        booked_prev = set(
            r[0]
            for r in db.query(BookingModel.client_id)
            .filter(
                BookingModel.created_at >= start_dt - timedelta(days=30),
                BookingModel.created_at < start_dt,
                BookingModel.status == "confirmed",
            )
            .all()
        )
        booked_curr = set(
            r[0]
            for r in db.query(BookingModel.client_id)
            .filter(
                BookingModel.created_at >= start_dt,
                BookingModel.created_at <= end_dt,
                BookingModel.status == "confirmed",
            )
            .all()
        )
        returned = len(booked_prev & booked_curr)
        retention = round(returned / len(booked_prev) * 100, 1) if booked_prev else 0.0

        text = (
            f"Retention report ({period}):\n"
            f"- Clients who booked in the previous period: {len(booked_prev)}\n"
            f"- Of those, returned this period: {returned}\n"
            f"- Retention rate: {retention}%"
        )

    else:
        text = (
            f"Unknown report type '{report_type}'. Use: attendance, revenue, membership, retention."
        )

    return AgentActionResult(status="executed", message=text)


def load_studio_data_summary(db: Session, today: date) -> str:
    """Build a compact plain-text summary of studio data for the system prompt.

    Clients are intentionally excluded — they can be large (500+) and are not
    needed for create/cancel class actions. The LLM can request client data
    separately if the user asks about a specific client.
    Scheduled classes are limited to the next 3 days to keep tokens low.
    """
    from datetime import timedelta

    parts = []

    parts.append("CLASS TYPES:")
    parts.append(handle_list_class_types(db))

    parts.append("\nLOCATIONS:")
    parts.append(handle_list_locations(db))

    parts.append("\nINSTRUCTORS:")
    parts.append(handle_list_instructors(db))

    parts.append("\nSCHEDULED CLASSES (next 3 days):")
    end_date = (today + timedelta(days=3)).isoformat()
    parts.append(handle_list_scheduled_classes(db, {"end_date": end_date}, today))

    parts.append("\nMEMBERSHIP TYPES:")
    parts.append(handle_list_membership_types(db))

    return "\n".join(parts)


def dispatch_read_tool(db: Session, tool_name: str, args: dict[str, Any], today: date) -> str:
    handlers: dict[str, Any] = {
        "list_class_types": lambda: handle_list_class_types(db),
        "list_locations": lambda: handle_list_locations(db),
        "list_instructors": lambda: handle_list_instructors(db),
        "list_clients": lambda: handle_list_clients(db, args),
        "list_scheduled_classes": lambda: handle_list_scheduled_classes(db, args, today),
        "list_membership_types": lambda: handle_list_membership_types(db),
    }
    handler = handlers.get(tool_name)
    if handler:
        return handler()
    return json.dumps({"error": f"Unknown tool: {tool_name}"})
