#!/usr/bin/env python3
"""Remove all PII from csv/data.csv with consistent anonymization."""

import csv
import hashlib
import re
import sys
from pathlib import Path

# ── Fake data pools for consistent anonymization ──────────────────────────────
FAKE_FIRST = [
    "Alex", "Jordan", "Morgan", "Taylor", "Casey", "Riley", "Quinn", "Avery",
    "Cameron", "Dakota", "Ellis", "Finley", "Hayden", "Jamie", "Kendall",
    "Lane", "Marley", "Noel", "Parker", "Reese", "Sage", "Toby", "Val",
    "Winter", "Ari", "Blair", "Drew", "Eden", "Frankie", "Glenn", "Harper",
    "Indigo", "Jules", "Kerry", "Lee", "Micah", "Nico", "Oakley", "Pat",
    "Robin", "Sam", "Terry", "Uri", "Wren", "Yael", "Zion", "Ash", "Bay",
    "Charlie", "Devon", "Emery", "Flynn", "Gray", "Haven", "Ira", "Jesse",
    "Kit", "Luca", "Milan", "Noor", "Onyx", "Peyton", "Remy", "Scout",
    "Tatum", "Unity", "Vesper", "West", "Xen", "Yuri", "Zen",
]
FAKE_LAST = [
    "Mueller", "Schmidt", "Fischer", "Weber", "Meyer", "Wagner", "Becker",
    "Hoffmann", "Richter", "Klein", "Wolf", "Neumann", "Schwarz", "Braun",
    "Krueger", "Hartmann", "Lange", "Werner", "Lehmann", "Koch", "Berger",
    "Kaiser", "Fuchs", "Peters", "Lang", "Scholz", "Moeller", "Winkler",
    "Ludwig", "Jung", "Frank", "Baumann", "Roth", "Keller", "Schreiber",
    "Sommer", "Winter", "Vogel", "Kraus", "Huber", "Lorenz", "Otto",
    "Haas", "Graf", "Heinrich", "Brandt", "Pfeiffer", "Dietrich", "Kuhn",
    "Stein", "Albrecht", "Simon", "Ernst", "Fiedler", "Hahn", "Busch",
    "Arnold", "Thomas", "Martin", "Engel", "Kern", "Reinhardt", "Seidel",
    "Forster", "Bauer", "Maier", "Vogt", "Zimmer", "Beck", "Schuster",
]
FAKE_STREETS = [
    "Bahnhofstrasse", "Bundesgasse", "Marktgasse", "Poststrasse",
    "Kirchstrasse", "Schulstrasse", "Gartenstrasse", "Bergstrasse",
    "Hauptstrasse", "Seestrasse", "Waldstrasse", "Dorfstrasse",
    "Industriestrasse", "Ringstrasse", "Parkstrasse", "Sonnenbergstrasse",
]
FAKE_CITIES = [
    "Musterstadt", "Beispielberg", "Testdorf", "Demohausen", "Problingen",
    "Planstadt", "Nordheim", "Westfeld", "Ostdorf", "Suedhausen",
]


def _stable_index(value: str, pool_size: int) -> int:
    """Deterministic index from a string so the same input always maps to the same output."""
    h = int(hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest(), 16)
    return h % pool_size


def _anon_first(name: str) -> str:
    if not name.strip():
        return ""
    return FAKE_FIRST[_stable_index(name.strip().lower(), len(FAKE_FIRST))]


def _anon_last(name: str) -> str:
    if not name.strip():
        return ""
    return FAKE_LAST[_stable_index(name.strip().lower(), len(FAKE_LAST))]


def _anon_full(name: str) -> str:
    if not name.strip():
        return ""
    return f"{_anon_first(name)} {_anon_last(name)}"


def _anon_email(email: str) -> str:
    if not email.strip():
        return ""
    idx = _stable_index(email.strip().lower(), len(FAKE_FIRST))
    return f"user{idx:04d}@example.com"


def _anon_phone(phone: str) -> str:
    if not phone.strip():
        return ""
    idx = _stable_index(phone.strip(), 9000) + 1000
    return f"+41 58 000 {idx}"


def _anon_id(uid: str) -> str:
    """Anonymize corporate/login IDs while keeping the format."""
    if not uid.strip():
        return ""
    val = uid.strip()
    idx = _stable_index(val.lower(), 99999)
    # Keep prefix letter pattern
    prefix = ""
    for c in val:
        if c.isalpha():
            prefix += c
        else:
            break
    if prefix:
        return f"{prefix}{idx:05d}"
    return f"{idx:08d}"


def _anon_street(street: str) -> str:
    if not street.strip():
        return ""
    idx = _stable_index(street.strip().lower(), len(FAKE_STREETS))
    num = (_stable_index(street.strip(), 200)) + 1
    return f"{FAKE_STREETS[idx]} {num}"


def _anon_zip(zipcode: str) -> str:
    if not zipcode.strip():
        return ""
    idx = _stable_index(zipcode.strip(), 9000) + 1000
    return str(idx)


def _anon_city(city: str) -> str:
    if not city.strip():
        return ""
    return FAKE_CITIES[_stable_index(city.strip().lower(), len(FAKE_CITIES))]


