#!/bin/bash
# Test-Skript für Booking-System mit .ics Download
# PLATZHALTER für spätere Outlook-API-Integration

echo "==================================="
echo "Booking System Test"
echo "PLATZHALTER: Outlook-Integration"
echo "==================================="
echo ""
echo "💡 Dies ist ein Platzhalter-Template für die zukünftige Outlook-API"
echo "   Dateiname enthält 'PLATZHALTER-OUTLOOK' für schnelles Auffinden"
echo ""

# 1. Erstelle eine Testbuchung
echo "1. Erstelle Testbuchung..."
BOOKING_RESPONSE=$(curl -s -X POST http://localhost:5001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "booking_date": "2026-02-25",
    "time_slot": "10:00",
    "booking_type": "für mich",
    "name": "Testmann",
    "vorname": "Tester",
    "email": "test@example.com",
    "hardware": "Ja",
    "user_email": null
  }')

echo "$BOOKING_RESPONSE" | jq .

# Extrahiere booking_id
BOOKING_ID=$(echo "$BOOKING_RESPONSE" | jq -r '.id')
echo ""
echo "Booking ID: $BOOKING_ID"
echo ""

# 2. Zeige alle Buchungen
echo "2. Liste aller Buchungen:"
curl -s http://localhost:5001/api/bookings | jq .
echo ""

# 3. Prüfe Slot-Verfügbarkeit
echo "3. Slot-Verfügbarkeit für 2026-02-25:"
curl -s http://localhost:5001/api/bookings/availability/2026-02-25 | jq '.[] | select(.time_slot == "10:00")'
echo ""

# 4. Lade .ics-Datei herunter
echo "4. Lade .ics-Datei herunter (mit PLATZHALTER-OUTLOOK im Namen)..."
ICS_FILE="$HOME/Downloads/test-termin.ics"

# Hole den echten Dateinamen aus dem Content-Disposition Header
REAL_FILENAME=$(curl -sI "http://localhost:5001/api/bookings/$BOOKING_ID/download" | grep -i "content-disposition" | sed -n 's/.*filename="\([^"]*\)".*/\1/p' | tr -d '\r')
echo "   Dateiname: $REAL_FILENAME"
echo ""

curl -s "http://localhost:5001/api/bookings/$BOOKING_ID/download" -o "$ICS_FILE"

if [ -f "$ICS_FILE" ]; then
    echo "✓ .ics-Datei erfolgreich erstellt: $ICS_FILE"
    echo ""
    echo "Inhalt der PLATZHALTER-OUTLOOK .ics-Datei:"
    echo "-----------------------------------"
    cat "$ICS_FILE"
    echo "-----------------------------------"
    echo ""
    echo "✓ Test erfolgreich! Datei liegt in: $ICS_FILE"
    echo "  Dateiname beim Browser-Download: $REAL_FILENAME"
    echo "  Du kannst sie jetzt in Outlook importieren!"
else
    echo "✗ Fehler: .ics-Datei wurde nicht erstellt"
fi

echo ""
echo "==================================="
echo "Test abgeschlossen"
echo "==================================="
