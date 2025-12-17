Features Canvas C5: Tickets “Assigned without Assignee” reminden

 
Ausgangssituation: Tickets die je nach Priorität erfasst und einer Support Group zugewiesen werden, müssen innerhalb der entsprechenden Frist (je Prio) in Bearbeitung (in Progress) genommen werden: (Critical max. 30 Min. / High max. 2h / Medium max. 4h / Standard max. 8h). Wird diese Frist abgelaufen, remindet das Incident Mgmt die Support Group Leads (SGL) mittels Email, dass in ihrer Gruppe zu bearbeitende Tickets vorhanden sind.
 

Folgende manuellen Schritte werden dazu getätigt:
Aufruf des Filters [Assigned without Assignee] à [All]
Sortierung nach Spalte «Last Modified Date», älteste Tickets zu oberst (dient zur Beachtung der Frist je nach Priorität)
Manuelle Kontrolle des Tickets (Worklog-Einträge checken, wurde das Ticket z.B. schon einmal remindet)
Versandt eines Email-Reminder an den Support Group Lead aus dem Email System von Remedy (Template: Incident / Reminder Ticket ohne Assignee)
Wiederholung der Schritte 3 und 4 pro Ticket
 

Gewünschtes Zielbild:
UI mit einer automatischen Auswahl und Vorschlag der Tickets die remindet werden sollten auf Knopfdruck/Aufruf.
Die oben erwähnten Kriterien «Assigned ohne Assignee» wie auch die Fristen, wie lange ein Ticket ohne Zuweisung sein darf, werden je nach Priorität berücksichtigt.
Die Auswahl listet die potentiellen Ticket in Form einer Liste auf. Mit dem Klick auf ein Ticket erscheint eine Vorschau / Detailansicht des Tickets mit den letzten Worklog-Einträgen (aktuellster zu oberst).
Mittels Select / Deselect – Auswahl können die Tickets markiert werden, die schliesslich mittels «Remind now»-Button erinnert werden.
Auf der Auswahl werden auch Tickets erkannt, die bereits schon einmal remindet und trotzdem nicht weiter bearbeitet wurden. Sie werden optisch (farblich) separat dargestellt.