def _anon_desk(desk: str) -> str:
    if not desk.strip():
        return ""
    return f"DESK-{_stable_index(desk.strip(), 999):03d}"


# ── Column index sets ─────────────────────────────────────────────────────────
# Columns to clear entirely (name-structured PII)
FIRST_NAME_COLS = {10, 266, 324, 611, 692}  # First Name+, Vendor First Name, Direct Contact First Name, first_name2, z1D_First_Name
LAST_NAME_COLS = {9, 265, 323, 612, 691}  # Last Name+, Vendor Last Name, Direct Contact Last Name, last_name2, z1D_Last_Name
MIDDLE_NAME_COLS = {11, 325, 693}  # Middle Name, Direct Contact Middle Initial, z1D_Middle_Initial
FULL_NAME_COLS = {8, 843}  # Full Name, CUSTContactFullName
ASSIGNEE_NAME_COLS = {80, 844}  # Assignee+, Last Modified By (Name) -- these are "Firstname Lastname" format

EMAIL_COLS = {26, 235, 263, 281, 699}
PHONE_COLS = {17, 18, 25, 28, 82, 326, 347, 348, 700, 867}
PHONE_CODE_COLS = {15, 16, 345, 346}
STREET_COLS = {21, 335}
ZIP_COLS = {23, 339}
CITY_COLS = {5, 338}  # City, Direct Contact City
DESK_COLS = {19, 20, 341, 342}  # Desk Location, Mail Station, Direct Contact Desk/Mail
LOCATION_COLS = {22, 62, 343}  # Incident Location, Additional Location Details, Direct Contact Location Details

CORPORATE_ID_COLS = {27, 688}  # Corporate ID, Direct Contact Corporate ID
HR_ID_COL = {36}
PERSON_ID_COLS = {41, 267, 332}  # Person ID, Vendor Person ID, Direct Contact Person ID
LOGIN_ID_COLS = {
    132, 141, 274, 418, 475, 481, 498, 507, 508, 528,
    613, 671, 683, 733, 734, 783, 803, 817, 858,
}  # Various login IDs, Submitter, Created_By, etc.

SITE_ID_COLS = {37, 344}  # Site ID, Direct Contact Site ID
SITE_COLS = {331, 465, 814}  # Contact Site, Customer Site (may have address)
CUSTOMER_SITE_ADDR = {750}  # "Create Impacted Area from Customer's Location*"

# Columns with passwords (should definitely be cleared)
PASSWORD_COLS = {529}  # AppPassword

# Free-text fields that may embed PII
FREETEXT_COLS = {1, 64, 65, 393, 425, 513, 514, 654, 663, 787, 788, 842, 890}
# Summary, Notes, Resolution, Status History, Additional Information,
# z1D_Summary, z1D_Details, Contact+, Customer*+, Abydos Notify Recipient/Text, Customer, Short Description

# User ID Permissions (col 885) - contains login IDs
USER_PERM_COL = {885}


def build_pii_maps(rows, headers):
    """Build maps of real->fake for names, emails, IDs from structured columns."""
    name_map = {}
    email_map = {}
    id_map = {}
    phone_map = {}

    all_name_cols = FIRST_NAME_COLS | LAST_NAME_COLS | MIDDLE_NAME_COLS | FULL_NAME_COLS | ASSIGNEE_NAME_COLS
    all_email_cols = EMAIL_COLS
    all_id_cols = CORPORATE_ID_COLS | HR_ID_COL | PERSON_ID_COLS | LOGIN_ID_COLS
    all_phone_cols = PHONE_COLS | PHONE_CODE_COLS

    for row in rows:
        for c in all_name_cols:
            if c < len(row) and row[c].strip():
                val = row[c].strip()
                if val not in name_map:
                    # For multi-word names, anonymize as full name
                    if " " in val:
                        name_map[val] = _anon_full(val)
                    else:
                        # Could be first or last
                        if c in FIRST_NAME_COLS:
                            name_map[val] = _anon_first(val)
                        elif c in LAST_NAME_COLS:
                            name_map[val] = _anon_last(val)
                        else:
                            name_map[val] = _anon_last(val)
        for c in all_email_cols:
            if c < len(row) and row[c].strip():
                val = row[c].strip()
                if val not in email_map:
                    email_map[val] = _anon_email(val)
        for c in all_id_cols:
            if c < len(row) and row[c].strip():
                val = row[c].strip()
                if val not in id_map:
                    id_map[val] = _anon_id(val)
        for c in all_phone_cols:
            if c < len(row) and row[c].strip():
                val = row[c].strip()
                if val not in phone_map:
                    phone_map[val] = _anon_phone(val)

    return name_map, email_map, id_map, phone_map


def scrub_freetext(text, name_map, email_map, id_map, phone_map):
    """Replace known PII values in free-text fields."""
    if not text.strip():
        return text

    result = text

    # Replace emails (regex + known)
    for real, fake in email_map.items():
        result = result.replace(real, fake)
    # Catch any remaining email patterns
    result = re.sub(
        r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}',
        'redacted@example.com',
        result
    )

    # Replace phone numbers (longer values first to avoid partial matches)
    for real, fake in sorted(phone_map.items(), key=lambda x: -len(x[0])):
        result = result.replace(real, fake)
    # Catch Swiss phone patterns
    result = re.sub(r'\+41\s*\d[\d\s]{8,14}', '+41 XX XXX XXXX', result)

    # Replace names (longer first to avoid partial)
    for real, fake in sorted(name_map.items(), key=lambda x: -len(x[0])):
        if len(real) > 2:  # Skip very short names to avoid false matches
            result = result.replace(real, fake)

    # Replace IDs (longer first)
    for real, fake in sorted(id_map.items(), key=lambda x: -len(x[0])):
        if len(real) > 4:  # Skip very short IDs
            result = result.replace(real, fake)

    return result


def anonymize_location_field(val):
    """Anonymize fields like 'CH-Bern,Stauffacherstrasse 65'."""
    if not val.strip():
        return ""
    return f"CH-{_anon_city(val)},{_anon_street(val)}"


def main():
    csv_path = Path(__file__).parent.parent / "csv" / "data.csv"
    
    # Read all data
    with open(csv_path, encoding="latin-1") as f:
        reader = csv.reader(f)
        headers = next(reader)
        rows = list(reader)

    print(f"Read {len(rows)} rows, {len(headers)} columns")

    # Build PII maps from structured columns
    name_map, email_map, id_map, phone_map = build_pii_maps(rows, headers)
    print(f"PII maps: {len(name_map)} names, {len(email_map)} emails, {len(id_map)} IDs, {len(phone_map)} phones")

    # Process each row
    for row in rows:
        # First names
        for c in FIRST_NAME_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_first(row[c].strip())
        # Last names
        for c in LAST_NAME_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_last(row[c].strip())
        # Middle names
        for c in MIDDLE_NAME_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_first(row[c].strip())[0]  # Single initial
        # Full names
        for c in FULL_NAME_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_full(row[c].strip())
        # Assignee-style names (may be "Lastname Firstname" or just a name)
        for c in ASSIGNEE_NAME_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_full(row[c].strip())
        # Emails
        for c in EMAIL_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_email(row[c].strip())
        # Phones
        for c in PHONE_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_phone(row[c].strip())
        # Phone codes
        for c in PHONE_CODE_COLS:
            if c < len(row) and row[c].strip():
                row[c] = ""
        # Streets
        for c in STREET_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_street(row[c].strip())
        # Zip codes
        for c in ZIP_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_zip(row[c].strip())
        # Cities
        for c in CITY_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_city(row[c].strip())
        # Desk/mail station
        for c in DESK_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_desk(row[c].strip())
        # Location fields (often "CH-City,Street Number")
        for c in LOCATION_COLS:
            if c < len(row) and row[c].strip():
                row[c] = anonymize_location_field(row[c].strip())
        # Corporate IDs
        for c in CORPORATE_ID_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_id(row[c].strip())
        # HR IDs
        for c in HR_ID_COL:
            if c < len(row) and row[c].strip():
                row[c] = _anon_id(row[c].strip())
        # Person IDs
        for c in PERSON_ID_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_id(row[c].strip())
        # Login IDs
        for c in LOGIN_ID_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_id(row[c].strip())
        # Site IDs
        for c in SITE_ID_COLS:
            if c < len(row) and row[c].strip():
                row[c] = _anon_id(row[c].strip())
        # Site / Customer Site (may contain address info)
        for c in SITE_COLS:
            if c < len(row) and row[c].strip():
                row[c] = anonymize_location_field(row[c].strip())
        # Customer location field
        for c in CUSTOMER_SITE_ADDR:
            if c < len(row) and row[c].strip():
                row[c] = anonymize_location_field(row[c].strip())
        # Passwords - clear entirely
        for c in PASSWORD_COLS:
            if c < len(row):
                row[c] = ""
        # User ID Permissions - contains semicolon-separated IDs
        for c in USER_PERM_COL:
            if c < len(row) and row[c].strip():
                parts = row[c].split(";")
                anon_parts = []
                for p in parts:
                    p = p.strip().strip("'")
                    if p:
                        anon_parts.append(_anon_id(p))
                row[c] = ";".join(anon_parts)
        # Owner field (col 131) - can be a name or login ID
        if 131 < len(row) and row[131].strip():
            row[131] = _anon_full(row[131].strip())
        # Free-text fields
        for c in FREETEXT_COLS:
            if c < len(row) and row[c].strip():
                row[c] = scrub_freetext(row[c], name_map, email_map, id_map, phone_map)

        # Also scrub the "Owner" col 131 freetext-style if needed (already replaced above)
        # "z1D_AssigneeManager" already handled in LOGIN_ID_COLS

        # GEOnet (col 24) - clear as it may be location-specific
        if 24 < len(row) and row[24].strip():
            row[24] = ""

    # Write back
    with open(csv_path, "w", encoding="latin-1", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)

    print(f"Done. Wrote {len(rows)} anonymized rows to {csv_path}")


if __name__ == "__main__":
    main()
